import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { basename, sep } from 'node:path';
import { PrismaService } from '../database/prisma.service';
import { DEFAULT_ORGANIZATION_ID } from '../authorization/team-membership-sync.service';
import { ConferenceMediaService } from '../conference-media/conference-media.service';
import {
  ConferenceExcelReaderService,
  parseConferenceExcelSource,
} from './conference-excel-reader.service';
import type {
  ConferenceExcelProfile,
  ConferenceExcelRow,
  ConferenceImportIssueDraft,
} from './conference-import.types';

type ApplyResult = {
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  issues: ConferenceImportIssueDraft[];
};

type ConferenceRef = {
  id: string;
  title: string;
  abbreviation: string;
  year: number;
};

const nullable = (value: string | undefined): string | null => {
  const trimmed = value?.trim() ?? '';
  return ['', 'null', 'none', 'undefined', 'nan'].includes(trimmed.toLowerCase())
    ? null
    : trimmed;
};

const integer = (value: string | undefined): number | null => {
  const normalized = nullable(value);
  if (normalized === null) return null;
  const parsed = Number(normalized);
  return Number.isInteger(parsed) ? parsed : null;
};

const date = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const jsonValue = (value: string | undefined): any => {
  const normalized = nullable(value);
  if (normalized === null) return undefined;
  try {
    return JSON.parse(normalized);
  } catch {
    return normalized.includes(',')
      ? normalized.split(',').map((item) => item.trim()).filter(Boolean)
      : normalized;
  }
};

const contentValue = (value: string | undefined): any => {
  const normalized = nullable(value);
  if (normalized === null) return undefined;
  try {
    return JSON.parse(normalized);
  } catch {
    return normalized;
  }
};

