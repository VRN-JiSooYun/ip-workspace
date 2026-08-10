import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { WorkspaceAuthorizationService } from "../authorization/workspace-authorization.service";
import { PrismaService } from "../database/prisma.service";
import { buildConferenceCommentMail } from "../conference-mail/conference-mail-template";
import { normalizeRecipientEmail } from "../notification-recipient/notification-recipient-sync";
import type { CreateConferenceCommentDto } from "./dto/create-conference-comment.dto";
import type { RecipientSearchQueryDto } from "./dto/recipient-search-query.dto";

const RECIPIENT_SEARCH_WINDOW_MS = 60_000;
const RECIPIENT_SEARCH_MAX_REQUESTS = 30;

type ConferenceMailTarget = {
  id: string | null;
  name: string;
  email: string;
  normalizedEmail: string;
};

@Injectable()
export class ConferenceInteractionService {
  private readonly recipientSearchWindows = new Map<string, number[]>();
  private readonly publicAppBaseUrl: string;
  private readonly mailMaxAttempts: number;
  private readonly allowedRecipientDomains: Set<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: WorkspaceAuthorizationService,
    config: ConfigService,
  ) {
    this.publicAppBaseUrl = config.get<string>(
      "gmail.publicAppBaseUrl",
      "http://localhost:5174",
    );
    this.mailMaxAttempts = Math.min(
      20,
      Math.max(1, config.get<number>("gmail.maxAttempts", 5)),
    );
    this.allowedRecipientDomains = new Set(
      config
        .get<string[]>("gmail.allowedRecipientDomains", ["voronoi.io"])
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  async setAbstractBookmark(
    userId: string,
    abstractId: string,
    bookmarked: boolean,
    organizationId?: string,
  ) {
    await this.assertAbstract(abstractId, organizationId);
    if (bookmarked) {
      await this.prisma.client.abstractBookmark.upsert({
        where: { userId_abstractId: { userId, abstractId } },
        create: { userId, abstractId },
        update: {},
      });
    } else {
      await this.prisma.client.abstractBookmark.deleteMany({
        where: { userId, abstractId },
      });
    }
    return { abstractId, isFavorite: bookmarked };
  }

  async searchRecipients(
    requestUserId: string,
    query: RecipientSearchQueryDto,
  ) {
    this.assertRecipientSearchRate(requestUserId);
    return this.prisma.client.notificationRecipient.findMany({
      where: {
        status: "ACTIVE",
        mailEnabled: true,
        AND: [
          {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { email: { contains: query.q, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      take: query.limit,
    });
  }

  async createComment(
    authorUserId: string,
    abstractId: string,
    body: CreateConferenceCommentDto,
    organizationId?: string,
  ) {
    return this.prisma.client.$transaction(async (tx) => {
      const abstract = await tx.conferenceAbstract.findFirst({
        where: {
          id: abstractId,
          deletedAt: null,
          conference: { deletedAt: null, organizationId },
        },
        select: {
          id: true,
          title: true,
          abstractNumber: true,
          conferenceId: true,
          conference: {
            select: { abbreviation: true },
          },
        },
      });
      if (!abstract)
        throw new NotFoundException("CONFERENCE_ABSTRACT_NOT_FOUND");
      const author = await tx.user.findUnique({
        where: { id: authorUserId },
        select: { name: true, email: true },
      });
      if (!author) throw new NotFoundException("COMMENT_AUTHOR_NOT_FOUND");

      const recipientIds = body.recipientIds ?? [];
      const recipientEmails = [
        ...new Set((body.recipientEmails ?? []).map(normalizeRecipientEmail)),
      ];
      if (recipientIds.length + recipientEmails.length > 20) {
        throw new BadRequestException("RECIPIENT_LIMIT_EXCEEDED");
      }
      for (const email of recipientEmails) {
        const domain = email.slice(email.lastIndexOf("@") + 1);
        if (!this.allowedRecipientDomains.has(domain)) {
          throw new BadRequestException("RECIPIENT_EMAIL_DOMAIN_NOT_ALLOWED");
        }
      }

      const requestedRecipients =
        recipientIds.length === 0 && recipientEmails.length === 0
          ? []
          : await tx.notificationRecipient.findMany({
              where: {
                OR: [
                  ...(recipientIds.length > 0
                    ? [{ id: { in: recipientIds } }]
                    : []),
                  ...(recipientEmails.length > 0
                    ? [{ normalizedEmail: { in: recipientEmails } }]
                    : []),
                ],
              },
              select: {
                id: true,
                name: true,
                email: true,
                normalizedEmail: true,
                status: true,
                mailEnabled: true,
              },
            });
      const recipientsById = new Map(
        requestedRecipients.map((recipient) => [recipient.id, recipient]),
      );
      const recipientsByEmail = new Map(
        requestedRecipients.map((recipient) => [
          recipient.normalizedEmail,
          recipient,
        ]),
      );
      if (
        recipientIds.some((id) => {
          const recipient = recipientsById.get(id);
          return (
            !recipient ||
            recipient.status !== "ACTIVE" ||
            !recipient.mailEnabled
          );
        })
      ) {
        throw new NotFoundException("RECIPIENT_NOT_FOUND_OR_INACTIVE");
      }
      if (
        recipientEmails.some((email) => {
          const recipient = recipientsByEmail.get(email);
          return (
            recipient &&
            (recipient.status !== "ACTIVE" || !recipient.mailEnabled)
          );
        })
      ) {
        throw new NotFoundException("RECIPIENT_NOT_FOUND_OR_INACTIVE");
      }

      const mailTargets = new Map<string, ConferenceMailTarget>();
      recipientIds.forEach((id) => {
        const recipient = recipientsById.get(id)!;
        mailTargets.set(recipient.normalizedEmail, recipient);
      });
      recipientEmails.forEach((email) => {
        const recipient = recipientsByEmail.get(email);
        mailTargets.set(
          email,
          recipient ?? {
            id: null,
            name: email,
            email,
            normalizedEmail: email,
          },
        );
      });
      const targets = [...mailTargets.values()];
      const mentionedRecipients = targets.filter(
        (recipient): recipient is ConferenceMailTarget & { id: string } =>
          recipient.id !== null,
      );
      const directRecipientEmails = targets
        .filter((recipient) => recipient.id === null)
        .map((recipient) => recipient.email);

      const comment = await tx.conferenceAbstractComment.create({
        data: {
          abstractId,
          authorUserId,
          content: body.content,
          mentions: {
            create: mentionedRecipients.map(({ id: mentionedRecipientId }) => ({
              mentionedRecipientId,
            })),
          },
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          author: { select: { id: true, name: true, email: true } },
        },
      });
      if (targets.length > 0) {
        await tx.conferenceMailOutbox.createMany({
          data: targets.map((recipient) => {
            const outboxId = randomUUID();
            const mail = buildConferenceCommentMail({
              authorName: author.name || author.email,
              recipientEmail: recipient.email,
              conferenceAbbreviation: abstract.conference.abbreviation,
              conferenceId: abstract.conferenceId,
              abstractId: abstract.id,
              abstractNumber: abstract.abstractNumber,
              abstractTitle: abstract.title,
              comment: body.content,
              publicAppBaseUrl: this.publicAppBaseUrl,
            });
            return {
              id: outboxId,
              commentId: comment.id,
              recipientId: recipient.id,
              recipientEmailSnapshot: recipient.email,
              recipientNormalizedEmail: recipient.normalizedEmail,
              recipientNameSnapshot: recipient.name,
              subjectSnapshot: mail.subject,
              textBodySnapshot: mail.textBody,
              htmlBodySnapshot: mail.htmlBody,
              messageId: `<conference-${outboxId}@voronoi.io>`,
              maxAttempts: this.mailMaxAttempts,
            };
          }),
        });
      }
      return {
        ...comment,
        sourceSystem: "WORKSPACE" as const,
        sourceCreatedAt: null,
        mentionedRecipients,
        directRecipientEmails,
        notificationQueuedCount: targets.length,
      };
    });
  }

  async deleteComment(
    actorUserId: string,
    commentId: string,
    organizationId?: string,
  ) {
    const canModerate = await this.authorization.hasPermission(
      actorUserId,
      "conference.comment.moderate",
    );
    return this.prisma.client.$transaction(async (tx) => {
      const comment = await tx.conferenceAbstractComment.findFirst({
        where: {
          id: commentId,
          deletedAt: null,
          abstract: {
            deletedAt: null,
            conference: { deletedAt: null, organizationId },
          },
        },
        select: { id: true, authorUserId: true },
      });
      if (!comment)
        throw new NotFoundException("CONFERENCE_ABSTRACT_COMMENT_NOT_FOUND");
      if (comment.authorUserId !== actorUserId && !canModerate) {
        throw new ForbiddenException("COMMENT_DELETE_FORBIDDEN");
      }
      await tx.conferenceAbstractComment.update({
        where: { id: commentId },
        data: { deletedAt: new Date() },
      });
      return { commentId, deleted: true };
    });
  }

  private async assertAbstract(
    abstractId: string,
    organizationId?: string,
  ): Promise<void> {
    const abstract = await this.prisma.client.conferenceAbstract.findFirst({
      where: {
        id: abstractId,
        deletedAt: null,
        conference: { deletedAt: null, organizationId },
      },
      select: { id: true },
    });
    if (!abstract) throw new NotFoundException("CONFERENCE_ABSTRACT_NOT_FOUND");
  }

  private assertRecipientSearchRate(userId: string): void {
    const now = Date.now();
    const recent = (this.recipientSearchWindows.get(userId) ?? []).filter(
      (requestedAt) => now - requestedAt < RECIPIENT_SEARCH_WINDOW_MS,
    );
    if (recent.length >= RECIPIENT_SEARCH_MAX_REQUESTS) {
      this.recipientSearchWindows.set(userId, recent);
      throw new HttpException(
        "RECIPIENT_SEARCH_RATE_LIMITED",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.recipientSearchWindows.set(userId, recent);
    if (this.recipientSearchWindows.size > 10_000) {
      for (const [key, timestamps] of this.recipientSearchWindows) {
        if (
          timestamps.every(
            (requestedAt) => now - requestedAt >= RECIPIENT_SEARCH_WINDOW_MS,
          )
        ) {
          this.recipientSearchWindows.delete(key);
        }
      }
    }
  }
}
