import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  getWorkspaceAdminRoles,
  isSuperAdminRole,
  serializeWorkspaceAdminRoles,
} from "../authorization/workspace-permissions";
import { PrismaService } from "../database/prisma.service";
import { UpdateUserAccessDto } from "./dto/update-user-access.dto";

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers() {
    const users = await this.prisma.client.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        team: true,
        fullname: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return users.map((user) => this.toAdminUser(user));
  }

  async updateAccess(
    actorUserId: string,
    targetUserId: string,
    body: UpdateUserAccessDto,
    requestId: string,
  ) {
    return this.prisma.client.$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({
          where: { id: targetUserId },
        });
        if (!target) throw new NotFoundException("USER_NOT_FOUND");
        const nextRole = body.adminRoles
          ? serializeWorkspaceAdminRoles(body.adminRoles)
          : target.role;
        const nextStatus = body.status ?? target.status;
        const accessChanged =
          nextRole !== target.role || nextStatus !== target.status;
        const removesActiveAdmin =
          isSuperAdminRole(target.role) &&
          target.status === "ACTIVE" &&
          (!isSuperAdminRole(nextRole) || nextStatus !== "ACTIVE");
        if (removesActiveAdmin) {
          const activeAdminUsers = await tx.user.findMany({
            where: { status: "ACTIVE" },
            select: { role: true },
          });
          const activeSuperAdminCount = activeAdminUsers.filter((user) =>
            isSuperAdminRole(user.role),
          ).length;
          if (activeSuperAdminCount <= 1) {
            throw new ConflictException("LAST_ACTIVE_ADMIN");
          }
        }

        const updated = await tx.user.update({
          where: { id: targetUserId },
          data: { role: nextRole, status: nextStatus },
          select: {
            id: true,
            name: true,
            email: true,
            team: true,
            fullname: true,
            role: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        if (accessChanged)
          await tx.session.deleteMany({ where: { userId: targetUserId } });
        if (nextStatus === "INACTIVE") {
          await tx.account.updateMany({
            where: { userId: targetUserId, providerId: "groupware" },
            data: { accessToken: null, tokenValidatedAt: null },
          });
        }
        await tx.authAuditLog.create({
          data: {
            actorUserId,
            targetUserId,
            eventType: "USER_ACCESS_CHANGED",
            result: "success",
            requestId,
            metadata: {
              before: {
                role: target.role,
                adminRoles: getWorkspaceAdminRoles(target.role),
                status: target.status,
              },
              after: {
                role: nextRole,
                adminRoles: getWorkspaceAdminRoles(nextRole),
                status: nextStatus,
              },
              reason: body.reason ?? null,
            },
          },
        });
        return this.toAdminUser(updated);
      },
      { isolationLevel: "Serializable" },
    );
  }

  private toAdminUser<T extends { role: string }>(user: T) {
    const adminRoles = getWorkspaceAdminRoles(user.role);
    return {
      ...user,
      role: adminRoles.length > 0 ? ("ADMIN" as const) : ("USER" as const),
      adminRoles,
    };
  }
}
