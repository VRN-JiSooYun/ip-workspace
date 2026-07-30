import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export const DEFAULT_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
export const DEFAULT_ORGANIZATION_SLUG = 'medichem-workspace';

const DEFAULT_TEAM_MODULE_ACCESS = [
  { module: 'CONFERENCE', canRead: true, canWrite: false, canManage: false },
  { module: 'PATENT_ANALYSIS', canRead: true, canWrite: false, canManage: false },
  { module: 'SAR_TABLE', canRead: true, canWrite: true, canManage: false },
  { module: 'DESIGN', canRead: true, canWrite: true, canManage: false },
  { module: 'SYNTHESIS', canRead: true, canWrite: true, canManage: false },
] as const;

export const normalizeTeamAlias = (value: string): string =>
  value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ko-KR');

@Injectable()
export class TeamMembershipSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureForUser(
    userId: string,
    rawTeamName: string,
    attempt = 0,
  ): Promise<{
    organization: { id: string; name: string };
    team: { id: string; name: string };
  } | null> {
    const displayTeamName = rawTeamName.normalize('NFKC').trim().replace(/\s+/g, ' ');
    const normalizedAlias = normalizeTeamAlias(displayTeamName);
    if (!normalizedAlias) return null;

    const currentAssignment = await this.prisma.client.groupwareTeamAssignment.findUnique({
      where: { userId },
      select: {
        team: {
          select: {
            id: true,
            name: true,
            organization: { select: { id: true, name: true, slug: true } },
            aliases: {
              where: { normalizedAlias },
              take: 1,
              select: { id: true },
            },
            moduleAccess: { select: { module: true } },
          },
        },
        user: {
          select: {
            organizationMembers: {
              select: { organizationId: true },
            },
          },
        },
      },
    });
    if (
      currentAssignment
      && currentAssignment.team.organization.slug === DEFAULT_ORGANIZATION_SLUG
      && currentAssignment.team.aliases.length > 0
      && currentAssignment.team.moduleAccess.length === DEFAULT_TEAM_MODULE_ACCESS.length
      && currentAssignment.user.organizationMembers.some(
        (member) => member.organizationId === currentAssignment.team.organization.id,
      )
    ) {
      await this.prisma.client.session.updateMany({
        where: {
          userId,
          OR: [
            { activeOrganizationId: null },
            {
              activeOrganizationId: {
                not: currentAssignment.team.organization.id,
              },
            },
            { activeTeamId: null },
            { activeTeamId: { not: currentAssignment.team.id } },
          ],
        },
        data: {
          activeOrganizationId: currentAssignment.team.organization.id,
          activeTeamId: currentAssignment.team.id,
        },
      });
      return {
        organization: {
          id: currentAssignment.team.organization.id,
          name: currentAssignment.team.organization.name,
        },
        team: {
          id: currentAssignment.team.id,
          name: currentAssignment.team.name,
        },
      };
    }

    try {
      return await this.prisma.client.$transaction(async (tx) => {
      const organization = await tx.organization.upsert({
        where: { slug: DEFAULT_ORGANIZATION_SLUG },
        create: {
          id: DEFAULT_ORGANIZATION_ID,
          name: 'Medichem Workspace',
          slug: DEFAULT_ORGANIZATION_SLUG,
        },
        update: {},
        select: { id: true, name: true },
      });

      await tx.member.upsert({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId,
          },
        },
        create: {
          organizationId: organization.id,
          userId,
          role: 'member',
        },
        update: {},
      });

      let alias = await tx.teamAlias.findUnique({
        where: {
          organizationId_normalizedAlias: {
            organizationId: organization.id,
            normalizedAlias,
          },
        },
        select: {
          team: { select: { id: true, name: true } },
        },
      });
      if (!alias) {
        const team = await tx.team.create({
          data: {
            name: displayTeamName,
            organizationId: organization.id,
          },
          select: { id: true, name: true },
        });
        alias = await tx.teamAlias.create({
          data: {
            organizationId: organization.id,
            teamId: team.id,
            normalizedAlias,
            displayAlias: displayTeamName,
          },
          select: {
            team: { select: { id: true, name: true } },
          },
        });
      }

      const team = alias.team;
      const previousAssignment = await tx.groupwareTeamAssignment.findUnique({
        where: { userId },
        select: { teamId: true },
      });
      if (previousAssignment && previousAssignment.teamId !== team.id) {
        await tx.teamMember.deleteMany({
          where: {
            teamId: previousAssignment.teamId,
            userId,
          },
        });
      }
      await tx.teamMember.upsert({
        where: { teamId_userId: { teamId: team.id, userId } },
        create: { teamId: team.id, userId },
        update: {},
      });
      await tx.groupwareTeamAssignment.upsert({
        where: { userId },
        create: {
          userId,
          teamId: team.id,
          rawTeamName: displayTeamName,
        },
        update: {
          teamId: team.id,
          rawTeamName: displayTeamName,
          syncedAt: new Date(),
        },
      });
      await tx.teamModuleAccess.createMany({
        data: DEFAULT_TEAM_MODULE_ACCESS.map((access) => ({
          teamId: team.id,
          ...access,
        })),
        skipDuplicates: true,
      });
      await tx.session.updateMany({
        where: { userId },
        data: {
          activeOrganizationId: organization.id,
          activeTeamId: team.id,
        },
      });

      return { organization, team };
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (attempt < 2 && (code === 'P2002' || code === 'P2034')) {
        return this.ensureForUser(userId, rawTeamName, attempt + 1);
      }
      throw error;
    }
  }
}
