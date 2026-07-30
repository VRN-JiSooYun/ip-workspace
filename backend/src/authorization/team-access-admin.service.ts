import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  DEFAULT_ORGANIZATION_SLUG,
  TeamMembershipSyncService,
} from './team-membership-sync.service';

const WORKSPACE_MODULES = [
  'CONFERENCE',
  'PATENT_ANALYSIS',
  'SAR_TABLE',
  'DESIGN',
  'SYNTHESIS',
] as const;

type WorkspaceModuleCode = (typeof WORKSPACE_MODULES)[number];
type ModuleAccessInput = {
  canRead: boolean;
  canWrite: boolean;
  canManage: boolean;
};

@Injectable()
export class TeamAccessAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipSync: TeamMembershipSyncService,
  ) {}

  async listTeams() {
    return this.getTeamAccessList();
  }

  async reconcileTeams() {
    const usersToSync = await this.prisma.client.user.findMany({
      where: {
        status: 'ACTIVE',
        team: { not: null },
      },
      select: { id: true, team: true },
      orderBy: { createdAt: 'asc' },
    });
    for (const user of usersToSync) {
      if (user.team) await this.membershipSync.ensureForUser(user.id, user.team);
    }
    return this.getTeamAccessList();
  }

  private async getTeamAccessList() {
    const organization = await this.prisma.client.organization.findUnique({
      where: { slug: DEFAULT_ORGANIZATION_SLUG },
      select: {
        id: true,
        name: true,
        teams: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            _count: { select: { members: true } },
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
    if (!organization) return { organization: null, teams: [] };
    return {
      organization: { id: organization.id, name: organization.name },
      teams: organization.teams.map((team) => ({
        id: team.id,
        name: team.name,
        memberCount: team._count.members,
        modules: this.toModuleRecord(team.moduleAccess),
      })),
    };
  }

  async updateTeamModules(
    actorUserId: string,
    teamId: string,
    rawModules: Record<string, unknown>,
    requestId: string,
  ) {
    const modules = this.parseModules(rawModules);
    return this.prisma.client.$transaction(async (tx) => {
      const team = await tx.team.findUnique({
        where: { id: teamId },
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
      });
      if (!team) throw new NotFoundException('TEAM_NOT_FOUND');

      for (const [module, access] of Object.entries(modules) as Array<
        [WorkspaceModuleCode, ModuleAccessInput]
      >) {
        await tx.teamModuleAccess.upsert({
          where: { teamId_module: { teamId, module } },
          create: {
            teamId,
            module,
            ...access,
            updatedById: actorUserId,
          },
          update: {
            ...access,
            updatedById: actorUserId,
          },
        });
      }
      const updatedAccess = await tx.teamModuleAccess.findMany({
        where: { teamId },
        select: {
          module: true,
          canRead: true,
          canWrite: true,
          canManage: true,
        },
      });
      await tx.authAuditLog.create({
        data: {
          actorUserId,
          eventType: 'TEAM_MODULE_ACCESS_CHANGED',
          result: 'success',
          requestId,
          metadata: {
            teamId,
            teamName: team.name,
            before: this.toModuleRecord(team.moduleAccess),
            after: this.toModuleRecord(updatedAccess),
          },
        },
      });
      return {
        id: team.id,
        name: team.name,
        modules: this.toModuleRecord(updatedAccess),
      };
    }, { isolationLevel: 'Serializable' });
  }

  private parseModules(rawModules: Record<string, unknown>) {
    const result: Partial<Record<WorkspaceModuleCode, ModuleAccessInput>> = {};
    for (const [module, rawAccess] of Object.entries(rawModules)) {
      if (!WORKSPACE_MODULES.includes(module as WorkspaceModuleCode)) {
        throw new BadRequestException('WORKSPACE_MODULE_INVALID');
      }
      if (!rawAccess || typeof rawAccess !== 'object' || Array.isArray(rawAccess)) {
        throw new BadRequestException('TEAM_MODULE_ACCESS_INVALID');
      }
      const access = rawAccess as Record<string, unknown>;
      if (
        typeof access.canRead !== 'boolean'
        || typeof access.canWrite !== 'boolean'
        || typeof access.canManage !== 'boolean'
      ) {
        throw new BadRequestException('TEAM_MODULE_ACCESS_INVALID');
      }
      const canManage = access.canManage;
      const canWrite = access.canWrite || canManage;
      result[module as WorkspaceModuleCode] = {
        canRead: access.canRead || canWrite,
        canWrite,
        canManage,
      };
    }
    if (Object.keys(result).length === 0) {
      throw new BadRequestException('TEAM_MODULE_ACCESS_REQUIRED');
    }
    return result;
  }

  private toModuleRecord(accessRows: Array<{
    module: string;
    canRead: boolean;
    canWrite: boolean;
    canManage: boolean;
  }>) {
    const accessMap = new Map(accessRows.map((row) => [row.module, row]));
    return Object.fromEntries(WORKSPACE_MODULES.map((module) => {
      const access = accessMap.get(module);
      return [module, {
        canRead: access?.canRead ?? false,
        canWrite: access?.canWrite ?? false,
        canManage: access?.canManage ?? false,
      }];
    }));
  }
}
