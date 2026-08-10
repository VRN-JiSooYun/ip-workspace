import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class SessionCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionCleanupService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.prisma.client.session
        .deleteMany({ where: { expiresAt: { lt: new Date() } } })
        .catch((error: unknown) => {
          this.logger.error(
            "Expired session cleanup failed",
            error instanceof Error ? error.stack : undefined,
          );
        });
    }, CLEANUP_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
