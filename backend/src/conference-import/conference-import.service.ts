import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { PrismaService } from '../database/prisma.service';
import type { CreateConferenceImportDto } from './dto/create-conference-import.dto';
import { ConferenceExcelReaderService } from './conference-excel-reader.service';
import type { ConferenceImportIssueDraft } from './conference-import.types';
import { ConferenceImportApplyService } from './conference-import-apply.service';
import {
  LEGACY_COMMENT_PROFILE,
  LegacyCommentImportService,
} from './legacy-comment-import.service';

@Injectable()
export class ConferenceImportService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConferenceImportService.name);
  private readonly importRoot: string;
  private readonly pollIntervalMs: number;
  private readonly maxIssuesPerRun: number;
  private timer?: NodeJS.Timeout;
  private busy = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly excelReader: ConferenceExcelReaderService,
    private readonly applyService: ConferenceImportApplyService,
    private readonly legacyCommentImport: LegacyCommentImportService,
    config: ConfigService,
  ) {
    this.importRoot = config.get<string>(
      'conferenceImport.root',
      '/app/imports/conference',
    );
    this.pollIntervalMs = config.get<number>(
      'conferenceImport.pollIntervalMs',
      5000,
    );
    this.maxIssuesPerRun = config.get<number>(
      'conferenceImport.maxIssuesPerRun',
      1000,
    );
  }

  async onModuleInit(): Promise<void> {
    await this.prisma.client.conferenceImportRun.updateMany({
      where: { status: 'RUNNING', finishedAt: null },
      data: { status: 'PENDING' },
    });
    this.timer = setInterval(() => void this.processNextImport(), this.pollIntervalMs);
    this.timer.unref();
    void this.processNextImport();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async createDryRun(userId: string, dto: CreateConferenceImportDto) {
    const batchDirectory = await this.resolveBatchDirectory(dto.batchKey);
    const files = await this.listSourceFiles(batchDirectory);
    const sourceChecksum = await this.calculateChecksum(files);
    const uploadedBatch = await this.prisma.client.conferenceImportBatch.findUnique({
      where: { batchKey: dto.batchKey },
      select: { id: true },
    });
    const existing = await this.prisma.client.conferenceImportRun.findUnique({
      where: {
        sourceChecksum_profileVersion_mode: {
          sourceChecksum,
          profileVersion: dto.profileVersion,
          mode: 'DRY_RUN',
        },
      },
    });
    if (existing) {
      if (uploadedBatch && !existing.batchId) {
        existing.batchId = uploadedBatch.id;
        await this.prisma.client.conferenceImportRun.update({
          where: { id: existing.id },
          data: { batchId: uploadedBatch.id },
        });
      }
      if (existing.status === 'FAILED' || existing.status === 'PARTIAL') {
        await this.prisma.client.$transaction([
          this.prisma.client.conferenceImportIssue.deleteMany({
            where: { runId: existing.id },
          }),
          this.prisma.client.conferenceImportRun.update({
            where: { id: existing.id },
            data: {
              status: 'PENDING',
              insertedCount: 0,
              updatedCount: 0,
              skippedCount: 0,
              errorCount: 0,
              finishedAt: null,
            },
          }),
        ]);
        return this.prisma.client.conferenceImportRun.findUnique({
          where: { id: existing.id },
        });
      }
      return existing;
    }

    try {
      return await this.prisma.client.conferenceImportRun.create({
        data: {
          batchId: uploadedBatch?.id,
          mode: 'DRY_RUN',
          status: 'PENDING',
          batchKey: dto.batchKey,
          profileVersion: dto.profileVersion,
          sourceChecksum,
          idempotencyKey: dto.idempotencyKey,
          startedByUserId: userId,
        },
      });
    } catch (error) {
      if (dto.idempotencyKey) {
        const duplicate = await this.prisma.client.conferenceImportRun.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (
          duplicate
          && duplicate.sourceChecksum === sourceChecksum
          && duplicate.profileVersion === dto.profileVersion
          && duplicate.mode === 'DRY_RUN'
        ) {
          return duplicate;
        }
      }
      throw new ConflictException({
        message: 'CONFERENCE_IMPORT_CREATE_CONFLICT',
        detail: error instanceof Error ? error.message : 'Unknown database error',
      });
    }
  }

  async createApply(userId: string, dto: CreateConferenceImportDto) {
    const batchDirectory = await this.resolveBatchDirectory(dto.batchKey);
    const files = await this.listSourceFiles(batchDirectory);
    const sourceChecksum = await this.calculateChecksum(files);
    const uploadedBatch = await this.prisma.client.conferenceImportBatch.findUnique({
      where: { batchKey: dto.batchKey },
      select: { id: true },
    });
    const dryRun = await this.prisma.client.conferenceImportRun.findUnique({
      where: {
        sourceChecksum_profileVersion_mode: {
          sourceChecksum,
          profileVersion: dto.profileVersion,
          mode: 'DRY_RUN',
        },
      },
    });
    if (!dryRun || dryRun.status !== 'COMPLETED' || dryRun.errorCount !== 0) {
      throw new ConflictException('CONFERENCE_IMPORT_SUCCESSFUL_DRY_RUN_REQUIRED');
    }
    const existing = await this.prisma.client.conferenceImportRun.findUnique({
      where: {
        sourceChecksum_profileVersion_mode: {
          sourceChecksum,
          profileVersion: dto.profileVersion,
          mode: 'APPLY',
        },
      },
    });
    if (existing) {
      if (uploadedBatch && !existing.batchId) {
        existing.batchId = uploadedBatch.id;
        await this.prisma.client.conferenceImportRun.update({
          where: { id: existing.id },
          data: { batchId: uploadedBatch.id },
        });
      }
      if (existing.status === 'FAILED' || existing.status === 'PARTIAL') {
        await this.prisma.client.$transaction([
          this.prisma.client.conferenceImportIssue.deleteMany({
            where: { runId: existing.id },
          }),
          this.prisma.client.conferenceImportRun.update({
            where: { id: existing.id },
            data: {
              status: 'PENDING',
              insertedCount: 0,
              updatedCount: 0,
              skippedCount: 0,
              errorCount: 0,
              finishedAt: null,
            },
          }),
        ]);
        return this.prisma.client.conferenceImportRun.findUnique({
          where: { id: existing.id },
        });
      }
      return existing;
    }

    try {
      return await this.prisma.client.conferenceImportRun.create({
        data: {
          batchId: uploadedBatch?.id,
          mode: 'APPLY',
          status: 'PENDING',
          batchKey: dto.batchKey,
          profileVersion: dto.profileVersion,
          sourceChecksum,
          idempotencyKey: dto.idempotencyKey,
          startedByUserId: userId,
        },
      });
    } catch (error) {
      if (dto.idempotencyKey) {
        const duplicate = await this.prisma.client.conferenceImportRun.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (
          duplicate
          && duplicate.sourceChecksum === sourceChecksum
          && duplicate.profileVersion === dto.profileVersion
          && duplicate.mode === 'APPLY'
        ) {
          return duplicate;
        }
      }
      throw new ConflictException({
        message: 'CONFERENCE_IMPORT_CREATE_CONFLICT',
        detail: error instanceof Error ? error.message : 'Unknown database error',
      });
    }
  }

  async getRun(runId: string) {
    const run = await this.prisma.client.conferenceImportRun.findUnique({
      where: { id: runId },
      include: {
        issues: {
          orderBy: [{ sourceFile: 'asc' }, { rowNumber: 'asc' }],
          take: this.maxIssuesPerRun,
        },
      },
    });
    if (!run) throw new NotFoundException('CONFERENCE_IMPORT_RUN_NOT_FOUND');
    return this.runResponse(run);
  }

  async listRuns(limit: number) {
    const runs = await this.prisma.client.conferenceImportRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: {
        startedBy: {
          select: { id: true, name: true, email: true },
        },
        _count: { select: { issues: true } },
      },
    });
    return runs.map((run) => this.runResponse(run));
  }

  async listBatches() {
    const uploadedBatches = await this.prisma.client.conferenceImportBatch.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
        files: {
          orderBy: { logicalPath: 'asc' },
        },
      },
    });
    const uploadedBatchKeys = new Set(uploadedBatches.map(({ batchKey }) => batchKey));
    const persisted = uploadedBatches
      .filter(({ status }) => status === 'READY')
      .map((batch) => ({
        id: batch.id,
        batchKey: batch.batchKey,
        kind: batch.kind,
        status: batch.status,
        source: 'ADMIN_UPLOAD' as const,
        sourceChecksum: batch.sourceChecksum,
        fileCount: batch.fileCount,
        excelCount: batch.excelCount,
        totalByteSize: Number(batch.totalByteSize),
        hasManifest: batch.hasManifest,
        sourceFiles: batch.files.map(({ logicalPath }) => logicalPath),
        uploadedBy: batch.uploadedBy,
        createdAt: batch.createdAt,
        readyAt: batch.readyAt,
      }));
    let root: string;
    try {
      root = await realpath(this.importRoot);
    } catch {
      return persisted;
    }
    const entries = await readdir(root, { withFileTypes: true });
    const batches: Array<{
      batchKey: string;
      fileCount: number;
      excelCount: number;
      hasManifest: boolean;
      sourceFiles: string[];
    }> = [];
    for (const entry of entries.filter((item) => item.isDirectory())) {
      if (uploadedBatchKeys.has(entry.name) || entry.name.startsWith('.')) continue;
      const directory = join(root, entry.name);
      const sourceFiles = (await this.collectSourceFiles(directory))
        .map((file) => relative(directory, file))
        .sort();
      if (sourceFiles.length === 0) continue;
      batches.push({
        batchKey: entry.name,
        fileCount: sourceFiles.length,
        excelCount: sourceFiles.filter((file) => file.toLowerCase().endsWith('.xlsx')).length,
        hasManifest: sourceFiles.includes('conference_list.json'),
        sourceFiles,
      });
    }
    return [
      ...persisted,
      ...batches
        .sort((a, b) => a.batchKey.localeCompare(b.batchKey))
        .map((batch) => ({
          ...batch,
          kind: batch.hasManifest ? 'LEGACY' as const : 'API_METADATA' as const,
          status: 'READY' as const,
          source: 'FILESYSTEM' as const,
          totalByteSize: null,
          sourceChecksum: null,
          uploadedBy: null,
          createdAt: null,
          readyAt: null,
        })),
    ];
  }

  private async processNextImport(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const pending = await this.prisma.client.conferenceImportRun.findFirst({
        where: { status: 'PENDING' },
        orderBy: { startedAt: 'asc' },
      });
      if (!pending) return;
      const claimed = await this.prisma.client.conferenceImportRun.updateMany({
        where: { id: pending.id, status: 'PENDING' },
        data: { status: 'RUNNING' },
      });
      if (claimed.count !== 1) return;
      if (pending.mode === 'DRY_RUN') {
        await this.executeDryRun(pending.id, pending.batchKey, pending.profileVersion);
      } else {
        await this.executeApply(pending.id, pending.batchKey, pending.profileVersion);
      }
    } catch {
      this.logger.error('Conference import worker failed before run execution');
    } finally {
      this.busy = false;
    }
  }

  private async executeApply(
    runId: string,
    batchKey: string,
    profileVersion: string,
  ): Promise<void> {
    this.logger.log(`Conference import APPLY started run=${runId} batch=${batchKey}`);
    try {
      const batchDirectory = await this.resolveBatchDirectory(batchKey);
      const files = await this.listSourceFiles(batchDirectory);
      const result = profileVersion === LEGACY_COMMENT_PROFILE
        ? await this.legacyCommentImport.apply(files)
        : await this.applyService.apply(files);
      const persistedIssues = result.issues.slice(0, this.maxIssuesPerRun);
      if (persistedIssues.length > 0) {
        await this.prisma.client.conferenceImportIssue.createMany({
          data: persistedIssues.map((issue) => ({ ...issue, runId })),
        });
      }
      const errorCount = result.issues.filter((issue) => issue.severity === 'ERROR').length;
      await this.prisma.client.conferenceImportRun.update({
        where: { id: runId },
        data: {
          status: errorCount > 0 ? 'PARTIAL' : 'COMPLETED',
          insertedCount: result.insertedCount,
          updatedCount: result.updatedCount,
          skippedCount: result.skippedCount,
          errorCount,
          finishedAt: new Date(),
        },
      });
      this.logger.log(
        `Conference import APPLY completed run=${runId} batch=${batchKey}`,
      );
    } catch (error) {
      await this.prisma.client.conferenceImportIssue.create({
        data: {
          runId,
          sourceFile: batchKey,
          rowNumber: null,
          entityType: 'RUN',
          severity: 'ERROR',
          errorCode: 'APPLY_FAILED',
          message: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown error',
        },
      });
      await this.prisma.client.conferenceImportRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          errorCount: 1,
          finishedAt: new Date(),
        },
      });
      this.logger.error(
        `Conference import APPLY failed run=${runId} batch=${batchKey}`,
      );
    }
  }

  private async executeDryRun(
    runId: string,
    batchKey: string,
    profileVersion: string,
  ): Promise<void> {
    const issues: ConferenceImportIssueDraft[] = [];
    let rowCount = 0;
    try {
      const batchDirectory = await this.resolveBatchDirectory(batchKey);
      const files = await this.listSourceFiles(batchDirectory);
      if (profileVersion === LEGACY_COMMENT_PROFILE) {
        const result = await this.legacyCommentImport.inspect(files);
        const persistedIssues = result.issues.slice(0, this.maxIssuesPerRun);
        if (persistedIssues.length > 0) {
          await this.prisma.client.conferenceImportIssue.createMany({
            data: persistedIssues.map((issue) => ({ ...issue, runId })),
          });
        }
        const errorCount = result.issues.filter(
          ({ severity }) => severity === 'ERROR',
        ).length;
        await this.prisma.client.conferenceImportRun.update({
          where: { id: runId },
          data: {
            status: errorCount > 0 ? 'PARTIAL' : 'COMPLETED',
            insertedCount: result.insertedCount,
            updatedCount: 0,
            skippedCount: result.inspectedCount,
            errorCount,
            finishedAt: new Date(),
          },
        });
        return;
      }
      const conferenceTitles = new Set(
        (await this.prisma.client.conference.findMany({
          where: { deletedAt: null },
          select: { title: true },
        })).map((conference) => conference.title),
      );
      for (const title of await this.loadManifestTitles(files)) {
        conferenceTitles.add(title);
      }

      for (const file of files.filter((item) => item.toLowerCase().endsWith('.xlsx'))) {
        const inspection = await this.excelReader.inspect(file);
        rowCount += inspection.rowCount;
        issues.push(...inspection.issues);
        if (inspection.skippedParticipationColumns.length > 0) {
          issues.push({
            sourceFile: inspection.sourceFile,
            rowNumber: 1,
            entityType: 'HEADER',
            severity: 'WARNING',
            errorCode: 'LEGACY_PARTICIPATION_COLUMNS_IGNORED',
            message: 'Legacy bookmark/comment fields are intentionally excluded.',
            sourceSnapshot: {
              columnCount: inspection.skippedParticipationColumns.length,
            },
          });
        }
        if (inspection.conferenceKey && !conferenceTitles.has(inspection.conferenceKey)) {
          issues.push({
            sourceFile: inspection.sourceFile,
            rowNumber: null,
            entityType: 'CONFERENCE',
            severity: 'ERROR',
            errorCode: 'CONFERENCE_EXACT_MATCH_NOT_FOUND',
            message: `No active Conference matches exact key ${inspection.conferenceKey}.`,
            sourceSnapshot: { conferenceKey: inspection.conferenceKey },
          });
        }
      }

      const persistedIssues = issues.slice(0, this.maxIssuesPerRun);
      if (persistedIssues.length > 0) {
        await this.prisma.client.conferenceImportIssue.createMany({
          data: persistedIssues.map((issue) => ({ ...issue, runId })),
        });
      }
      const errorCount = issues.filter((issue) => issue.severity === 'ERROR').length;
      await this.prisma.client.conferenceImportRun.update({
        where: { id: runId },
        data: {
          status: errorCount > 0 ? 'PARTIAL' : 'COMPLETED',
          skippedCount: rowCount,
          errorCount,
          insertedCount: 0,
          updatedCount: 0,
          finishedAt: new Date(),
        },
      });
    } catch (error) {
      await this.prisma.client.conferenceImportIssue.create({
        data: {
          runId,
          sourceFile: batchKey,
          rowNumber: null,
          entityType: 'RUN',
          severity: 'ERROR',
          errorCode: 'DRY_RUN_FAILED',
          message: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown error',
        },
      });
      await this.prisma.client.conferenceImportRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          skippedCount: rowCount,
          errorCount: 1,
          finishedAt: new Date(),
        },
      });
    }
  }

  private async resolveBatchDirectory(batchKey: string): Promise<string> {
    const uploadedBatch = await this.prisma.client.conferenceImportBatch.findUnique({
      where: { batchKey },
      select: { status: true },
    });
    if (uploadedBatch && uploadedBatch.status !== 'READY') {
      throw new NotFoundException('CONFERENCE_IMPORT_BATCH_NOT_READY');
    }
    let root: string;
    let batch: string;
    try {
      root = await realpath(this.importRoot);
      batch = await realpath(join(root, batchKey));
    } catch {
      throw new NotFoundException('CONFERENCE_IMPORT_BATCH_NOT_FOUND');
    }
    if (!batch.startsWith(`${root}${sep}`) || !(await stat(batch)).isDirectory()) {
      throw new NotFoundException('CONFERENCE_IMPORT_BATCH_NOT_FOUND');
    }
    return batch;
  }

  private async listSourceFiles(batchDirectory: string): Promise<string[]> {
    const files = (await this.collectSourceFiles(batchDirectory)).sort();
    if (files.length === 0) {
      throw new NotFoundException('CONFERENCE_IMPORT_SOURCE_NOT_FOUND');
    }
    return files;
  }

  private async collectSourceFiles(
    directory: string,
    depth = 0,
  ): Promise<string[]> {
    if (depth > 2) return [];
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        files.push(...await this.collectSourceFiles(path, depth + 1));
        continue;
      }
      if (!entry.isFile()) continue;
      if (
        entry.name.toLowerCase().endsWith('.xlsx')
        || entry.name === 'conference_list.json'
      ) {
        files.push(path);
      }
    }
    return files;
  }

  private runResponse<T extends {
    mode: string;
    skippedCount: number;
  }>(run: T) {
    if (run.mode !== 'DRY_RUN') {
      return { ...run, inspectedCount: 0 };
    }
    return {
      ...run,
      inspectedCount: run.skippedCount,
      skippedCount: 0,
    };
  }

  private async calculateChecksum(files: string[]): Promise<string> {
    const hash = createHash('sha256');
    for (const file of files) {
      hash.update(file.split(sep).at(-1) ?? '');
      for await (const chunk of createReadStream(file)) {
        hash.update(chunk as Buffer);
      }
    }
    return hash.digest('hex');
  }

  private async loadManifestTitles(files: string[]): Promise<string[]> {
    const manifestPath = files.find((file) => file.endsWith(`${sep}conference_list.json`));
    if (!manifestPath) return [];
    const parsed = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      list_serialized_data_conference?: Array<{ title?: unknown }>;
    };
    if (!Array.isArray(parsed.list_serialized_data_conference)) {
      throw new Error('CONFERENCE_MANIFEST_INVALID');
    }
    const titles: string[] = [];
    const seen = new Set<string>();
    for (const conference of parsed.list_serialized_data_conference) {
      const title = typeof conference.title === 'string' ? conference.title.trim() : '';
      const item = conference as {
        id?: unknown;
        abbreviation?: unknown;
        year?: unknown;
      };
      if (
        !title
        || !Number.isInteger(Number(item.id))
        || typeof item.abbreviation !== 'string'
        || !item.abbreviation.trim()
        || !Number.isInteger(Number(item.year))
        || seen.has(title)
      ) {
        throw new Error('CONFERENCE_MANIFEST_ROW_INVALID');
      }
      seen.add(title);
      titles.push(title);
    }
    return titles;
  }
}
