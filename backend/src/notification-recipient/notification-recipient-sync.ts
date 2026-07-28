import type { PrismaClient } from '../generated/prisma/client';

export const normalizeRecipientEmail = (email: string): string =>
  email.trim().toLowerCase();

const preferredWorkspaceName = (name: string, email: string): string => {
  const trimmed = name.trim();
  return trimmed && normalizeRecipientEmail(trimmed) !== email ? trimmed : email;
};

export class NotificationRecipientSyncConflictError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'NotificationRecipientSyncConflictError';
  }
}

export const syncNotificationRecipientForUser = async (
  prisma: PrismaClient,
  user: { id: string; name: string; email: string; status?: string },
) => {
  const normalizedEmail = normalizeRecipientEmail(user.email);
  const active = (user.status ?? 'ACTIVE') === 'ACTIVE';

  return prisma.$transaction(async (tx) => {
    const byEmail = await tx.notificationRecipient.findUnique({
      where: { normalizedEmail },
    });
    const byUser = await tx.notificationRecipient.findUnique({
      where: { linkedUserId: user.id },
    });

    if (byUser && byUser.normalizedEmail !== normalizedEmail) {
      throw new NotificationRecipientSyncConflictError(
        'NOTIFICATION_RECIPIENT_USER_EMAIL_CHANGED',
      );
    }
    if (byEmail?.linkedUserId && byEmail.linkedUserId !== user.id) {
      throw new NotificationRecipientSyncConflictError(
        'NOTIFICATION_RECIPIENT_EMAIL_ALREADY_LINKED',
      );
    }

    if (byEmail) {
      return tx.notificationRecipient.update({
        where: { id: byEmail.id },
        data: {
          linkedUserId: user.id,
          status: active ? 'ACTIVE' : 'INACTIVE',
          mailEnabled: active,
          lastSyncedAt: new Date(),
          ...(byEmail.source === 'WORKSPACE_USER'
            ? { name: preferredWorkspaceName(user.name, normalizedEmail) }
            : {}),
        },
      });
    }

    return tx.notificationRecipient.create({
      data: {
        name: preferredWorkspaceName(user.name, normalizedEmail),
        email: normalizedEmail,
        normalizedEmail,
        linkedUserId: user.id,
        source: 'WORKSPACE_USER',
        status: active ? 'ACTIVE' : 'INACTIVE',
        mailEnabled: active,
        lastSyncedAt: new Date(),
      },
    });
  });
};
