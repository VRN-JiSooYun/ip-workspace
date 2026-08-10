import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { GmailMailProvider, MailProviderError } from "./gmail-mail.provider";

type ClaimedOutbox = {
  id: string;
  status: "PENDING" | "PROCESSING" | "RETRY" | "SENT" | "FAILED";
  recipientEmailSnapshot: string;
  subjectSnapshot: string;
  textBodySnapshot: string;
  htmlBodySnapshot: string;
  messageId: string;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: Date;
};

@Injectable()
export class ConferenceMailWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ConferenceMailWorkerService.name);
  private readonly workerId = randomUUID();
  private readonly pollIntervalMs: number;
  private readonly leaseDurationMs: number;
  private timer?: NodeJS.Timeout;
  private busy = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: GmailMailProvider,
    config: ConfigService,
  ) {
    this.pollIntervalMs = Math.max(
      1000,
      config.get<number>("gmail.pollIntervalMs", 5000),
    );
    this.leaseDurationMs = Math.max(
      10000,
      config.get<number>("gmail.leaseDurationMs", 60000),
    );
  }

  onModuleInit(): void {
    this.timer = setInterval(
      () => void this.processAvailable(),
      this.pollIntervalMs,
    );
    this.timer.unref();
    void this.processAvailable();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async processAvailable(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const readiness = await this.provider.readiness();
      if (!readiness.ready) return;
      for (let processed = 0; processed < 20; processed += 1) {
        const outbox = await this.claimNext();
        if (!outbox) break;
        await this.deliver(outbox);
      }
    } catch {
      this.logger.error("Conference mail worker cycle failed");
    } finally {
      this.busy = false;
    }
  }

  private async claimNext(): Promise<ClaimedOutbox | null> {
    const now = new Date();
    const candidate = await this.prisma.client.conferenceMailOutbox.findFirst({
      where: {
        OR: [
          {
            status: { in: ["PENDING", "RETRY"] },
            nextAttemptAt: { lte: now },
          },
          {
            status: "PROCESSING",
            leaseExpiresAt: { lt: now },
          },
        ],
      },
      orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    });
    if (!candidate) return null;
    const leaseExpiresAt = new Date(now.getTime() + this.leaseDurationMs);
    const claimed = await this.prisma.client.conferenceMailOutbox.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
        updatedAt: candidate.updatedAt,
      },
      data: {
        status: "PROCESSING",
        leaseOwner: this.workerId,
        leaseExpiresAt,
        attemptCount: { increment: 1 },
      },
    });
    if (claimed.count !== 1) return null;
    return this.prisma.client.conferenceMailOutbox.findUnique({
      where: { id: candidate.id },
    });
  }

  private async deliver(outbox: ClaimedOutbox): Promise<void> {
    try {
      const result = await this.provider.send({
        outboxId: outbox.id,
        messageId: outbox.messageId,
        to: outbox.recipientEmailSnapshot,
        subject: outbox.subjectSnapshot,
        textBody: outbox.textBodySnapshot,
        htmlBody: outbox.htmlBodySnapshot,
      });
      await this.prisma.client.conferenceMailOutbox.updateMany({
        where: {
          id: outbox.id,
          status: "PROCESSING",
          leaseOwner: this.workerId,
        },
        data: {
          status: "SENT",
          providerMessageId: result.providerMessageId,
          sentAt: new Date(),
          leaseOwner: null,
          leaseExpiresAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });
    } catch (error) {
      const providerError =
        error instanceof MailProviderError
          ? error
          : new MailProviderError("GMAIL_SEND_UNKNOWN", true);
      const retry =
        providerError.retryable && outbox.attemptCount < outbox.maxAttempts;
      const delayMs = this.retryDelayMs(outbox.attemptCount);
      await this.prisma.client.conferenceMailOutbox.updateMany({
        where: {
          id: outbox.id,
          status: "PROCESSING",
          leaseOwner: this.workerId,
        },
        data: {
          status: retry ? "RETRY" : "FAILED",
          nextAttemptAt: retry
            ? new Date(Date.now() + delayMs)
            : outbox.nextAttemptAt,
          leaseOwner: null,
          leaseExpiresAt: null,
          lastErrorCode: providerError.code,
          lastErrorMessage: providerError.code,
        },
      });
      this.logger.warn(
        `Mail outbox ${outbox.id} failed with ${providerError.code}`,
      );
    }
  }

  private retryDelayMs(attemptCount: number): number {
    const exponential = Math.min(
      60 * 60 * 1000,
      5000 * 2 ** Math.max(0, attemptCount - 1),
    );
    return (
      exponential + Math.floor(Math.random() * Math.min(5000, exponential / 4))
    );
  }
}
