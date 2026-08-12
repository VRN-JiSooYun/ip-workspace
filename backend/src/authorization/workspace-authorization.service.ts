import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import {
  getWorkspaceAdminRoles,
  getWorkspacePermissions,
  isSuperAdminRole,
  type WorkspacePermission,
} from "./workspace-permissions";
import { TeamMembershipSyncService } from "./team-membership-sync.service";
import type { WorkspaceDataScope } from "./workspace-data-scope";

export type WorkspaceAccessContext = {
  userId: string;
  globalRoles: string[];
  organization: { id: string; name: string } | null;
  teams: Array<{ id: string; name: string }>;
  permissions: WorkspacePermission[];
  modules: {
    patentAnalysis: { read: boolean; write: boolean; manage: boolean };
  };
};

@Injectable()
export class WorkspaceAuthorizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipSync: TeamMembershipSyncService,
  ) {}

  async getAccessContext(userId: string): Promise<WorkspaceAccessContext> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true, team: true },
    });
    if (!user) throw new NotFoundException("USER_NOT_FOUND");
    if (user.status !== "ACTIVE") {
      throw new ForbiddenException("AUTH_USER_INACTIVE");
    }

    if (user.team) {
      await this.membershipSync.ensureForUser(user.id, user.team);
    }
    const organizationMember = await this.prisma.client.member.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });
    const teamMemberships = await this.prisma.client.teamMember.findMany({
      where: {
        userId: user.id,
        ...(organizationMember
          ? { team: { organizationId: organizationMember.organization.id } }
          : {}),
      },
      orderBy: { createdAt: "asc" },
      select: {
        team: {
          select: {
            id: true,
            name: true,
            moduleAccess: {
              select: {
                module: true,
                canRead: true,
                canWrite: true,
                canManage: true,
              },
            },
          },
        },
      },
    });
    const teamPermissions = teamMemberships.flatMap(({ team }) =>
      team.moduleAccess.flatMap((access) =>
        this.permissionsForModuleAccess(access),
      ),
    );
    const permissions = getWorkspacePermissions(user.role, teamPermissions);
    const has = (permission: WorkspacePermission) =>
      permissions.includes(permission);
    return {
      userId: user.id,
      globalRoles: getWorkspaceAdminRoles(user.role),
      organization: organizationMember?.organization ?? null,
      teams: teamMemberships.map(({ team }) => ({
        id: team.id,
        name: team.name,
      })),
      permissions,
      modules: {
        patentAnalysis: {
          read: has("patentAnalysis.read"),
          write: has("patentAnalysis.manage"),
          manage: has("patentAnalysis.manage"),
        },
      },
    };
  }

  async hasPermission(
    userId: string,
    permission: WorkspacePermission,
  ): Promise<boolean> {
    const accessContext = await this.getAccessContext(userId);
    return accessContext.permissions.includes(permission);
  }

  async assertPermission(
    userId: string,
    permission: WorkspacePermission,
  ): Promise<void> {
    if (!(await this.hasPermission(userId, permission))) {
      throw new ForbiddenException("WORKSPACE_PERMISSION_REQUIRED");
    }
  }

  // `patentAnalysis` is the only remaining domain, so there is nothing left to
  // branch on. The TEAM scope this used to reach was only ever used by the
  // conference and design/synthesis domains, which no longer exist.
  resolveDataScope(accessContext: WorkspaceAccessContext): WorkspaceDataScope {
    if (accessContext.globalRoles.includes("SUPER_ADMIN")) {
      return { type: "GLOBAL" };
    }
    if (accessContext.globalRoles.includes("PATENT_ANALYSIS_ADMIN")) {
      if (!accessContext.organization) {
        throw new ForbiddenException("WORKSPACE_ORGANIZATION_REQUIRED");
      }
      return {
        type: "ORG",
        organizationId: accessContext.organization.id,
      };
    }
    return { type: "OWN", userId: accessContext.userId };
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });
    return Boolean(
      user && user.status === "ACTIVE" && isSuperAdminRole(user.role),
    );
  }

  private permissionsForModuleAccess(access: {
    module: string;
    canRead: boolean;
    canWrite: boolean;
    canManage: boolean;
  }): WorkspacePermission[] {
    const canRead = access.canRead || access.canWrite || access.canManage;
    switch (access.module) {
      case "PATENT_ANALYSIS":
        return [
          ...(canRead ? ["patentAnalysis.read" as const] : []),
          ...(access.canManage ? ["patentAnalysis.manage" as const] : []),
        ];
      default:
        return [];
    }
  }
}
