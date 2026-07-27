import { Injectable } from '@nestjs/common';
import { basename } from 'node:path';
import { PrismaService } from '../database/prisma.service';
import { ConferenceExcelReaderService, parseConferenceExcelSource } from './conference-excel-reader.service';
import type { ConferenceImportIssueDraft } from './conference-import.types';
import { parseLegacyCommentLiteral } from './legacy-comment-literal.parser';

export const LEGACY_COMMENT_PROFILE = 'legacy-comments/v1';

type LegacyCommentCandidate = {
  sourceFile: string;
  rowNumber: number;
  abstractId: string;
  abstractLegacyId: number;
  legacyCommentId: number;
  legacyOrder: number;
  legacyCommentKey: string;
  legacyAuthorRecipientId: string;
  authorNameSnapshot: string;
  content: string;
};

export type LegacyCommentImportResult = {
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  inspectedCount: number;
  issues: ConferenceImportIssueDraft[];
};

@Injectable()
export class LegacyCommentImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly excelReader: ConferenceExcelReaderService,
  ) {}

  async inspect(files: string[]): Promise<LegacyCommentImportResult> {
    const analysis = await this.analyze(files);
    return {
      insertedCount: analysis.candidates.length,
      updatedCount: 0,
      skippedCount: analysis.unchangedCount,
      inspectedCount: analysis.inspectedCount,
      issues: analysis.issues,
    };
  }

  async apply(files: string[]): Promise<LegacyCommentImportResult> {
    const analysis = await this.analyze(files);
    if (analysis.issues.some(({ severity }) => severity === 'ERROR')) {
      return {
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: analysis.unchangedCount,
        inspectedCount: analysis.inspectedCount,
        issues: analysis.issues,
      };
    }

    if (analysis.candidates.length > 0) {
      await this.prisma.client.conferenceAbstractComment.createMany({
        data: analysis.candidates.map((candidate) => ({
          abstractId: candidate.abstractId,
          authorUserId: null,
          legacyAuthorRecipientId: candidate.legacyAuthorRecipientId,
          authorNameSnapshot: candidate.authorNameSnapshot,
          sourceSystem: 'LEGACY_DJANGO',
          legacyCommentKey: candidate.legacyCommentKey,
          legacyCommentId: candidate.legacyCommentId,
          legacyOrder: candidate.legacyOrder,
          sourceCreatedAt: null,
          content: candidate.content,
        })),
      });
    }

    return {
      insertedCount: analysis.candidates.length,
      updatedCount: 0,
      skippedCount: analysis.unchangedCount,
      inspectedCount: analysis.inspectedCount,
      issues: analysis.issues,
    };
  }

  private async analyze(files: string[]): Promise<{
    candidates: LegacyCommentCandidate[];
    unchangedCount: number;
    inspectedCount: number;
    issues: ConferenceImportIssueDraft[];
  }> {
    const issues: ConferenceImportIssueDraft[] = [];
    const rawComments: Array<{
      sourceFile: string;
      rowNumber: number;
      abstractLegacyId: number;
      legacyCommentId: number;
      legacyOrder: number;
      memberId: number;
      authorNameSnapshot: string;
      content: string;
      legacyCommentKey: string;
    }> = [];
    const seenKeys = new Set<string>();

    for (const file of files) {
      const source = parseConferenceExcelSource(basename(file));
      if (!source || source.profile !== 'LEGACY_EXPORT') continue;
      for await (const row of this.excelReader.rows(file)) {
        const literal = row.values.list_dict_comment?.trim();
        if (!literal) continue;
        const abstractLegacyId = Number(row.values.id);
        if (!Number.isSafeInteger(abstractLegacyId) || abstractLegacyId <= 0) {
          issues.push({
            sourceFile: source.sourceFile,
            rowNumber: row.rowNumber,
            entityType: 'COMMENT',
            severity: 'ERROR',
            errorCode: 'LEGACY_COMMENT_ABSTRACT_ID_INVALID',
            message: 'Comment row has an invalid Abstract legacy ID.',
          });
          continue;
        }

        let comments: ReturnType<typeof parseLegacyCommentLiteral>;
        try {
          comments = parseLegacyCommentLiteral(literal);
        } catch (error) {
          issues.push({
            sourceFile: source.sourceFile,
            rowNumber: row.rowNumber,
            entityType: 'COMMENT',
            severity: 'ERROR',
            errorCode: 'LEGACY_COMMENT_LITERAL_INVALID',
            message: error instanceof Error ? error.message.slice(0, 500) : 'Invalid comment literal.',
            sourceSnapshot: { abstractLegacyId },
          });
          continue;
        }

        const rowCommentIds = new Set<number>();
        for (const [legacyOrder, comment] of comments.entries()) {
          if (rowCommentIds.has(comment.id)) {
            issues.push({
              sourceFile: source.sourceFile,
              rowNumber: row.rowNumber,
              entityType: 'COMMENT',
              severity: 'ERROR',
              errorCode: 'LEGACY_COMMENT_ID_DUPLICATE',
              message: 'Comment ID is duplicated in the same Abstract row.',
              sourceSnapshot: {
                abstractLegacyId,
                legacyCommentId: comment.id,
              },
            });
            continue;
          }
          rowCommentIds.add(comment.id);
          const legacyCommentKey = [
            'LEGACY_DJANGO',
            `abstract:${abstractLegacyId}`,
            `comment:${comment.id}`,
            `member:${comment.memberId}`,
          ].join(':');
          if (seenKeys.has(legacyCommentKey)) {
            issues.push({
              sourceFile: source.sourceFile,
              rowNumber: row.rowNumber,
              entityType: 'COMMENT',
              severity: 'ERROR',
              errorCode: 'LEGACY_COMMENT_KEY_DUPLICATE',
              message: 'Deterministic legacy comment key is duplicated in the source.',
              sourceSnapshot: {
                abstractLegacyId,
                legacyCommentId: comment.id,
                memberId: comment.memberId,
              },
            });
            continue;
          }
          seenKeys.add(legacyCommentKey);
          rawComments.push({
            sourceFile: source.sourceFile,
            rowNumber: row.rowNumber,
            abstractLegacyId,
            legacyCommentId: comment.id,
            legacyOrder,
            memberId: comment.memberId,
            authorNameSnapshot: comment.name,
            content: comment.content,
            legacyCommentKey,
          });
        }
      }
    }

    const abstractLegacyIds = [...new Set(rawComments.map(({ abstractLegacyId }) => abstractLegacyId))];
    const memberIds = [...new Set(rawComments.map(({ memberId }) => memberId))];
    const legacyCommentKeys = rawComments.map(({ legacyCommentKey }) => legacyCommentKey);
    const [abstracts, recipients, existingComments] = await Promise.all([
      this.prisma.client.conferenceAbstract.findMany({
        where: {
          sourceSystem: 'LEGACY_DJANGO',
          legacyId: { in: abstractLegacyIds },
          deletedAt: null,
        },
        select: { id: true, legacyId: true },
      }),
      this.prisma.client.notificationRecipient.findMany({
        where: { memberId: { in: memberIds } },
        select: { id: true, memberId: true, name: true },
      }),
      this.prisma.client.conferenceAbstractComment.findMany({
        where: { legacyCommentKey: { in: legacyCommentKeys } },
        select: {
          abstractId: true,
          legacyAuthorRecipientId: true,
          authorNameSnapshot: true,
          content: true,
          legacyCommentKey: true,
          legacyCommentId: true,
          legacyOrder: true,
          sourceSystem: true,
        },
      }),
    ]);
    const abstractByLegacyId = new Map(
      abstracts.flatMap((abstract) => (
        abstract.legacyId === null ? [] : [[abstract.legacyId, abstract] as const]
      )),
    );
    const recipientByMemberId = new Map(
      recipients.flatMap((recipient) => (
        recipient.memberId === null ? [] : [[recipient.memberId, recipient] as const]
      )),
    );
    const existingByKey = new Map(
      existingComments.flatMap((comment) => (
        comment.legacyCommentKey ? [[comment.legacyCommentKey, comment] as const] : []
      )),
    );

    const candidates: LegacyCommentCandidate[] = [];
    let unchangedCount = 0;
    for (const raw of rawComments) {
      const abstract = abstractByLegacyId.get(raw.abstractLegacyId);
      if (!abstract) {
        issues.push({
          sourceFile: raw.sourceFile,
          rowNumber: raw.rowNumber,
          entityType: 'COMMENT',
          severity: 'ERROR',
          errorCode: 'LEGACY_COMMENT_ABSTRACT_NOT_FOUND',
          message: 'No active imported Abstract matches the legacy ID.',
          sourceSnapshot: { abstractLegacyId: raw.abstractLegacyId },
        });
        continue;
      }
      const recipient = recipientByMemberId.get(raw.memberId);
      if (!recipient) {
        issues.push({
          sourceFile: raw.sourceFile,
          rowNumber: raw.rowNumber,
          entityType: 'COMMENT',
          severity: 'ERROR',
          errorCode: 'LEGACY_COMMENT_AUTHOR_NOT_FOUND',
          message: 'No notification recipient matches the legacy member ID.',
          sourceSnapshot: {
            abstractLegacyId: raw.abstractLegacyId,
            memberId: raw.memberId,
          },
        });
        continue;
      }
      if (recipient.name.trim() !== raw.authorNameSnapshot) {
        issues.push({
          sourceFile: raw.sourceFile,
          rowNumber: raw.rowNumber,
          entityType: 'COMMENT',
          severity: 'WARNING',
          errorCode: 'LEGACY_COMMENT_AUTHOR_NAME_MISMATCH',
          message: 'Legacy comment author name differs from the recipient directory; the source name is preserved.',
          sourceSnapshot: {
            abstractLegacyId: raw.abstractLegacyId,
            memberId: raw.memberId,
          },
        });
      }

      const candidate: LegacyCommentCandidate = {
        sourceFile: raw.sourceFile,
        rowNumber: raw.rowNumber,
        abstractId: abstract.id,
        abstractLegacyId: raw.abstractLegacyId,
        legacyCommentId: raw.legacyCommentId,
        legacyOrder: raw.legacyOrder,
        legacyCommentKey: raw.legacyCommentKey,
        legacyAuthorRecipientId: recipient.id,
        authorNameSnapshot: raw.authorNameSnapshot,
        content: raw.content,
      };
      const existing = existingByKey.get(raw.legacyCommentKey);
      if (!existing) {
        candidates.push(candidate);
        continue;
      }
      const matches = (
        existing.sourceSystem === 'LEGACY_DJANGO'
        && existing.abstractId === candidate.abstractId
        && existing.legacyAuthorRecipientId === candidate.legacyAuthorRecipientId
        && existing.authorNameSnapshot === candidate.authorNameSnapshot
        && existing.legacyCommentId === candidate.legacyCommentId
        && existing.legacyOrder === candidate.legacyOrder
        && existing.content === candidate.content
      );
      if (matches) {
        unchangedCount += 1;
      } else {
        issues.push({
          sourceFile: raw.sourceFile,
          rowNumber: raw.rowNumber,
          entityType: 'COMMENT',
          severity: 'ERROR',
          errorCode: 'LEGACY_COMMENT_IDEMPOTENCY_CONFLICT',
          message: 'An existing legacy comment key has different persisted data.',
          sourceSnapshot: {
            abstractLegacyId: raw.abstractLegacyId,
            legacyCommentId: raw.legacyCommentId,
            memberId: raw.memberId,
          },
        });
      }
    }

    return {
      candidates,
      unchangedCount,
      inspectedCount: rawComments.length,
      issues,
    };
  }
}
