import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateUserAccessDto } from './dto/update-user-access.dto';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  listUsers() {
    return this.prisma.client.user.findMany({
      select: {
        id: true, name: true, email: true, role: true, status: true,
        createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateAccess(
    actorUserId: string,
    targetUserId: string,
    body: UpdateUserAccessDto,
    requestId: string,
  ) {
    return this.prisma.client.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: targetUserId } });
      if (!target) throw new NotFoundException('USER_NOT_FOUND');
      const nextRole = body.role ?? target.role;
      const nextStatus = body.status ?? target.status;
      const accessChanged = nextRole !== target.role || nextStatus !== target.status;
      const removesActiveAdmin =
        target.role === 'ADMIN' && target.status === 'ACTIVE' &&
        (nextRole !== 'ADMIN' || nextStatus !== 'ACTIVE');
      if (removesActiveAdmin) {
        const activeAdminCount = await tx.user.count({
          where: { role: 'ADMIN', status: 'ACTIVE' },
        });
        if (activeAdminCount <= 1) throw new ConflictException('LAST_ACTIVE_ADMIN');
      }

      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: { role: nextRole, status: nextStatus },
        select: {
          id: true, name: true, email: true, role: true, status: true,
          createdAt: true, updatedAt: true,
        },
      });
      if (accessChanged) await tx.session.deleteMany({ where: { userId: targetUserId } });
      if (nextStatus === 'INACTIVE') {
        await tx.account.updateMany({
          where: { userId: targetUserId, providerId: 'groupware' },
          data: { accessToken: null, tokenValidatedAt: null },
        });
      }
      await tx.authAuditLog.create({
        data: {
          actorUserId,
          targetUserId,
          eventType: 'USER_ACCESS_CHANGED',
          result: 'success',
          requestId,
          metadata: {
            before: { role: target.role, status: target.status },
            after: { role: nextRole, status: nextStatus },
            reason: body.reason ?? null,
          },
        },
      });
      return updated;
    });
  }
}
