import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { ConferenceMailOutboxListQueryDto } from './dto/conference-mail-outbox-list-query.dto';
import { GmailMailProvider } from './gmail-mail.provider';

@Injectable()
export class ConferenceMailAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: GmailMailProvider,
  ) {}

  async health(organizationId?: string) {
    const [provider, counts] = await Promise.all([
      this.provider.readiness(),
      this.prisma.client.conferenceMailOutbox.groupBy({
        by: ['status'],
        where: organizationId
          ? {
            comment: {
              abstract: {
                conference: { organizationId },
              },
            },
          }
          : undefined,
        _count: { _all: true },
      }),
    ]);
    return {
      provider,
      counts: Object.fromEntries(
        counts.map(({ status, _count }) => [status, _count._all]),
      ),
    };
  }

  list(query: ConferenceMailOutboxListQueryDto, organizationId?: string) {
    return this.prisma.client.conferenceMailOutbox.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(organizationId
          ? {
            comment: {
              abstract: {
                conference: { organizationId },
              },
            },
          }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      select: {
        id: true,
        type: true,
        status: true,
        recipientNameSnapshot: true,
        recipientEmailSnapshot: true,
        subjectSnapshot: true,
        attemptCount: true,
        maxAttempts: true,
        nextAttemptAt: true,
        lastErrorCode: true,
        providerMessageId: true,
        sentAt: true,
        createdAt: true,
        comment: {
          select: {
            abstract: {
              select: {
                id: true,
                title: true,
                conferenceId: true,
              },
            },
          },
        },
      },
    });
  }

  async retry(outboxId: string, organizationId?: string) {
    const existing = await this.prisma.client.conferenceMailOutbox.findFirst({
      where: {
        id: outboxId,
        ...(organizationId
          ? {
            comment: {
              abstract: {
                conference: { organizationId },
              },
            },
          }
          : {}),
      },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException('CONFERENCE_MAIL_OUTBOX_NOT_FOUND');
    if (existing.status !== 'FAILED') {
      throw new ConflictException('CONFERENCE_MAIL_OUTBOX_NOT_FAILED');
    }
    return this.prisma.client.conferenceMailOutbox.update({
      where: { id: outboxId },
      data: {
        status: 'RETRY',
        attemptCount: 0,
        nextAttemptAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
        leaseOwner: null,
        leaseExpiresAt: null,
      },
      select: {
        id: true,
        status: true,
        nextAttemptAt: true,
      },
    });
  }
}
