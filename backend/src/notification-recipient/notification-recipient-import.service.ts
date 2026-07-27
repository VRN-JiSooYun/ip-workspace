import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { PrismaService } from '../database/prisma.service';
import { normalizeRecipientEmail } from './notification-recipient-sync';

const PROFILE_VERSION = 'groupware-members/v1';

const sourceRowSchema = z.object({
  member_id: z.number().int().positive(),
  member_name: z.string().trim().min(1).max(200),
  member_email: z.string(),
}).passthrough();

const emailSchema = z.string().trim().toLowerCase().max(320).email();

type ImportMode = 'DRY_RUN' | 'APPLY';
type Issue = {
  rowNumber: number | null;
  severity: 'WARNING' | 'ERROR';
  errorCode: string;
  message: string;
  memberId: number | null;
};

type Candidate = {
  rowNumber: number;
  memberId: number;
  name: string;
  email: string;
  normalizedEmail: string;
  sourceChecksum: string;
};

type Action =
  | { type: 'INSERT'; candidate: Candidate; linkedUserId: string | null }
  | {
    type: 'UPDATE';
    candidate: Candidate;
    recipientId: string;
    linkedUserId: string | null;
  }
  | { type: 'UNCHANGED'; candidate: Candidate };

type Analysis = {
  sourceCount: number;
  insertedCount: number;
  updatedCount: number;
  unchangedCount: number;
  skippedCount: number;
  conflictCount: number;
  errorCount: number;
  issues: Issue[];
  actions: Action[];
  activeMemberIds: number[];
};

