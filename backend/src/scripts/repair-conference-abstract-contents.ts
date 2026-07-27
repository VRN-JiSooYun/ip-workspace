import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Prisma } from '../generated/prisma/client';
import { prisma } from '../database/prisma.client';
import {
  ConferenceExcelReaderService,
  parseConferenceExcelSource,
} from '../conference-import/conference-excel-reader.service';

type SourceContent = {
  conferenceId: string;
  sourceUrl: string;
  contents: Prisma.InputJsonValue | typeof Prisma.JsonNull;
};

type ContentRepair = SourceContent & {
  abstractId: string;
  updatedAt: Date;
};

const EXPECTED_ACTIVE_ABSTRACT_COUNT = 61390;
const EXPECTED_REPAIR_COUNT = 52726;
const EXPECTED_STRING_COUNT = 50;
const EXPECTED_NULL_COUNT = 8614;
const CHUNK_SIZE = 200;
const importRoot = process.env.CONFERENCE_IMPORT_ROOT ?? '/app/imports/conference';
const legacyRoot = join(importRoot, 'legacy', 'excel');
const apiMetadataRoot = join(importRoot, 'api-metadata');
const shouldApply = process.argv.includes('--apply');
const excelReader = new ConferenceExcelReaderService();

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const contentValue = (
  value: string | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull => {
  const normalized = value?.trim() ?? '';
  if (!normalized || ['null', 'none', 'undefined', 'nan'].includes(normalized.toLowerCase())) {
    return Prisma.JsonNull;
  }
  try {
    return JSON.parse(normalized) as Prisma.InputJsonValue;
  } catch {
    return normalized;
  }
};

const rowContentValue = (
  values: Record<string, string>,
): Prisma.InputJsonValue | typeof Prisma.JsonNull => {
  const source = [values.contents, values.content].find((value) => {
    const normalized = value?.trim() ?? '';
    return normalized
      && !['null', 'none', 'undefined', 'nan'].includes(normalized.toLowerCase());
  });
  return contentValue(source);
};

const conferenceIdByKey = new Map<string, string>();

const getConferenceId = async (conferenceKey: string): Promise<string> => {
  const cached = conferenceIdByKey.get(conferenceKey);
  if (cached) return cached;
  const conference = await prisma.conference.findFirst({
    where: { title: conferenceKey, deletedAt: null },
    select: { id: true },
  });
  if (!conference) throw new Error(`Conference exact match not found: ${conferenceKey}`);
  conferenceIdByKey.set(conferenceKey, conference.id);
  return conference.id;
};

const loadSources = async (): Promise<Map<string, SourceContent>> => {
  const sources = new Map<string, SourceContent>();
  const legacyFiles = (await readdir(legacyRoot))
    .filter((filename) => filename.toLowerCase().endsWith('.xlsx'))
    .sort();

  for (const filename of legacyFiles) {
    const parsed = parseConferenceExcelSource(filename);
    if (!parsed || parsed.profile !== 'LEGACY_EXPORT') continue;
    const conferenceId = await getConferenceId(parsed.conferenceKey);
    for await (const row of excelReader.rows(join(legacyRoot, filename))) {
      const sourceUrl = row.values.url?.trim();
      if (!sourceUrl) throw new Error(`Missing source URL at ${filename}:${row.rowNumber}`);
      const key = `${conferenceId}:${sourceUrl}`;
      if (sources.has(key)) throw new Error(`Duplicate legacy content key: ${key}`);
      sources.set(key, {
        conferenceId,
        sourceUrl,
        contents: rowContentValue(row.values),
      });
    }
  }

  const apiFiles = (await readdir(apiMetadataRoot))
    .filter((filename) => filename.toLowerCase().endsWith('_abstract_detail_all.xlsx'))
    .sort();
  for (const filename of apiFiles) {
    const parsed = parseConferenceExcelSource(filename);
    if (!parsed || parsed.profile !== 'DETAIL') continue;
    const conferenceId = await getConferenceId(parsed.conferenceKey);
    for await (const row of excelReader.rows(join(apiMetadataRoot, filename))) {
      const sourceUrl = row.values.abstract_url?.trim();
      if (!sourceUrl) throw new Error(`Missing abstract_url at ${filename}:${row.rowNumber}`);
      const key = `${conferenceId}:${sourceUrl}`;
      const existing = sources.get(key);
      if (!existing) throw new Error(`API metadata content has no legacy match: ${key}`);
      sources.set(key, {
        ...existing,
        contents: rowContentValue(row.values),
      });
    }
  }

  return sources;
};

const main = async () => {
  const activeAbstractCount = await prisma.conferenceAbstract.count({
    where: { deletedAt: null },
  });
  if (activeAbstractCount !== EXPECTED_ACTIVE_ABSTRACT_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_ACTIVE_ABSTRACT_COUNT} active Abstracts, found ${activeAbstractCount}.`,
    );
  }

  const sources = await loadSources();
  if (sources.size !== EXPECTED_ACTIVE_ABSTRACT_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_ACTIVE_ABSTRACT_COUNT} source rows, found ${sources.size}.`,
    );
  }

  const repairs: ContentRepair[] = [];
  let stringCount = 0;
  let nullCount = 0;
  const sourcesByConference = new Map<string, SourceContent[]>();
  for (const source of sources.values()) {
    const conferenceSources = sourcesByConference.get(source.conferenceId) ?? [];
    conferenceSources.push(source);
    sourcesByConference.set(source.conferenceId, conferenceSources);
  }

  for (const conferenceSources of sourcesByConference.values()) {
    for (const sourceChunk of chunk(conferenceSources, 500)) {
      const abstracts = await prisma.conferenceAbstract.findMany({
        where: {
          conferenceId: sourceChunk[0].conferenceId,
          sourceUrl: { in: sourceChunk.map(({ sourceUrl }) => sourceUrl) },
          deletedAt: null,
        },
        select: {
          id: true,
          sourceUrl: true,
          contents: true,
          updatedAt: true,
        },
      });
      const bySourceUrl = new Map(abstracts.map((abstract) => [
        abstract.sourceUrl,
        abstract,
      ]));

      for (const source of sourceChunk) {
        const abstract = bySourceUrl.get(source.sourceUrl);
        if (!abstract) {
          throw new Error(
            `Active Abstract not found for ${source.conferenceId}:${source.sourceUrl}`,
          );
        }
        if (Array.isArray(abstract.contents)) {
          if (source.contents === Prisma.JsonNull || typeof source.contents !== 'string') {
            throw new Error(`Array contents has no string source: ${abstract.id}`);
          }
          repairs.push({
            ...source,
            abstractId: abstract.id,
            updatedAt: abstract.updatedAt,
          });
        } else if (abstract.contents === null) {
          if (source.contents !== Prisma.JsonNull) {
            throw new Error(`Null DB contents differs from source: ${abstract.id}`);
          }
          nullCount += 1;
        } else if (typeof abstract.contents === 'string') {
          if (abstract.contents !== source.contents) {
            throw new Error(`String DB contents differs from source: ${abstract.id}`);
          }
          stringCount += 1;
        } else {
          throw new Error(`Unexpected structured contents type: ${abstract.id}`);
        }
      }
    }
  }

  if (
    repairs.length === 0
    && stringCount === EXPECTED_REPAIR_COUNT + EXPECTED_STRING_COUNT
    && nullCount === EXPECTED_NULL_COUNT
  ) {
    process.stdout.write(JSON.stringify({
      mode: 'VERIFY',
      sourceCount: sources.size,
      repairCount: 0,
      stringCount,
      nullCount,
    }, null, 2));
    return;
  }

  if (
    repairs.length !== EXPECTED_REPAIR_COUNT
    || stringCount !== EXPECTED_STRING_COUNT
    || nullCount !== EXPECTED_NULL_COUNT
  ) {
    throw new Error(
      `Unexpected distribution: repairs=${repairs.length}, strings=${stringCount}, nulls=${nullCount}.`,
    );
  }

  if (!shouldApply) {
    process.stdout.write(JSON.stringify({
      mode: 'DRY_RUN',
      sourceCount: sources.size,
      repairCount: repairs.length,
      stringCount,
      nullCount,
    }, null, 2));
    return;
  }

  let updatedCount = 0;
  for (const repairChunk of chunk(repairs, CHUNK_SIZE)) {
    const results = await prisma.$transaction(
      repairChunk.map((repair) => prisma.conferenceAbstract.updateMany({
        where: {
          id: repair.abstractId,
          updatedAt: repair.updatedAt,
        },
        data: { contents: repair.contents },
      })),
    );
    const chunkUpdatedCount = results.reduce((total, result) => total + result.count, 0);
    if (chunkUpdatedCount !== repairChunk.length) {
      throw new Error(
        `Repair concurrency check failed: expected ${repairChunk.length}, updated ${chunkUpdatedCount}.`,
      );
    }
    updatedCount += chunkUpdatedCount;
  }

  const distribution = await prisma.$queryRaw<Array<{
    contentsType: string | null;
    count: bigint;
  }>>(Prisma.sql`
    SELECT jsonb_typeof(contents) AS "contentsType", COUNT(*) AS count
    FROM conference_abstract
    WHERE "deletedAt" IS NULL
    GROUP BY jsonb_typeof(contents)
  `);
  const countByType = new Map(distribution.map((item) => [
    item.contentsType ?? 'null',
    Number(item.count),
  ]));
  const arrayCount = countByType.get('array') ?? 0;
  const repairedStringCount = countByType.get('string') ?? 0;
  const repairedNullCount = countByType.get('null') ?? 0;
  if (
    updatedCount !== EXPECTED_REPAIR_COUNT
    || arrayCount !== 0
    || repairedStringCount !== EXPECTED_REPAIR_COUNT + EXPECTED_STRING_COUNT
    || repairedNullCount !== EXPECTED_NULL_COUNT
  ) {
    throw new Error(
      `Post-check failed: updated=${updatedCount}, arrays=${arrayCount}, strings=${repairedStringCount}, nulls=${repairedNullCount}.`,
    );
  }

  process.stdout.write(JSON.stringify({
    mode: 'APPLY',
    sourceCount: sources.size,
    updatedCount,
    arrayCount,
    stringCount: repairedStringCount,
    nullCount: repairedNullCount,
  }, null, 2));
};

try {
  await main();
} finally {
  await prisma.$disconnect();
}