const stringListValue = (value: string | undefined): string[] => {
  const normalized = nullable(value);
  if (normalized === null) return [];
  try {
    const parsed = JSON.parse(normalized);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
      : [];
  } catch {
    return normalized
      .split(',')
      .map((item) => item.trim().replace(/^[\[\]'"]+|[\[\]'"]+$/g, '').trim())
      .filter(Boolean);
  }
};

const legacyAssetKindByColumn = {
  poster: 'POSTER',
  document: 'DOCUMENT',
  video: 'VIDEO',
} as const;

const legacyAssetFolderByKind: Record<string, string> = {
  POSTER: 'poster',
  DOCUMENT: 'document',
  VIDEO: 'video',
  REFERENCE_IMAGE: 'reference_image',
};

const legacyAssetSource = (
  source: string,
  conference: ConferenceRef,
  kind: string,
): string => {
  if (source.startsWith('/') || /^https?:\/\//i.test(source)) return source;
  const folder = legacyAssetFolderByKind[kind];
  return folder
    ? `/media/conference/${conference.abbreviation.toLowerCase()}/${conference.year}/${folder}/${source}`
    : source;
};

@Injectable()
export class ConferenceImportApplyService {
  private readonly logger = new Logger(ConferenceImportApplyService.name);
  private readonly chunkSize: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly excelReader: ConferenceExcelReaderService,
    private readonly conferenceMedia: ConferenceMediaService,
    config: ConfigService,
  ) {
    this.chunkSize = Math.max(
      10,
      Math.min(200, config.get<number>('conferenceImport.chunkSize', 50)),
    );
  }

  async apply(files: string[]): Promise<ApplyResult> {
    const result: ApplyResult = {
      insertedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      issues: [],
    };
    await this.upsertManifest(files, result);

    const sources = files
      .filter((file) => file.toLowerCase().endsWith('.xlsx'))
      .map((file) => ({ file, source: parseConferenceExcelSource(basename(file)) }))
      .filter((item) => item.source !== null);
    const detailSources = sources.filter((item) => (
      item.source!.profile === 'LEGACY_EXPORT' || item.source!.profile === 'DETAIL'
    ));
    const assetSources = sources.filter((item) => (
      item.source!.profile !== 'LEGACY_EXPORT' && item.source!.profile !== 'DETAIL'
    ));

    for (const item of detailSources) {
      const conference = await this.findConference(item.source!.conferenceKey);
      if (!conference) {
        result.issues.push(this.missingConferenceIssue(item.file, item.source!.conferenceKey));
        continue;
      }
      await this.applyDetailFile(
        item.file,
        item.source!.profile,
        conference,
        result,
      );
    }
    for (const item of assetSources) {
      const conference = await this.findConference(item.source!.conferenceKey);
      if (!conference) {
        result.issues.push(this.missingConferenceIssue(item.file, item.source!.conferenceKey));
        continue;
      }
      await this.applyAssetFile(
        item.file,
        item.source!.profile,
        conference,
        result,
      );
    }
    return result;
  }

  private async upsertManifest(files: string[], result: ApplyResult): Promise<void> {
    const manifestPath = files.find((file) => file.endsWith(`${sep}conference_list.json`));
    if (!manifestPath) return;
    const parsed = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      list_serialized_data_conference?: Array<Record<string, unknown>>;
    };
    if (!Array.isArray(parsed.list_serialized_data_conference)) {
      throw new Error('CONFERENCE_MANIFEST_INVALID');
    }

    for (const item of parsed.list_serialized_data_conference) {
      const legacyId = typeof item.id === 'number' ? item.id : Number(item.id);
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      const abbreviation = typeof item.abbreviation === 'string'
        ? item.abbreviation.trim()
        : '';
      const year = typeof item.year === 'number' ? item.year : Number(item.year);
      if (!Number.isInteger(legacyId) || !title || !abbreviation || !Number.isInteger(year)) {
        result.issues.push({
          sourceFile: basename(manifestPath),
          rowNumber: null,
          entityType: 'CONFERENCE',
          severity: 'ERROR',
          errorCode: 'CONFERENCE_MANIFEST_ROW_INVALID',
          message: 'Conference id, title, abbreviation and year are required.',
          sourceSnapshot: { title },
        });
        continue;
      }
      const existing = await this.prisma.client.conference.findUnique({
        where: {
          sourceSystem_legacyId: {
            sourceSystem: 'LEGACY_DJANGO',
            legacyId,
          },
        },
        select: { id: true, deletedAt: true },
      });
      if (existing?.deletedAt) {
        result.issues.push({
          sourceFile: basename(manifestPath),
          rowNumber: null,
          entityType: 'CONFERENCE',
          severity: 'WARNING',
          errorCode: 'SOFT_DELETED_CONFERENCE_SKIPPED',
          message: 'A soft-deleted Conference was not restored by import.',
          sourceSnapshot: { legacyId, title },
        });
        result.skippedCount += 1;
        continue;
      }
      const isNotOpened = title === 'ESMO_2026';
      const conference = await this.prisma.client.conference.upsert({
        where: {
          sourceSystem_legacyId: {
            sourceSystem: 'LEGACY_DJANGO',
            legacyId,
          },
        },
        create: {
          organizationId: DEFAULT_ORGANIZATION_ID,
          legacyId,
          sourceSystem: 'LEGACY_DJANGO',
          status: isNotOpened ? 'NOT_OPENED' : 'OPEN',
          title,
          abbreviation,
          fullTitle: typeof item.full_title === 'string' ? item.full_title : null,
          year,
          sourceUrl: typeof item.url === 'string' ? item.url : null,
          dateStart: isNotOpened ? null : date(item.date_start),
          dateEnd: isNotOpened ? null : date(item.date_end),
        },
        update: {
          status: isNotOpened ? 'NOT_OPENED' : 'OPEN',
          title,
          abbreviation,
          fullTitle: typeof item.full_title === 'string' ? item.full_title : null,
          year,
          sourceUrl: typeof item.url === 'string' ? item.url : null,
          dateStart: isNotOpened ? null : date(item.date_start),
          dateEnd: isNotOpened ? null : date(item.date_end),
        },
      });
      if (existing) result.updatedCount += 1;
      else result.insertedCount += 1;

      if (typeof item.logo === 'string' && item.logo.trim()) {
        await this.upsertAsset(
          'CONFERENCE',
          conference.id,
          'LOGO',
          item.logo,
          manifestPath,
          null,
          result,
        );
      }
    }
  }

  private async applyDetailFile(
    file: string,
    profile: ConferenceExcelProfile,
    conference: ConferenceRef,
    result: ApplyResult,
  ): Promise<void> {
    let chunk: ConferenceExcelRow[] = [];
    let processedRows = 0;
    this.logger.log(`Conference import detail started file=${basename(file)}`);
    for await (const row of this.excelReader.rows(file)) {
      chunk.push(row);
      if (chunk.length >= this.chunkSize) {
        await this.flushDetailChunk(file, profile, conference, chunk, result);
        processedRows += chunk.length;
        if (processedRows % 1000 === 0) {
          this.logger.log(
            `Conference import detail progress file=${basename(file)} rows=${processedRows}`,
          );
        }
        chunk = [];
      }
    }
    if (chunk.length > 0) {
      await this.flushDetailChunk(file, profile, conference, chunk, result);
      processedRows += chunk.length;
    }
    this.logger.log(
      `Conference import detail completed file=${basename(file)} rows=${processedRows}`,
    );
  }

  private async flushDetailChunk(
    file: string,
    profile: ConferenceExcelProfile,
    conference: ConferenceRef,
    rows: ConferenceExcelRow[],
    result: ApplyResult,
  ): Promise<void> {
    const prepared = rows.map((row) => {
      const legacyId = profile === 'LEGACY_EXPORT' ? integer(row.values.id) : null;
      const sourceUrl = nullable(
        profile === 'LEGACY_EXPORT' ? row.values.url : row.values.abstract_url,
      );
      return { row, legacyId, sourceUrl };
    });
    const valid = prepared.filter((item) => (
      profile === 'LEGACY_EXPORT' ? item.legacyId !== null : item.sourceUrl !== null
    ));
    result.skippedCount += prepared.length - valid.length;

    const legacyIds = valid.flatMap((item) => item.legacyId === null ? [] : [item.legacyId]);
    const sourceUrls = valid.flatMap((item) => item.sourceUrl === null ? [] : [item.sourceUrl]);
    const existing = await this.prisma.client.conferenceAbstract.findMany({
      where: profile === 'LEGACY_EXPORT'
        ? { sourceSystem: 'LEGACY_DJANGO', legacyId: { in: legacyIds } }
        : { conferenceId: conference.id, sourceUrl: { in: sourceUrls } },
      select: { id: true, legacyId: true, sourceUrl: true, deletedAt: true },
    });
    const existingByKey = new Map(existing.map((item) => [
      profile === 'LEGACY_EXPORT' ? String(item.legacyId) : item.sourceUrl!,
      item.id,
    ]));
    const deletedKeys = new Set(existing
      .filter((item) => item.deletedAt)
      .map((item) => (
        profile === 'LEGACY_EXPORT' ? String(item.legacyId) : item.sourceUrl!
      )));
    const applicable = valid.filter((item) => {
      const key = profile === 'LEGACY_EXPORT' ? String(item.legacyId) : item.sourceUrl!;
      if (!deletedKeys.has(key)) return true;
      result.issues.push({
        sourceFile: basename(file),
        rowNumber: item.row.rowNumber,
        entityType: 'ABSTRACT',
        severity: 'WARNING',
        errorCode: 'SOFT_DELETED_ABSTRACT_SKIPPED',
        message: 'A soft-deleted Abstract was not restored by import.',
        sourceSnapshot: {
          legacyId: item.legacyId,
          sourceUrl: item.sourceUrl,
        },
      });
      result.skippedCount += 1;
      return false;
    });

    const operations = applicable.map((item) => {
      const values = item.row.values;
      const data = this.abstractData(values, conference.id, item.sourceUrl);
      const key = profile === 'LEGACY_EXPORT' ? String(item.legacyId) : item.sourceUrl!;
      const existingId = existingByKey.get(key);
      return existingId
        ? this.prisma.client.conferenceAbstract.update({
          where: { id: existingId },
          data: {
            ...data,
            ...(profile === 'LEGACY_EXPORT'
              ? { legacyId: item.legacyId, sourceSystem: 'LEGACY_DJANGO' }
              : {}),
          },
          select: { id: true },
        })
        : this.prisma.client.conferenceAbstract.create({
          data: {
            ...data,
            legacyId: item.legacyId,
            sourceSystem: profile === 'LEGACY_EXPORT'
              ? 'LEGACY_DJANGO'
              : 'CONFERENCE_EXCEL',
          },
          select: { id: true },
        });
    });
    const applied = operations.length > 0
      ? await this.prisma.client.$transaction(operations)
      : [];

    applied.forEach((_abstract, index) => {
      const item = applicable[index];
      const key = profile === 'LEGACY_EXPORT' ? String(item.legacyId) : item.sourceUrl!;
      if (existingByKey.has(key)) result.updatedCount += 1;
      else result.insertedCount += 1;
    });
    for (let index = 0; index < applied.length; index += 1) {
      await this.mergeInlineAssets(
        applied[index].id,
        applicable[index].row,
        conference,
        result,
        file,
      );
    }
  }

  private abstractData(
    values: Record<string, string>,
    conferenceId: string,
    sourceUrl: string | null,
  ) {
    return {
      conferenceId,
      title: nullable(values.title) ?? '(Untitled Abstract)',
      sourceUrl,
      firstAuthorName: nullable(values.first_author_name),
      firstAuthorOrganization:
        nullable(values.first_author_organization)
        ?? nullable(values.first_author_org),
      firstAuthorUrl: nullable(values.first_author_url),
      authors: jsonValue(values.authors),
      authorOrganizations: jsonValue(values.list_dict_author_organization),
      organizations: jsonValue(values.organizations),
      contents: contentValue(
        nullable(values.contents) ?? nullable(values.content) ?? undefined,
      ),
      meeting: nullable(values.meeting),
      meetingUrl: nullable(values.meeting_url),
      sessionType: nullable(values.session_type),
      sessionTypeUrl: nullable(values.session_type_url),
      sessionTitle: nullable(values.session_title),
      sessionTitleUrl: nullable(values.session_title_url),
      track: nullable(values.track),
      trackUrl: nullable(values.track_url),
      subTrack: nullable(values.sub_track),
      subTrackUrl: nullable(values.sub_track_url),
      abstractNumber: nullable(values.abstract_number),
      posterNumber: nullable(values.poster_number),
      clinicalTrialRegistrationNumber: nullable(values.clinical_trial_registration_number),
      dateOpen: date(values.date_open),
    };
  }

  private async mergeInlineAssets(
    abstractId: string,
    row: ConferenceExcelRow,
    conference: ConferenceRef,
    result: ApplyResult,
    file: string,
  ): Promise<void> {
    for (const [column, kind] of Object.entries(legacyAssetKindByColumn)) {
      const source = nullable(row.values[column] ?? row.values[`${column}_url`]);
      if (source) {
        await this.upsertAsset(
          'ABSTRACT',
          abstractId,
          kind,
          legacyAssetSource(source, conference, kind),
          file,
          row.rowNumber,
          result,
        );
      }
    }
    const referenceImages = stringListValue(row.values.list_reference_image);
    for (const image of referenceImages) {
      await this.upsertAsset(
        'ABSTRACT',
        abstractId,
        'REFERENCE_IMAGE',
        legacyAssetSource(image, conference, 'REFERENCE_IMAGE'),
        file,
        row.rowNumber,
        result,
      );
    }
  }

  private async applyAssetFile(
    file: string,
    profile: ConferenceExcelProfile,
    conference: ConferenceRef,
    result: ApplyResult,
  ): Promise<void> {
    const kind = profile;
    let processedRows = 0;
    this.logger.log(`Conference import asset started file=${basename(file)}`);
    for await (const row of this.excelReader.rows(file)) {
      processedRows += 1;
      if (processedRows % 1000 === 0) {
        this.logger.log(
          `Conference import asset progress file=${basename(file)} rows=${processedRows}`,
        );
      }
      const abstractUrl = nullable(row.values.abstract_url);
      const source = nullable(row.values[`${profile.toLowerCase()}_url`]);
      if (!abstractUrl || !source) {
        result.skippedCount += 1;
        continue;
      }
      const abstract = await this.prisma.client.conferenceAbstract.findFirst({
        where: { conferenceId: conference.id, sourceUrl: abstractUrl, deletedAt: null },
        select: { id: true },
      });
      if (!abstract) {
        result.issues.push({
          sourceFile: basename(file),
          rowNumber: row.rowNumber,
          entityType: 'ASSET',
          severity: 'ERROR',
          errorCode: 'ASSET_ABSTRACT_ORPHAN',
          message: 'Asset abstract_url does not exist in the detail import.',
          sourceSnapshot: { abstractUrl },
        });
        result.skippedCount += 1;
        continue;
      }
      await this.upsertAsset(
        'ABSTRACT',
        abstract.id,
        kind,
        legacyAssetSource(source, conference, kind),
        file,
        row.rowNumber,
        result,
      );
    }
    this.logger.log(
      `Conference import asset completed file=${basename(file)} rows=${processedRows}`,
    );
  }

  private async upsertAsset(
    ownerType: 'CONFERENCE' | 'ABSTRACT',
    ownerId: string,
    kind: any,
    source: string,
    sourceFile: string,
    rowNumber: number | null,
    result: ApplyResult,
  ): Promise<void> {
    try {
      const legacySourceUrl = this.conferenceMedia.normalizeLegacySourceUrl(source);
      const originalFilename = decodeURIComponent(
        new URL(legacySourceUrl).pathname.split('/').at(-1) || 'download',
      );
      if (ownerType === 'CONFERENCE') {
        const sameKind = await this.prisma.client.conferenceAsset.findFirst({
          where: { conferenceId: ownerId, kind },
          select: { id: true },
        });
        const existing = sameKind
          ? await this.prisma.client.conferenceAsset.findUnique({
            where: { id: sameKind.id },
            select: { id: true, legacySourceUrl: true },
          })
          : null;
        if (existing && existing.legacySourceUrl !== legacySourceUrl) {
          result.issues.push({
            sourceFile: basename(sourceFile),
            rowNumber,
            entityType: 'ASSET',
            severity: 'ERROR',
            errorCode: 'ASSET_URL_CONFLICT',
            message: 'A different URL already exists for the same asset kind.',
          });
          result.skippedCount += 1;
          return;
        }
        if (existing) {
          await this.prisma.client.conferenceAsset.update({
            where: { id: existing.id },
            data: { originalFilename, migrationStatus: 'NOT_PLANNED' },
          });
        } else {
          await this.prisma.client.conferenceAsset.create({
            data: {
              conferenceId: ownerId,
              kind,
              storageProvider: 'LEGACY_HTTP',
              legacySourceUrl,
              originalFilename,
              migrationStatus: 'NOT_PLANNED',
            },
          });
        }
      } else {
        const sameKind = kind === 'REFERENCE_IMAGE'
          ? null
          : await this.prisma.client.conferenceAbstractAsset.findFirst({
            where: { abstractId: ownerId, kind },
            select: { id: true, legacySourceUrl: true },
          });
        const existing = sameKind?.legacySourceUrl === legacySourceUrl
          ? sameKind
          : await this.prisma.client.conferenceAbstractAsset.findFirst({
            where: { abstractId: ownerId, kind, legacySourceUrl },
            select: { id: true, legacySourceUrl: true },
          });
        if (
          kind !== 'REFERENCE_IMAGE'
          && sameKind
          && sameKind.legacySourceUrl !== legacySourceUrl
        ) {
          result.issues.push({
            sourceFile: basename(sourceFile),
            rowNumber,
            entityType: 'ASSET',
            severity: 'ERROR',
            errorCode: 'ASSET_URL_CONFLICT',
            message: 'A different URL already exists for the same asset kind.',
          });
          result.skippedCount += 1;
          return;
        }
        if (existing) {
          await this.prisma.client.conferenceAbstractAsset.update({
            where: { id: existing.id },
            data: { originalFilename, migrationStatus: 'NOT_PLANNED' },
          });
        } else {
          await this.prisma.client.conferenceAbstractAsset.create({
            data: {
              abstractId: ownerId,
              kind,
              storageProvider: 'LEGACY_HTTP',
              legacySourceUrl,
              originalFilename,
              migrationStatus: 'NOT_PLANNED',
            },
          });
        }
      }
    } catch (error) {
      result.issues.push({
        sourceFile: basename(sourceFile),
        rowNumber,
        entityType: 'ASSET',
        severity: 'ERROR',
        errorCode: 'ASSET_URL_INVALID',
        message: error instanceof Error ? error.message : 'Invalid legacy asset URL.',
      });
      result.skippedCount += 1;
    }
  }

  private findConference(title: string): Promise<ConferenceRef | null> {
    return this.prisma.client.conference.findFirst({
      where: { title, deletedAt: null },
      select: { id: true, title: true, abbreviation: true, year: true },
    });
  }

  private missingConferenceIssue(
    file: string,
    conferenceKey: string,
  ): ConferenceImportIssueDraft {
    return {
      sourceFile: basename(file),
      rowNumber: null,
      entityType: 'CONFERENCE',
      severity: 'ERROR',
      errorCode: 'CONFERENCE_EXACT_MATCH_NOT_FOUND',
      message: `No active Conference matches exact key ${conferenceKey}.`,
      sourceSnapshot: { conferenceKey },
    };
  }
}