@Injectable()
export class NotificationRecipientImportService {
  private readonly sourceFile: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.sourceFile = config.get<string>(
      'notificationRecipient.sourceFile',
      '/app/imports/groupware-members/getMembers.json',
    );
  }

  async execute(startedByUserId: string, mode: ImportMode) {
    const source = await readFile(this.sourceFile);
    const sourceChecksum = createHash('sha256').update(source).digest('hex');

    const existing = await this.prisma.client.notificationRecipientImportRun.findUnique({
      where: {
        sourceChecksum_profileVersion_mode: {
          sourceChecksum,
          profileVersion: PROFILE_VERSION,
          mode,
        },
      },
      include: { issues: { orderBy: { rowNumber: 'asc' } } },
    });
    let run;
    if (existing) {
      if (existing.status !== 'FAILED' && existing.status !== 'PARTIAL') {
        return existing;
      }
      run = await this.prisma.client.$transaction(async (tx) => {
        await tx.notificationRecipientImportIssue.deleteMany({
          where: { runId: existing.id },
        });
        return tx.notificationRecipientImportRun.update({
          where: { id: existing.id },
          data: {
            status: 'RUNNING',
            sourceCount: 0,
            insertedCount: 0,
            updatedCount: 0,
            unchangedCount: 0,
            skippedCount: 0,
            conflictCount: 0,
            errorCount: 0,
            startedByUserId,
            startedAt: new Date(),
            finishedAt: null,
          },
        });
      });
    }

    if (mode === 'APPLY') {
      const dryRun = await this.prisma.client.notificationRecipientImportRun.findUnique({
        where: {
          sourceChecksum_profileVersion_mode: {
            sourceChecksum,
            profileVersion: PROFILE_VERSION,
            mode: 'DRY_RUN',
          },
        },
      });
      if (
        !dryRun
        || dryRun.status !== 'COMPLETED'
        || dryRun.errorCount !== 0
        || dryRun.conflictCount !== 0
      ) {
        throw new ConflictException(
          'NOTIFICATION_RECIPIENT_SUCCESSFUL_DRY_RUN_REQUIRED',
        );
      }
    }

    run ??= await this.prisma.client.notificationRecipientImportRun.create({
      data: {
        mode,
        status: 'RUNNING',
        profileVersion: PROFILE_VERSION,
        sourceChecksum,
        startedByUserId,
      },
    });

    try {
      const parsed = this.parseSource(source);
      const analysis = await this.analyze(parsed);
      if (
        mode === 'APPLY'
        && analysis.errorCount === 0
        && analysis.conflictCount === 0
      ) {
        await this.apply(analysis);
      }
      const status = analysis.errorCount > 0 || analysis.conflictCount > 0
        ? 'PARTIAL'
        : 'COMPLETED';
      await this.prisma.client.$transaction(async (tx) => {
        if (analysis.issues.length > 0) {
          await tx.notificationRecipientImportIssue.createMany({
            data: analysis.issues.map((issue) => ({ ...issue, runId: run.id })),
          });
        }
        await tx.notificationRecipientImportRun.update({
          where: { id: run.id },
          data: {
            status,
            sourceCount: analysis.sourceCount,
            insertedCount: analysis.insertedCount,
            updatedCount: analysis.updatedCount,
            unchangedCount: analysis.unchangedCount,
            skippedCount: analysis.skippedCount,
            conflictCount: analysis.conflictCount,
            errorCount: analysis.errorCount,
            finishedAt: new Date(),
          },
        });
      });
    } catch {
      await this.prisma.client.notificationRecipientImportRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          errorCount: 1,
          finishedAt: new Date(),
          issues: {
            create: {
              severity: 'ERROR',
              errorCode: 'NOTIFICATION_RECIPIENT_IMPORT_FAILED',
              message: '구성원 알림 대상 import 처리에 실패했습니다.',
            },
          },
        },
      });
    }

    return this.getRun(run.id);
  }

  listRuns() {
    return this.prisma.client.notificationRecipientImportRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: {
        startedBy: { select: { id: true, name: true, email: true } },
        _count: { select: { issues: true } },
      },
    });
  }

  async getRun(runId: string) {
    const run = await this.prisma.client.notificationRecipientImportRun.findUnique({
      where: { id: runId },
      include: { issues: { orderBy: { rowNumber: 'asc' } } },
    });
    if (!run) {
      throw new NotFoundException('NOTIFICATION_RECIPIENT_IMPORT_RUN_NOT_FOUND');
    }
    return run;
  }

  private parseSource(source: Buffer): unknown[] {
    const parsed = JSON.parse(source.toString('utf8')) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('GROUPWARE_MEMBERS_SOURCE_MUST_BE_ARRAY');
    }
    return parsed;
  }

  private async analyze(rows: unknown[]): Promise<Analysis> {
    const recipients = await this.prisma.client.notificationRecipient.findMany();
    const users = await this.prisma.client.user.findMany({
      select: { id: true, email: true },
    });
    const recipientsByMemberId = new Map(
      recipients
        .filter((recipient) => recipient.memberId !== null)
        .map((recipient) => [recipient.memberId as number, recipient]),
    );
    const recipientsByEmail = new Map(
      recipients.map((recipient) => [recipient.normalizedEmail, recipient]),
    );
    const usersByEmail = new Map<string, { id: string; email: string }>();
    const duplicatedUserEmails = new Set<string>();
    for (const user of users) {
      const normalizedEmail = normalizeRecipientEmail(user.email);
      if (usersByEmail.has(normalizedEmail)) duplicatedUserEmails.add(normalizedEmail);
      else usersByEmail.set(normalizedEmail, user);
    }

    const issues: Issue[] = [];
    const actions: Action[] = [];
    const sourceMemberIds = new Set<number>();
    const sourceEmails = new Set<string>();
    let skippedCount = 0;
    let conflictCount = 0;
    let errorCount = 0;

    for (const [index, rawRow] of rows.entries()) {
      const rowNumber = index + 1;
      const parsed = sourceRowSchema.safeParse(rawRow);
      if (!parsed.success) {
        errorCount += 1;
        issues.push({
          rowNumber,
          severity: 'ERROR',
          errorCode: 'INVALID_GROUPWARE_MEMBER_ROW',
          message: 'member_id, member_name 형식을 확인해 주세요.',
          memberId: null,
        });
        continue;
      }

      const memberId = parsed.data.member_id;
      const rawEmail = parsed.data.member_email.trim();
      if (!rawEmail) {
        skippedCount += 1;
        issues.push({
          rowNumber,
          severity: 'WARNING',
          errorCode: 'SKIPPED_NO_EMAIL',
          message: '이메일이 없어 알림 대상 등록에서 제외했습니다.',
          memberId,
        });
        continue;
      }

      const parsedEmail = emailSchema.safeParse(rawEmail);
      if (!parsedEmail.success) {
        errorCount += 1;
        issues.push({
          rowNumber,
          severity: 'ERROR',
          errorCode: 'INVALID_MEMBER_EMAIL',
          message: '이메일 형식이 올바르지 않습니다.',
          memberId,
        });
        continue;
      }

      const normalizedEmail = parsedEmail.data;
      if (sourceMemberIds.has(memberId) || sourceEmails.has(normalizedEmail)) {
        conflictCount += 1;
        issues.push({
          rowNumber,
          severity: 'ERROR',
          errorCode: 'DUPLICATED_MEMBER_IN_SOURCE',
          message: 'source 안에서 member_id 또는 email이 중복되었습니다.',
          memberId,
        });
        continue;
      }
      sourceMemberIds.add(memberId);
      sourceEmails.add(normalizedEmail);

      const candidate: Candidate = {
        rowNumber,
        memberId,
        name: parsed.data.member_name,
        email: normalizedEmail,
        normalizedEmail,
        sourceChecksum: createHash('sha256')
          .update(`${memberId}\u0000${parsed.data.member_name}\u0000${normalizedEmail}`)
          .digest('hex'),
      };
      const byMember = recipientsByMemberId.get(memberId);
      const byEmail = recipientsByEmail.get(normalizedEmail);
      if (byMember && byEmail && byMember.id !== byEmail.id) {
        conflictCount += 1;
        issues.push({
          rowNumber,
          severity: 'ERROR',
          errorCode: 'MEMBER_EMAIL_RECIPIENT_CONFLICT',
          message: 'member_id와 email이 서로 다른 recipient를 가리킵니다.',
          memberId,
        });
        continue;
      }

      const existing = byMember ?? byEmail;
      if (
        existing
        && existing.memberId !== null
        && existing.memberId !== memberId
      ) {
        conflictCount += 1;
        issues.push({
          rowNumber,
          severity: 'ERROR',
          errorCode: 'RECIPIENT_EMAIL_MEMBER_CONFLICT',
          message: 'email이 다른 member_id에 이미 연결되어 있습니다.',
          memberId,
        });
        continue;
      }
      if (duplicatedUserEmails.has(normalizedEmail)) {
        conflictCount += 1;
        issues.push({
          rowNumber,
          severity: 'ERROR',
          errorCode: 'DUPLICATED_WORKSPACE_USER_EMAIL',
          message: '정규화한 email에 해당하는 User가 둘 이상입니다.',
          memberId,
        });
        continue;
      }

      const matchedUser = usersByEmail.get(normalizedEmail);
      if (
        existing?.linkedUserId
        && matchedUser
        && existing.linkedUserId !== matchedUser.id
      ) {
        conflictCount += 1;
        issues.push({
          rowNumber,
          severity: 'ERROR',
          errorCode: 'RECIPIENT_LINKED_USER_CONFLICT',
          message: 'recipient가 다른 User에 연결되어 있습니다.',
          memberId,
        });
        continue;
      }
      const linkedUserId = existing?.linkedUserId ?? matchedUser?.id ?? null;

      if (!existing) {
        actions.push({ type: 'INSERT', candidate, linkedUserId });
        continue;
      }

      const unchanged = (
        existing.memberId === memberId
        && existing.name === candidate.name
        && existing.email === candidate.email
        && existing.normalizedEmail === candidate.normalizedEmail
        && existing.linkedUserId === linkedUserId
        && existing.source === 'GROUPWARE_IMPORT'
        && existing.status === 'ACTIVE'
        && existing.mailEnabled
        && existing.sourceChecksum === candidate.sourceChecksum
      );
      actions.push(unchanged
        ? { type: 'UNCHANGED', candidate }
        : { type: 'UPDATE', candidate, recipientId: existing.id, linkedUserId });
    }

    return {
      sourceCount: rows.length,
      insertedCount: actions.filter(({ type }) => type === 'INSERT').length,
      updatedCount: actions.filter(({ type }) => type === 'UPDATE').length,
      unchangedCount: actions.filter(({ type }) => type === 'UNCHANGED').length,
      skippedCount,
      conflictCount,
      errorCount,
      issues,
      actions,
      activeMemberIds: [...sourceMemberIds],
    };
  }

  private async apply(analysis: Analysis): Promise<void> {
    await this.prisma.client.$transaction(async (tx) => {
      for (const action of analysis.actions) {
        if (action.type === 'UNCHANGED') continue;
        const data = {
          memberId: action.candidate.memberId,
          name: action.candidate.name,
          email: action.candidate.email,
          normalizedEmail: action.candidate.normalizedEmail,
          linkedUserId: action.linkedUserId,
          source: 'GROUPWARE_IMPORT' as const,
          status: 'ACTIVE' as const,
          mailEnabled: true,
          sourceChecksum: action.candidate.sourceChecksum,
          lastSyncedAt: new Date(),
        };
        if (action.type === 'INSERT') {
          await tx.notificationRecipient.create({ data });
        } else {
          await tx.notificationRecipient.update({
            where: { id: action.recipientId },
            data,
          });
        }
      }

      if (analysis.activeMemberIds.length > 0) {
        await tx.notificationRecipient.updateMany({
          where: {
            source: 'GROUPWARE_IMPORT',
            memberId: { notIn: analysis.activeMemberIds },
            status: 'ACTIVE',
          },
          data: {
            status: 'INACTIVE',
            mailEnabled: false,
            lastSyncedAt: new Date(),
          },
        });
      }
    });
  }
}
