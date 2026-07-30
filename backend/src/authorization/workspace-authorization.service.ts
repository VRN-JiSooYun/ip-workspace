import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  getWorkspaceAdminRoles,
  getWorkspacePermissions,
  isSuperAdminRole,
  type WorkspacePermission,
} from './workspace-permissions';
import { TeamMembershipSyncService } from './team-membership-sync.service';
import type { WorkspaceDataScope } from './workspace-data-scope';

export type WorkspaceAccessContext = {
  userId: string;
  globalRoles: string[];
  organization: { id: string; name: string } | null;
  teams: Array<{ id: string; name: string }>;
  permissions: WorkspacePermission[];
  modules: {
    conference: { read: boolean; write: boolean; manage: boolean };
    patentAnalysis: { read: boolean; write: boolean; manage: boolean };
    sarTable: { read: boolean; write: boolean; manage: boolean };
    design: { read: boolean; write: boolean; manage: boolean };
    synthesis: { read: boolean; write: boolean; manage: boolean };
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
    if (!user) throw new NotFoundException('USER_NOT_FOUND');
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('AUTH_USER_INACTIVE');
    }

    if (user.team) {
      await this.membershipSync.ensureForUser(user.id, user.team);
    }
    const organizationMember = await this.prisma.client.member.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
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
      orderBy: { createdAt: 'asc' },
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
      team.moduleAccess.flatMap((access) => this.permissionsForModuleAccess(access)));
    const permissions = getWorkspacePermissions(user.role, teamPermissions);
    const has = (permission: WorkspacePermission) => permissions.includes(permission);
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
        conference: {
          read: has('conference.read'),
          write: has('conference.manage'),
          manage: has('conference.manage'),
        },
        patentAnalysis: {
          read: has('patentAnalysis.read'),
          write: has('patentAnalysis.manage'),
          manage: has('patentAnalysis.manage'),
        },
        sarTable: {
          read: has('sarTable.read'),
          write: has('sarTable.write'),
          manage: has('sarTable.manage'),
        },
        design: {
          read: has('design.read'),
          write: has('design.write'),
          manage: has('design.manage'),
        },
        synthesis: {
          read: has('synthesis.read'),
          write: has('synthesis.write'),
          manage: has('synthesis.manage'),
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
    if (!await this.hasPermission(userId, permission)) {
      throw new ForbiddenException('WORKSPACE_PERMISSION_REQUIRED');
    }
  }

  resolveDataScope(
    accessContext: WorkspaceAccessContext,
    domain: 'conference' | 'patentAnalysis' | 'sarTable' | 'design' | 'synthesis',
  ): WorkspaceDataScope {
    if (accessContext.globalRoles.includes('SUPER_ADMIN')) {
      return { type: 'GLOBAL' };
    }
    if (
      (domain === 'conference' && accessContext.globalRoles.includes('CONFERENCE_ADMIN'))
      || (
        domain === 'patentAnalysis'
        && accessContext.globalRoles.includes('PATENT_ANALYSIS_ADMIN')
      )
    ) {
      if (!accessContext.organization) {
        throw new ForbiddenException('WORKSPACE_ORGANIZATION_REQUIRED');
      }
      return {
        type: 'ORG',
        organizationId: accessContext.organization.id,
      };
    }
    if (domain === 'patentAnalysis') {
      return { type: 'OWN', userId: accessContext.userId };
    }
    if (!accessContext.organization) {
      throw new ForbiddenException('WORKSPACE_ORGANIZATION_REQUIRED');
    }
    if (domain === 'conference') {
      return {
        type: 'ORG',
        organizationId: accessContext.organization.id,
      };
    }
    if (accessContext.teams.length === 0) {
      throw new ForbiddenException('WORKSPACE_TEAM_REQUIRED');
    }
    return {
      type: 'TEAM',
      organizationId: accessContext.organization.id,
      teamIds: accessContext.teams.map(({ id }) => id),
    };
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });
    return Boolean(
      user
      && user.status === 'ACTIVE'
      && isSuperAdminRole(user.role),
    );
  }

  private permissionsForModuleAccess(access: {
    module: string;
    canRead: boolean;
    canWrite: boolean;
    canManage: boolean;
  }): WorkspacePermission[] {
    const canRead = access.canRead || access.canWrite || access.canManage;
    const canWrite = access.canWrite || access.canManage;
    switch (access.module) {
      case 'CONFERENCE':
        return [
          ...(canRead ? ['conference.read' as const] : []),
          ...(access.canManage
            ? [
              'conference.manage' as const,
              'conference.comment.moderate' as const,
            ]
            : []),
        ];
      case 'PATENT_ANALYSIS':
        return [
          ...(canRead ? ['patentAnalysis.read' as const] : []),
          ...(access.canManage ? ['patentAnalysis.manage' as const] : []),
        ];
      case 'SAR_TABLE':
        return [
          ...(canRead ? ['sarTable.read' as const] : []),
          ...(canWrite ? ['sarTable.write' as const] : []),
          ...(access.canManage ? ['sarTable.manage' as const] : []),
        ];
      case 'DESIGN':
        return [
          ...(canRead ? ['design.read' as const] : []),
          ...(canWrite ? ['design.write' as const] : []),
          ...(access.canManage ? ['design.manage' as const] : []),
        ];
      case 'SYNTHESIS':
        return [
          ...(canRead ? ['synthesis.read' as const] : []),
          ...(canWrite ? ['synthesis.write' as const] : []),
          ...(access.canManage ? ['synthesis.manage' as const] : []),
        ];
      default:
        return [];
    }
  }
}
