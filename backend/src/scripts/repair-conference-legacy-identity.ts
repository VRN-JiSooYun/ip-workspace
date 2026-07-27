import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '../database/prisma.client';
import {
  ConferenceExcelReaderService,
  parseConferenceExcelSource,
} from '../conference-import/conference-excel-reader.service';

type LegacyIdentity = {
  abstractId: string;
  conferenceId: string;
  legacyId: number;
  sourceUrl: string;
};

const EXPECTED_ACTIVE_ABSTRACT_COUNT = 61390;
const EXPECTED_REPAIR_COUNT = 10798;
const CHUNK_SIZE = 200;

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const legacyRoot = join(
  process.env.CONFERENCE_IMPORT_ROOT ?? '/app/imports/conference',
  'legacy',
  'excel',
);
const shouldApply = process.argv.includes('--apply');
const excelReader = new ConferenceExcelReaderService();

const main = async () => {
  const activeAbstractCount = await prisma.conferenceAbstract.count({
    where: { deletedAt: null },
  });
  if (activeAbstractCount !== EXPECTED_ACTIVE_ABSTRACT_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_ACTIVE_ABSTRACT_COUNT} active Abstracts, found ${activeAbstractCount}.`,
    );
  }

  const files = (await readdir(legacyRoot))
    .filter((filename) => filename.toLowerCase().endsWith('.xlsx'))
    .sort();
  const identities: LegacyIdentity[] = [];
  const seenSourceKeys = new Set<string>();
  const seenLegacyKeys = new Set<string>();

  for (const filename of files) {
    const source = parseConferenceExcelSource(filename);
    if (!source || source.profile !== 'LEGACY_EXPORT') continue;
    const conference = await prisma.conference.findFirst({
      where: { title: source.conferenceKey, deletedAt: null },
      select: { id: true },
    });
    if (!conference) {
      throw new Error(`Conference exact match not found: ${source.conferenceKey}`);
    }

    for await (const row of excelReader.rows(join(legacyRoot, filename))) {
      const legacyId = Number(row.values.id);
      const sourceUrl = row.values.url?.trim();
      if (!Number.isInteger(legacyId) || !sourceUrl) {
        throw new Error(`Invalid identity at ${filename}:${row.rowNumber}`);
      }

      const sourceKey = `${conference.id}:${sourceUrl}`;
      const legacyKey = `LEGACY_DJANGO:${legacyId}`;
      if (seenSourceKeys.has(sourceKey)) {
        throw new Error(`Duplicate Conference/sourceUrl mapping: ${sourceKey}`);
      }
      if (seenLegacyKeys.has(legacyKey)) {
        throw new Error(`Duplicate legacy identity mapping: ${legacyKey}`);
      }
      seenSourceKeys.add(sourceKey);
      seenLegacyKeys.add(legacyKey);

      identities.push({
        abstractId: '',
        conferenceId: conference.id,
        legacyId,
        sourceUrl,
      });
    }
  }

  if (identities.length !== EXPECTED_ACTIVE_ABSTRACT_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_ACTIVE_ABSTRACT_COUNT} source identities, found ${identities.length}.`,
    );
  }

  const repairs: LegacyIdentity[] = [];
  const identitiesByConference = new Map<string, LegacyIdentity[]>();
  for (const identity of identities) {
    const conferenceIdentities = identitiesByConference.get(identity.conferenceId) ?? [];
    conferenceIdentities.push(identity);
    identitiesByConference.set(identity.conferenceId, conferenceIdentities);
  }
  for (const conferenceIdentities of identitiesByConference.values()) {
    for (const identityChunk of chunk(conferenceIdentities, 500)) {
      const abstracts = await prisma.conferenceAbstract.findMany({
        where: {
          conferenceId: identityChunk[0].conferenceId,
          sourceUrl: { in: identityChunk.map(({ sourceUrl }) => sourceUrl) },
          deletedAt: null,
        },
        select: {
          id: true,
          legacyId: true,
          sourceSystem: true,
          sourceUrl: true,
        },
      });
      const bySourceUrl = new Map(abstracts.map((abstract) => [
        abstract.sourceUrl,
        abstract,
      ]));

      for (const identity of identityChunk) {
        const abstract = bySourceUrl.get(identity.sourceUrl);
        if (!abstract) {
          throw new Error(
            `Active Abstract not found for ${identity.conferenceId}:${identity.sourceUrl}`,
          );
        }
        if (
          abstract.legacyId === identity.legacyId
          && abstract.sourceSystem === 'LEGACY_DJANGO'
        ) {
          continue;
        }
        if (
          abstract.legacyId !== null
          || abstract.sourceSystem !== 'CONFERENCE_EXCEL'
        ) {
          throw new Error(
            `Unexpected current identity for ${identity.conferenceId}:${identity.sourceUrl}`,
          );
        }
        repairs.push({ ...identity, abstractId: abstract.id });
      }
    }
  }

  if (repairs.length === 0) {
    const preservedIdentityCount = await prisma.conferenceAbstract.count({
      where: {
        deletedAt: null,
        sourceSystem: 'LEGACY_DJANGO',
        legacyId: { not: null },
      },
    });
    if (preservedIdentityCount !== EXPECTED_ACTIVE_ABSTRACT_COUNT) {
      throw new Error(
        `No repair candidates but only ${preservedIdentityCount} legacy identities are valid.`,
      );
    }
    process.stdout.write(JSON.stringify({
      mode: 'VERIFY',
      sourceIdentityCount: identities.length,
      repairCount: 0,
      preservedIdentityCount,
    }, null, 2));
    return;
  }

  if (repairs.length !== EXPECTED_REPAIR_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_REPAIR_COUNT} repairs, found ${repairs.length}.`,
    );
  }

  const conflictingIdentityCount = await prisma.conferenceAbstract.count({
    where: {
      sourceSystem: 'LEGACY_DJANGO',
      legacyId: { in: repairs.map(({ legacyId }) => legacyId) },
      id: { notIn: repairs.map(({ abstractId }) => abstractId) },
    },
  });
  if (conflictingIdentityCount > 0) {
    throw new Error(`Found ${conflictingIdentityCount} conflicting legacy identities.`);
  }

  if (!shouldApply) {
    process.stdout.write(JSON.stringify({
      mode: 'DRY_RUN',
      sourceIdentityCount: identities.length,
      repairCount: repairs.length,
      conflictingIdentityCount,
    }, null, 2));
    return;
  }

  let updatedCount = 0;
  for (const repairChunk of chunk(repairs, CHUNK_SIZE)) {
    const results = await prisma.$transaction(
      repairChunk.map((repair) => prisma.conferenceAbstract.updateMany({
        where: {
          id: repair.abstractId,
          legacyId: null,
          sourceSystem: 'CONFERENCE_EXCEL',
        },
        data: {
          legacyId: repair.legacyId,
          sourceSystem: 'LEGACY_DJANGO',
        },
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

  const preservedIdentityCount = await prisma.conferenceAbstract.count({
    where: {
      deletedAt: null,
      sourceSystem: 'LEGACY_DJANGO',
      legacyId: { not: null },
    },
  });
  const invalidIdentityCount = await prisma.conferenceAbstract.count({
    where: {
      deletedAt: null,
      OR: [
        { sourceSystem: { not: 'LEGACY_DJANGO' } },
        { legacyId: null },
      ],
    },
  });
  if (
    updatedCount !== EXPECTED_REPAIR_COUNT
    || preservedIdentityCount !== EXPECTED_ACTIVE_ABSTRACT_COUNT
    || invalidIdentityCount !== 0
  ) {
    throw new Error(
      `Post-check failed: updated=${updatedCount}, preserved=${preservedIdentityCount}, invalid=${invalidIdentityCount}.`,
    );
  }

  process.stdout.write(JSON.stringify({
    mode: 'APPLY',
    sourceIdentityCount: identities.length,
    updatedCount,
    preservedIdentityCount,
    invalidIdentityCount,
  }, null, 2));
};

try {
  await main();
} finally {
  await prisma.$disconnect();
}
