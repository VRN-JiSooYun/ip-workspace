import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import {
  chmod,
  copyFile,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  unlink,
} from 'node:fs/promises';
import { basename, join, sep } from 'node:path';
import { PrismaService } from '../database/prisma.service';

export type NotificationRecipientUploadFile = {
  originalname: string;
  mimetype: string;
  path: string;
  size: number;
};

const BATCH_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const SAFE_FILENAME_PATTERN = /^(?!\.)[^/\\\u0000-\u001f\u007f]{1,200}$/u;
const STORED_FILENAME = 'getMembers.json';

@Injectable()
export class NotificationRecipientImportUploadService {
  private readonly importRoot: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.importRoot = config.get<string>(
      'notificationRecipient.importRoot',
      '/app/imports/notification-recipients',
    );
  }

  async upload(
    userId: string,
    body: Record<string, unknown>,
    file?: NotificationRecipientUploadFile,
  ) {
    try {
      const batchKey = this.parseBatchKey(body.batchKey);
      if (!file) {
        throw new BadRequestException(
          'NOTIFICATION_RECIPIENT_IMPORT_UPLOAD_FILE_REQUIRED',
        );
      }
      await this.validateFile(file);
      return await this.persistBatch(userId, batchKey, file);
    } finally {
      if (file) await unlink(file.path).catch(() => undefined);
    }
  }

  async listBatches() {
    const batches = await this.prisma.client.notificationRecipientImportBatch.findMany({
      where: { status: 'READY' },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    return batches.map((batch) => ({
      ...batch,
      byteSize: Number(batch.byteSize),
    }));
  }

  private parseBatchKey(value: unknown): string {
    const batchKey = typeof value === 'string' ? value.trim() : '';
    if (!BATCH_KEY_PATTERN.test(batchKey)) {
      throw new BadRequestException(
        'NOTIFICATION_RECIPIENT_IMPORT_BATCH_KEY_INVALID',
      );
    }
    return batchKey;
  }

  private async validateFile(file: NotificationRecipientUploadFile) {
    const safeFilename = basename(file.originalname).normalize('NFC');
    if (
      safeFilename !== file.originalname
      || !SAFE_FILENAME_PATTERN.test(safeFilename)
      || !safeFilename.toLowerCase().endsWith('.json')
      || file.size <= 0
    ) {
      throw new BadRequestException(
        'NOTIFICATION_RECIPIENT_IMPORT_UPLOAD_FILE_INVALID',
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(file.path, 'utf8'));
    } catch {
      throw new BadRequestException(
        'NOTIFICATION_RECIPIENT_IMPORT_UPLOAD_JSON_INVALID',
      );
    }
    if (!Array.isArray(parsed)) {
      throw new BadRequestException(
        'NOTIFICATION_RECIPIENT_IMPORT_UPLOAD_ARRAY_REQUIRED',
      );
    }
  }

  private async persistBatch(
    userId: string,
    batchKey: string,
    file: NotificationRecipientUploadFile,
  ) {
    await mkdir(this.importRoot, { recursive: true, mode: 0o700 });
    const root = await realpath(this.importRoot);
    const finalDirectory = join(root, batchKey);
    if (
      !finalDirectory.startsWith(`${root}${sep}`)
      || await this.pathExists(finalDirectory)
      || await this.prisma.client.notificationRecipientImportBatch.findUnique({
        where: { batchKey },
        select: { id: true },
      })
    ) {
      throw new ConflictException(
        'NOTIFICATION_RECIPIENT_IMPORT_BATCH_KEY_ALREADY_EXISTS',
      );
    }

    const source = await readFile(file.path);
    const sourceChecksum = createHash('sha256').update(source).digest('hex');
    const duplicate = await this.prisma.client.notificationRecipientImportBatch.findUnique({
      where: { sourceChecksum },
      select: { batchKey: true },
    });
    if (duplicate) {
      throw new ConflictException({
        message: 'NOTIFICATION_RECIPIENT_IMPORT_BATCH_DUPLICATE_CONTENT',
        batchKey: duplicate.batchKey,
      });
    }

    const batch = await this.prisma.client.notificationRecipientImportBatch.create({
      data: {
        batchKey,
        status: 'UPLOADING',
        originalFilename: file.originalname,
        mimeType: file.mimetype || null,
        uploadedByUserId: userId,
      },
    });
    const stagingDirectory = join(
      root,
      `.${batchKey}.${randomUUID()}.uploading`,
    );
    try {
      await mkdir(stagingDirectory, { recursive: false, mode: 0o700 });
      const destination = join(stagingDirectory, STORED_FILENAME);
      await copyFile(file.path, destination);
      await chmod(destination, 0o600);
      await rename(stagingDirectory, finalDirectory);
      const readyBatch = await this.prisma.client.$transaction(async (tx) => {
        const ready = await tx.notificationRecipientImportBatch.update({
          where: { id: batch.id },
          data: {
            status: 'READY',
            sourceChecksum,
            byteSize: BigInt(file.size),
            readyAt: new Date(),
          },
          include: {
            uploadedBy: {
              select: { id: true, name: true, email: true },
            },
          },
        });
        await tx.notificationRecipientImportRun.updateMany({
          where: {
            sourceChecksum,
            batchId: null,
          },
          data: { batchId: batch.id },
        });
        return ready;
      });
      return {
        ...readyBatch,
        byteSize: Number(readyBatch.byteSize),
      };
    } catch (error) {
      await rm(stagingDirectory, { recursive: true, force: true });
      await rm(finalDirectory, { recursive: true, force: true });
      await this.prisma.client.notificationRecipientImportBatch.update({
        where: { id: batch.id },
        data: { status: 'INVALID' },
      }).catch(() => undefined);
      throw error;
    }
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }
}
