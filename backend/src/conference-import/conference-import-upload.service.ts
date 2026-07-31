import {
  BadRequestException,
  ConflictException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  copyFile,
  chmod,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  unlink,
} from 'node:fs/promises';
import { basename, dirname, extname, join, sep } from 'node:path';
import { PrismaService } from '../database/prisma.service';
import {
  CONFERENCE_IMPORT_UPLOAD_MAX_BATCH_BYTES,
  CONFERENCE_IMPORT_UPLOAD_MAX_FILES,
} from './conference-import-upload.constants';

export type ConferenceImportUploadFile = {
  originalname: string;
  mimetype: string;
  path: string;
  size: number;
};

type UploadBatchKind = 'LEGACY' | 'API_METADATA';

type ValidatedUploadFile = ConferenceImportUploadFile & {
  logicalPath: string;
  safeFilename: string;
  sha256: string;
};

const BATCH_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const SAFE_FILENAME_PATTERN = /^(?!\.)[^/\\\u0000-\u001f\u007f]{1,200}$/u;
const XLSX_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

@Injectable()
export class ConferenceImportUploadService {
  private readonly importRoot: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.importRoot = config.get<string>(
      'conferenceImport.root',
      '/app/imports/conference',
    );
  }

  async upload(
    userId: string,
    body: Record<string, unknown>,
    files: ConferenceImportUploadFile[],
  ) {
    try {
      const batchKey = this.parseBatchKey(body.batchKey);
      const kind = this.parseKind(body.kind);
      const validatedFiles = await this.validateFiles(kind, files);
      return await this.persistBatch(userId, batchKey, kind, validatedFiles);
    } finally {
      await Promise.allSettled(files.map(({ path }) => unlink(path)));
    }
  }

  private parseBatchKey(value: unknown): string {
    const batchKey = typeof value === 'string' ? value.trim() : '';
    if (!BATCH_KEY_PATTERN.test(batchKey)) {
      throw new BadRequestException('CONFERENCE_IMPORT_BATCH_KEY_INVALID');
    }
    return batchKey;
  }

  private parseKind(value: unknown): UploadBatchKind {
    if (value !== 'LEGACY' && value !== 'API_METADATA') {
      throw new BadRequestException('CONFERENCE_IMPORT_BATCH_KIND_INVALID');
    }
    return value;
  }

  private async validateFiles(
    kind: UploadBatchKind,
    files: ConferenceImportUploadFile[],
  ): Promise<ValidatedUploadFile[]> {
    if (files.length === 0) {
      throw new BadRequestException('CONFERENCE_IMPORT_UPLOAD_FILES_REQUIRED');
    }
    if (files.length > CONFERENCE_IMPORT_UPLOAD_MAX_FILES) {
      throw new PayloadTooLargeException('CONFERENCE_IMPORT_UPLOAD_TOO_MANY_FILES');
    }
    const totalByteSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalByteSize > CONFERENCE_IMPORT_UPLOAD_MAX_BATCH_BYTES) {
      throw new PayloadTooLargeException('CONFERENCE_IMPORT_UPLOAD_BATCH_TOO_LARGE');
    }

    const filenames = new Set<string>();
    const validated: ValidatedUploadFile[] = [];
    let manifestCount = 0;
    let excelCount = 0;

    for (const file of files) {
      const safeFilename = basename(file.originalname).normalize('NFC');
      const normalizedFilename = safeFilename.toLowerCase();
      if (
        safeFilename !== file.originalname
        || !SAFE_FILENAME_PATTERN.test(safeFilename)
        || filenames.has(normalizedFilename)
        || file.size <= 0
      ) {
        throw new BadRequestException('CONFERENCE_IMPORT_UPLOAD_FILENAME_INVALID');
      }
      filenames.add(normalizedFilename);

      const extension = extname(normalizedFilename);
      if (extension === '.xlsx') {
        await this.validateXlsx(file.path);
        excelCount += 1;
      } else if (normalizedFilename === 'conference_list.json') {
        if (kind !== 'LEGACY') {
          throw new BadRequestException('CONFERENCE_IMPORT_MANIFEST_KIND_INVALID');
        }
        await this.validateManifest(file.path);
        manifestCount += 1;
      } else {
        throw new BadRequestException('CONFERENCE_IMPORT_UPLOAD_FILE_TYPE_INVALID');
      }

      validated.push({
        ...file,
        safeFilename,
        logicalPath: normalizedFilename === 'conference_list.json'
          ? 'conference_list.json'
          : kind === 'LEGACY'
            ? `excel/${safeFilename}`
            : safeFilename,
        sha256: await this.calculateFileChecksum(file.path),
      });
    }

    if (excelCount === 0) {
      throw new BadRequestException('CONFERENCE_IMPORT_UPLOAD_EXCEL_REQUIRED');
    }
    if (kind === 'LEGACY' && manifestCount !== 1) {
      throw new BadRequestException('CONFERENCE_IMPORT_MANIFEST_REQUIRED');
    }
    return validated;
  }

  private async validateXlsx(path: string): Promise<void> {
    const handle = await open(path, 'r');
    try {
      const signature = Buffer.alloc(XLSX_SIGNATURE.length);
      const { bytesRead } = await handle.read(
        signature,
        0,
        XLSX_SIGNATURE.length,
        0,
      );
      if (
        bytesRead !== XLSX_SIGNATURE.length
        || !signature.equals(XLSX_SIGNATURE)
      ) {
        throw new BadRequestException('CONFERENCE_IMPORT_XLSX_SIGNATURE_INVALID');
      }
    } finally {
      await handle.close();
    }
  }

  private async validateManifest(path: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(path, 'utf8'));
    } catch {
      throw new BadRequestException('CONFERENCE_IMPORT_MANIFEST_JSON_INVALID');
    }
    if (
      typeof parsed !== 'object'
      || parsed === null
      || !Array.isArray(
        (parsed as { list_serialized_data_conference?: unknown })
          .list_serialized_data_conference,
      )
    ) {
      throw new BadRequestException('CONFERENCE_IMPORT_MANIFEST_SCHEMA_INVALID');
    }
  }

  private async calculateFileChecksum(path: string): Promise<string> {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path)) {
      hash.update(chunk as Buffer);
    }
    return hash.digest('hex');
  }

  private async calculateBatchChecksum(
    files: ValidatedUploadFile[],
  ): Promise<string> {
    const hash = createHash('sha256');
    for (const file of [...files].sort((a, b) => (
      a.logicalPath.localeCompare(b.logicalPath)
    ))) {
      hash.update(file.logicalPath.split('/').at(-1) ?? '');
      for await (const chunk of createReadStream(file.path)) {
        hash.update(chunk as Buffer);
      }
    }
    return hash.digest('hex');
  }

  private async persistBatch(
    userId: string,
    batchKey: string,
    kind: UploadBatchKind,
    files: ValidatedUploadFile[],
  ) {
    await mkdir(this.importRoot, { recursive: true, mode: 0o700 });
    const root = await realpath(this.importRoot);
    const finalDirectory = join(root, batchKey);
    if (!finalDirectory.startsWith(`${root}${sep}`) || await this.pathExists(finalDirectory)) {
      throw new ConflictException('CONFERENCE_IMPORT_BATCH_KEY_ALREADY_EXISTS');
    }
    const duplicateBatchKey = await this.prisma.client.conferenceImportBatch.findUnique({
      where: { batchKey },
      select: { id: true },
    });
    if (duplicateBatchKey) {
      throw new ConflictException('CONFERENCE_IMPORT_BATCH_KEY_ALREADY_EXISTS');
    }

    const sourceChecksum = await this.calculateBatchChecksum(files);
    const duplicateChecksum = await this.prisma.client.conferenceImportBatch.findUnique({
      where: { sourceChecksum },
      select: { batchKey: true },
    });
    if (duplicateChecksum) {
      throw new ConflictException({
        message: 'CONFERENCE_IMPORT_BATCH_DUPLICATE_CONTENT',
        batchKey: duplicateChecksum.batchKey,
      });
    }

    const batch = await this.prisma.client.conferenceImportBatch.create({
      data: {
        batchKey,
        kind,
        status: 'UPLOADING',
        uploadedByUserId: userId,
      },
    });

    const stagingDirectory = join(
      root,
      `.${batchKey}.${randomUUID()}.uploading`,
    );
    try {
      await mkdir(stagingDirectory, { recursive: false, mode: 0o700 });
      for (const file of files) {
        const destination = join(stagingDirectory, file.logicalPath);
        await mkdir(dirname(destination), { recursive: true });
        await copyFile(file.path, destination);
        await chmod(destination, 0o600);
      }
      await rename(stagingDirectory, finalDirectory);

      const fileCount = files.length;
      const excelCount = files.filter(({ safeFilename }) => (
        safeFilename.toLowerCase().endsWith('.xlsx')
      )).length;
      const totalByteSize = files.reduce((sum, file) => sum + file.size, 0);
      const readyAt = new Date();
      await this.prisma.client.$transaction(async (tx) => {
        await tx.conferenceImportBatchFile.createMany({
          data: files.map((file) => ({
            batchId: batch.id,
            logicalPath: file.logicalPath,
            originalFilename: file.originalname,
            mimeType: file.mimetype || null,
            byteSize: BigInt(file.size),
            sha256: file.sha256,
          })),
        });
        return tx.conferenceImportBatch.update({
          where: { id: batch.id },
          data: {
            status: 'READY',
            sourceChecksum,
            fileCount,
            excelCount,
            totalByteSize: BigInt(totalByteSize),
            hasManifest: files.some(({ safeFilename }) => (
              safeFilename.toLowerCase() === 'conference_list.json'
            )),
            readyAt,
          },
        });
      });
    } catch (error) {
      await rm(stagingDirectory, { recursive: true, force: true });
      await rm(finalDirectory, { recursive: true, force: true });
      await this.prisma.client.conferenceImportBatch.update({
        where: { id: batch.id },
        data: { status: 'INVALID' },
      }).catch(() => undefined);
      throw error;
    }
    const readyBatch = await this.prisma.client.conferenceImportBatch.findUniqueOrThrow({
      where: { id: batch.id },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
        files: {
          orderBy: { logicalPath: 'asc' },
        },
      },
    });
    return this.batchResponse(readyBatch);
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }

  private batchResponse<T extends {
    totalByteSize: bigint;
    files?: Array<{ byteSize: bigint; logicalPath: string }>;
  }>(batch: T) {
    return {
      ...batch,
      source: 'ADMIN_UPLOAD' as const,
      sourceFiles: batch.files?.map(({ logicalPath }) => logicalPath) ?? [],
      totalByteSize: Number(batch.totalByteSize),
      files: batch.files?.map((file) => ({
        ...file,
        byteSize: Number(file.byteSize),
      })),
    };
  }
}
