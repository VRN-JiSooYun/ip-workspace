import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { syncNotificationRecipientForUser } from "./notification-recipient-sync";

@Injectable()
export class NotificationRecipientSyncService {
  constructor(private readonly prisma: PrismaService) {}

  syncUser(user: { id: string; name: string; email: string; status?: string }) {
    return syncNotificationRecipientForUser(this.prisma.client, user);
  }

  async reconcileAllUsers() {
    const users = await this.prisma.client.user.findMany({
      select: { id: true, name: true, email: true, status: true },
      orderBy: { createdAt: "asc" },
    });
    const result = {
      sourceCount: users.length,
      syncedCount: 0,
      failedCount: 0,
    };
    for (const user of users) {
      try {
        await this.syncUser(user);
        result.syncedCount += 1;
      } catch {
        result.failedCount += 1;
      }
    }
    return result;
  }
}
