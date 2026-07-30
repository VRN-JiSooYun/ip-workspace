import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { CreateAdminConferenceDto } from './dto/create-admin-conference.dto';
import type { UpdateAdminConferenceDto } from './dto/update-admin-conference.dto';
import type { CreateAdminConferenceAbstractDto } from './dto/create-admin-conference-abstract.dto';
import type { UpdateAdminConferenceAbstractDto } from './dto/update-admin-conference-abstract.dto';

const nullable = (value: string | undefined): string | null | undefined => {
  if (value === undefined) return undefined;
  return value.trim() || null;
};

const date = (value: string | undefined): Date | null | undefined => {
  if (value === undefined) return undefined;
  return value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : null;
};

const contents = (value: string | undefined): unknown => {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
};

const assertDateRange = (dateStart?: string, dateEnd?: string): void => {
  if (dateStart && dateEnd && dateStart.slice(0, 10) > dateEnd.slice(0, 10)) {
    throw new BadRequestException('INVALID_DATE_RANGE');
  }
};

@Injectable()
export class ConferenceAdminService {
  constructor(private readonly prisma: PrismaService) {}

  listConferenceOptions(organizationId?: string) {
    return this.prisma.client.conference.findMany({
      where: { deletedAt: null, organizationId },
      select: {
        id: true,
        title: true,
        abbreviation: true,
        fullTitle: true,
        year: true,
        status: true,
        dateStart: true,
        dateEnd: true,
      },
      orderBy: [{ year: 'desc' }, { abbreviation: 'asc' }],
    });
  }

  async createConference(organizationId: string, body: CreateAdminConferenceDto) {
    assertDateRange(body.dateStart, body.dateEnd);
    try {
      return await this.prisma.client.conference.create({
        data: {
          organizationId,
          sourceSystem: 'WORKSPACE_ADMIN',
          title: body.title.trim(),
          abbreviation: body.abbreviation.trim(),
          fullTitle: nullable(body.fullTitle),
          year: body.year,
          status: body.status ?? 'OPEN',
          sourceUrl: nullable(body.sourceUrl),
          dateStart: date(body.dateStart),
          dateEnd: date(body.dateEnd),
        },
      });
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  async updateConference(
    conferenceId: string,
    body: UpdateAdminConferenceDto,
    organizationId?: string,
  ) {
    const current = await this.prisma.client.conference.findFirst({
      where: { id: conferenceId, deletedAt: null, organizationId },
    });
    if (!current) throw new NotFoundException('CONFERENCE_NOT_FOUND');
    const nextDateStart = body.dateStart ?? current.dateStart?.toISOString().slice(0, 10);
    const nextDateEnd = body.dateEnd ?? current.dateEnd?.toISOString().slice(0, 10);
    assertDateRange(nextDateStart, nextDateEnd);
    try {
      return await this.prisma.client.conference.update({
        where: { id: conferenceId },
        data: {
          ...(body.title !== undefined ? { title: body.title.trim() } : {}),
          ...(body.abbreviation !== undefined ? { abbreviation: body.abbreviation.trim() } : {}),
          ...(body.fullTitle !== undefined ? { fullTitle: nullable(body.fullTitle) } : {}),
          ...(body.year !== undefined ? { year: body.year } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.sourceUrl !== undefined ? { sourceUrl: nullable(body.sourceUrl) } : {}),
          ...(body.dateStart !== undefined ? { dateStart: date(body.dateStart) } : {}),
          ...(body.dateEnd !== undefined ? { dateEnd: date(body.dateEnd) } : {}),
        },
      });
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  async createAbstract(
    conferenceId: string,
    body: CreateAdminConferenceAbstractDto,
    organizationId?: string,
  ) {
    await this.assertConference(conferenceId, organizationId);
    return this.prisma.client.conferenceAbstract.create({
      data: {
        conferenceId,
        sourceSystem: 'WORKSPACE_ADMIN',
        ...this.abstractData(body),
        title: body.title.trim(),
      },
    });
  }

  async updateAbstract(
    abstractId: string,
    body: UpdateAdminConferenceAbstractDto,
    organizationId?: string,
  ) {
    const abstract = await this.prisma.client.conferenceAbstract.findFirst({
      where: {
        id: abstractId,
        deletedAt: null,
        conference: { deletedAt: null, organizationId },
      },
      select: { id: true },
    });
    if (!abstract) throw new NotFoundException('CONFERENCE_ABSTRACT_NOT_FOUND');
    return this.prisma.client.conferenceAbstract.update({
      where: { id: abstractId },
      data: this.abstractData(body),
    });
  }

  private abstractData(
    body: CreateAdminConferenceAbstractDto | UpdateAdminConferenceAbstractDto,
  ) {
    return {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.sourceUrl !== undefined ? { sourceUrl: nullable(body.sourceUrl) } : {}),
      ...(body.firstAuthorName !== undefined
        ? { firstAuthorName: nullable(body.firstAuthorName) }
        : {}),
      ...(body.firstAuthorOrganization !== undefined
        ? { firstAuthorOrganization: nullable(body.firstAuthorOrganization) }
        : {}),
      ...(body.authors !== undefined ? { authors: body.authors } : {}),
      ...(body.meeting !== undefined ? { meeting: nullable(body.meeting) } : {}),
      ...(body.sessionType !== undefined ? { sessionType: nullable(body.sessionType) } : {}),
      ...(body.sessionTitle !== undefined ? { sessionTitle: nullable(body.sessionTitle) } : {}),
      ...(body.track !== undefined ? { track: nullable(body.track) } : {}),
      ...(body.subTrack !== undefined ? { subTrack: nullable(body.subTrack) } : {}),
      ...(body.abstractNumber !== undefined
        ? { abstractNumber: nullable(body.abstractNumber) }
        : {}),
      ...(body.posterNumber !== undefined ? { posterNumber: nullable(body.posterNumber) } : {}),
      ...(body.clinicalTrialRegistrationNumber !== undefined
        ? {
          clinicalTrialRegistrationNumber:
            nullable(body.clinicalTrialRegistrationNumber),
        }
        : {}),
      ...(body.dateOpen !== undefined ? { dateOpen: date(body.dateOpen) } : {}),
      ...(body.contentsJson !== undefined ? { contents: contents(body.contentsJson) as any } : {}),
    };
  }

  private async assertConference(
    conferenceId: string,
    organizationId?: string,
  ): Promise<void> {
    const conference = await this.prisma.client.conference.findFirst({
      where: { id: conferenceId, deletedAt: null, organizationId },
      select: { id: true },
    });
    if (!conference) throw new NotFoundException('CONFERENCE_NOT_FOUND');
  }

  private rethrowConflict(error: unknown): never {
    const candidate = error as { code?: string };
    if (candidate?.code === 'P2002') {
      throw new ConflictException('CONFERENCE_ABBREVIATION_YEAR_DUPLICATED');
    }
    throw error;
  }
}
