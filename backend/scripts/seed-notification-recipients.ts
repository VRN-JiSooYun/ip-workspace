/**
 * Bootstrap the notification recipient directory from a groupware member dump.
 *
 * Why this exists
 * ---------------
 * Login is gated on the signed-in user having a `notification_recipient` row
 * with a non-null `memberId` (see auth/groupware-sso.plugin.ts and
 * auth/groupware-session.interceptor.ts). The SSO flow itself never sets
 * `memberId` — only the groupware directory import does — and that import is
 * reachable only through an authenticated admin endpoint.
 *
 * On a freshly migrated database that is a deadlock: nobody can log in, so
 * nobody can run the import that would let them log in. This script breaks it.
 *
 * Relationship to the real importer
 * ---------------------------------
 * This deliberately writes the exact field shape and `sourceChecksum` that
 * NotificationRecipientImportService produces, so a subsequent real import
 * classifies every seeded row as UNCHANGED instead of rewriting it. If you
 * change the candidate/checksum logic there, change it here too.
 *
 * It is NOT a replacement for that importer: it does not create import runs or
 * batches, and it does not deactivate members missing from the source (the
 * importer's sweep). It only bootstraps.
 *
 * Usage (from backend/):
 *   bun run seed:recipients             # apply
 *   bun run seed:recipients -- --dry-run
 *   bun run seed:recipients -- --file=/path/to/getMembers.json
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { PrismaClient } from "../src/generated/prisma/client";
import { normalizeRecipientEmail } from "../src/notification-recipient/notification-recipient-sync";

// Kept in lockstep with notification-recipient-import.service.ts.
const sourceRowSchema = z
  .object({
    member_id: z.number().int().positive(),
    member_name: z.string().trim().min(1).max(200),
    member_email: z.string(),
  })
  .passthrough();

const emailSchema = z.string().trim().toLowerCase().max(320).email();

const DEFAULT_SOURCE_FILE = "imports/groupware-members/getMembers.json";

const sourceChecksumOf = (
  memberId: number,
  memberName: string,
  normalizedEmail: string,
): string =>
  createHash("sha256")
    // NUL separator, byte-for-byte what the importer hashes. A different
    // separator changes the digest and every seeded row would look modified.
    .update(`${memberId}\u0000${memberName}\u0000${normalizedEmail}`)
    .digest("hex");

type Candidate = {
  memberId: number;
  name: string;
  email: string;
  normalizedEmail: string;
  sourceChecksum: string;
};

const parseArgs = (argv: string[]) => {
  const fileArg = argv.find((arg) => arg.startsWith("--file="));
  return {
    dryRun: argv.includes("--dry-run"),
    file: fileArg ? fileArg.slice("--file=".length) : DEFAULT_SOURCE_FILE,
  };
};

const main = async () => {
  const { dryRun, file } = parseArgs(process.argv.slice(2));

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const sourcePath = resolve(process.cwd(), file);
  const raw: unknown = JSON.parse(await readFile(sourcePath, "utf8"));
  if (!Array.isArray(raw)) {
    throw new Error(`${sourcePath} must contain a JSON array of members`);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    // Build candidates, applying the importer's validation and de-duplication.
    const candidates: Candidate[] = [];
    const seenMemberIds = new Set<number>();
    const seenEmails = new Set<string>();
    let invalid = 0;
    let noEmail = 0;
    let duplicated = 0;

    for (const row of raw) {
      const parsed = sourceRowSchema.safeParse(row);
      if (!parsed.success) {
        invalid += 1;
        continue;
      }
      if (!parsed.data.member_email.trim()) {
        noEmail += 1;
        continue;
      }
      const parsedEmail = emailSchema.safeParse(parsed.data.member_email);
      if (!parsedEmail.success) {
        invalid += 1;
        continue;
      }
      const normalizedEmail = parsedEmail.data;
      const memberId = parsed.data.member_id;
      if (seenMemberIds.has(memberId) || seenEmails.has(normalizedEmail)) {
        duplicated += 1;
        continue;
      }
      seenMemberIds.add(memberId);
      seenEmails.add(normalizedEmail);
      candidates.push({
        memberId,
        name: parsed.data.member_name,
        email: normalizedEmail,
        normalizedEmail,
        sourceChecksum: sourceChecksumOf(
          memberId,
          parsed.data.member_name,
          normalizedEmail,
        ),
      });
    }

    const [recipients, users] = await Promise.all([
      prisma.notificationRecipient.findMany(),
      prisma.user.findMany({ select: { id: true, email: true } }),
    ]);

    const byMemberId = new Map(
      recipients
        .filter((recipient) => recipient.memberId !== null)
        .map((recipient) => [recipient.memberId as number, recipient]),
    );
    const byEmail = new Map(
      recipients.map((recipient) => [recipient.normalizedEmail, recipient]),
    );

    // Emails mapping to more than one user are ambiguous; the importer refuses
    // them and so do we.
    const userByEmail = new Map<string, { id: string }>();
    const ambiguousUserEmails = new Set<string>();
    for (const user of users) {
      const key = normalizeRecipientEmail(user.email);
      if (userByEmail.has(key)) ambiguousUserEmails.add(key);
      else userByEmail.set(key, { id: user.id });
    }

    const conflicts: string[] = [];
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    for (const candidate of candidates) {
      const matchedByMember = byMemberId.get(candidate.memberId);
      const matchedByEmail = byEmail.get(candidate.normalizedEmail);

      if (
        matchedByMember &&
        matchedByEmail &&
        matchedByMember.id !== matchedByEmail.id
      ) {
        conflicts.push(
          `${candidate.normalizedEmail}: member_id ${candidate.memberId} and email point at different recipients`,
        );
        continue;
      }

      const existing = matchedByMember ?? matchedByEmail;

      if (
        existing &&
        existing.memberId !== null &&
        existing.memberId !== candidate.memberId
      ) {
        conflicts.push(
          `${candidate.normalizedEmail}: already linked to member_id ${existing.memberId}, source says ${candidate.memberId}`,
        );
        continue;
      }

      if (ambiguousUserEmails.has(candidate.normalizedEmail)) {
        conflicts.push(
          `${candidate.normalizedEmail}: more than one user shares this email`,
        );
        continue;
      }

      const matchedUser = userByEmail.get(candidate.normalizedEmail);
      if (
        existing?.linkedUserId &&
        matchedUser &&
        existing.linkedUserId !== matchedUser.id
      ) {
        conflicts.push(
          `${candidate.normalizedEmail}: recipient is linked to a different user`,
        );
        continue;
      }
      const linkedUserId = existing?.linkedUserId ?? matchedUser?.id ?? null;

      const data = {
        memberId: candidate.memberId,
        name: candidate.name,
        email: candidate.email,
        normalizedEmail: candidate.normalizedEmail,
        linkedUserId,
        source: "GROUPWARE_IMPORT" as const,
        status: "ACTIVE" as const,
        mailEnabled: true,
        sourceChecksum: candidate.sourceChecksum,
        lastSyncedAt: new Date(),
      };

      if (!existing) {
        inserted += 1;
        if (!dryRun) await prisma.notificationRecipient.create({ data });
        continue;
      }

      const isUnchanged =
        existing.memberId === candidate.memberId &&
        existing.name === candidate.name &&
        existing.email === candidate.email &&
        existing.normalizedEmail === candidate.normalizedEmail &&
        existing.linkedUserId === linkedUserId &&
        existing.source === "GROUPWARE_IMPORT" &&
        existing.status === "ACTIVE" &&
        existing.mailEnabled &&
        existing.sourceChecksum === candidate.sourceChecksum;

      if (isUnchanged) {
        unchanged += 1;
        continue;
      }

      updated += 1;
      if (!dryRun) {
        await prisma.notificationRecipient.update({
          where: { id: existing.id },
          data,
        });
      }
    }

    console.log(`source        : ${sourcePath}`);
    console.log(`mode          : ${dryRun ? "DRY RUN (no writes)" : "APPLY"}`);
    console.log(`rows          : ${raw.length}`);
    console.log(`candidates    : ${candidates.length}`);
    console.log(`  inserted    : ${inserted}`);
    console.log(`  updated     : ${updated}`);
    console.log(`  unchanged   : ${unchanged}`);
    console.log(`skipped       : ${noEmail} no email, ${invalid} invalid, ${duplicated} duplicated in source`);
    console.log(`conflicts     : ${conflicts.length}`);
    for (const conflict of conflicts) console.log(`  ! ${conflict}`);

    if (conflicts.length > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
