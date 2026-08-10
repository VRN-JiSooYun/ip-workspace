import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../database/prisma.service";
import type { AdminConferenceListQueryDto } from "./dto/admin-conference-list-query.dto";
import type { AdminConferenceAbstractListQueryDto } from "./dto/admin-conference-abstract-list-query.dto";
import type { CreateAdminConferenceDto } from "./dto/create-admin-conference.dto";
import type { UpdateAdminConferenceDto } from "./dto/update-admin-conference.dto";
import type { CreateAdminConferenceAbstractDto } from "./dto/create-admin-conference-abstract.dto";
import type { UpdateAdminConferenceAbstractDto } from "./dto/update-admin-conference-abstract.dto";

const nullable = (value: string | undefined): string | null | undefined => {
  if (value === undefined) return undefined;
  return value.trim() || null;
};

const date = (value: string | null | undefined): Date | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
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

const assertDateRange = (
  dateStart?: string | null,
  dateEnd?: string | null,
): void => {
  if (dateStart && dateEnd && dateStart.slice(0, 10) > dateEnd.slice(0, 10)) {
    throw new BadRequestException("INVALID_DATE_RANGE");
  }
};

@Injectable()
export class ConferenceAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listConferences(
    query: AdminConferenceListQueryDto,
    organizationId?: string,
  ) {
    const q = query.q?.trim();
    const where: Prisma.ConferenceWhereInput = {
      organizationId,
      deletedAt: query.deleted === "deleted" ? { not: null } : null,
      ...(query.year ? { year: query.year } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { abbreviation: { contains: q, mode: "insensitive" } },
              { fullTitle: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.ConferenceOrderByWithRelationInput[] =
      query.sort === "yearAsc"
        ? [{ year: "asc" }, { abbreviation: "asc" }]
        : query.sort === "updatedDesc"
          ? [{ updatedAt: "desc" }, { id: "asc" }]
          : [{ year: "desc" }, { abbreviation: "asc" }];
    const [items, total] = await Promise.all([
      this.prisma.client.conference.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          title: true,
          abbreviation: true,
          fullTitle: true,
          year: true,
          status: true,
          sourceSystem: true,
          sourceUrl: true,
          dateStart: true,
          dateEnd: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          _count: {
            select: {
              abstracts: { where: { deletedAt: null } },
            },
          },
        },
      }),
      this.prisma.client.conference.count({ where }),
    ]);
    return {
      items: items.map(({ _count, ...item }) => ({
        ...item,
        activeAbstractCount: _count.abstracts,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      hasNext: query.page * query.pageSize < total,
    };
  }

  async listAbstracts(
    query: AdminConferenceAbstractListQueryDto,
    organizationId?: string,
  ) {
    if (
      query.dateFrom &&
      query.dateTo &&
      query.dateFrom.slice(0, 10) > query.dateTo.slice(0, 10)
    ) {
      throw new BadRequestException("INVALID_DATE_RANGE");
    }
    const q = query.q?.trim();
    const where: Prisma.ConferenceAbstractWhereInput = {
      deletedAt: query.deleted === "deleted" ? { not: null } : null,
      conference: {
        organizationId,
        ...(query.deleted === "active" ? { deletedAt: null } : {}),
      },
      ...(query.conferenceId ? { conferenceId: query.conferenceId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            dateOpen: {
              ...(query.dateFrom ? { gte: date(query.dateFrom) as Date } : {}),
              ...(query.dateTo ? { lte: date(query.dateTo) as Date } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { abstractNumber: { contains: q, mode: "insensitive" } },
              { title: { contains: q, mode: "insensitive" } },
              { firstAuthorName: { contains: q, mode: "insensitive" } },
              { firstAuthorOrganization: { contains: q, mode: "insensitive" } },
              { meeting: { contains: q, mode: "insensitive" } },
              { sessionType: { contains: q, mode: "insensitive" } },
              { sessionTitle: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.ConferenceAbstractOrderByWithRelationInput[] =
      query.sort === "abstractNumberAsc"
        ? [{ abstractNumber: "asc" }, { id: "asc" }]
        : query.sort === "dateOpenDesc"
          ? [{ dateOpen: "desc" }, { id: "asc" }]
          : [{ updatedAt: "desc" }, { id: "asc" }];
    const [items, total] = await Promise.all([
      this.prisma.client.conferenceAbstract.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          conferenceId: true,
          title: true,
          sourceSystem: true,
          sourceUrl: true,
          firstAuthorName: true,
          firstAuthorOrganization: true,
          authors: true,
          meeting: true,
          sessionType: true,
          sessionTitle: true,
          track: true,
          subTrack: true,
          abstractNumber: true,
          posterNumber: true,
          clinicalTrialRegistrationNumber: true,
          dateOpen: true,
          contents: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          conference: {
            select: {
              id: true,
              abbreviation: true,
              year: true,
              deletedAt: true,
            },
          },
        },
      }),
      this.prisma.client.conferenceAbstract.count({ where }),
    ]);
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      hasNext: query.page * query.pageSize < total,
    };
  }

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
      orderBy: [{ year: "desc" }, { abbreviation: "asc" }],
    });
  }

  async createConference(
    organizationId: string,
    body: CreateAdminConferenceDto,
    actorUserId: string,
    requestId: string,
  ) {
    assertDateRange(body.dateStart, body.dateEnd);
    try {
      return await this.prisma.client.$transaction(async (tx) => {
        const created = await tx.conference.create({
          data: {
            organizationId,
            sourceSystem: "WORKSPACE_ADMIN",
            title: body.title.trim(),
            abbreviation: body.abbreviation.trim(),
            fullTitle: nullable(body.fullTitle),
            year: body.year,
            status: body.status ?? "OPEN",
            sourceUrl: nullable(body.sourceUrl),
            dateStart: date(body.dateStart),
            dateEnd: date(body.dateEnd),
          },
        });
        await tx.authAuditLog.create({
          data: {
            actorUserId,
            eventType: "CONFERENCE_CREATED",
            result: "success",
            requestId,
            metadata: this.conferenceAuditSnapshot(created),
          },
        });
        return created;
      });
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  async updateConference(
    conferenceId: string,
    body: UpdateAdminConferenceDto,
    organizationId: string | undefined,
    actorUserId: string,
    requestId: string,
  ) {
    const current = await this.prisma.client.conference.findFirst({
      where: { id: conferenceId, deletedAt: null, organizationId },
    });
    if (!current) throw new NotFoundException("CONFERENCE_NOT_FOUND");
    this.assertExpectedUpdatedAt(
      current.updatedAt,
      body.expectedUpdatedAt,
      "CONFERENCE_UPDATE_CONFLICT",
    );
    const nextDateStart =
      body.dateStart !== undefined
        ? body.dateStart
        : current.dateStart?.toISOString().slice(0, 10);
    const nextDateEnd =
      body.dateEnd !== undefined
        ? body.dateEnd
        : current.dateEnd?.toISOString().slice(0, 10);
    assertDateRange(nextDateStart, nextDateEnd);
    try {
      return await this.prisma.client.$transaction(async (tx) => {
        const updateResult = await tx.conference.updateMany({
          where: {
            id: conferenceId,
            deletedAt: null,
            updatedAt: current.updatedAt,
          },
          data: {
            ...(body.title !== undefined ? { title: body.title.trim() } : {}),
            ...(body.abbreviation !== undefined
              ? { abbreviation: body.abbreviation.trim() }
              : {}),
            ...(body.fullTitle !== undefined
              ? { fullTitle: nullable(body.fullTitle) }
              : {}),
            ...(body.year !== undefined ? { year: body.year } : {}),
            ...(body.status !== undefined ? { status: body.status } : {}),
            ...(body.sourceUrl !== undefined
              ? { sourceUrl: nullable(body.sourceUrl) }
              : {}),
            ...(body.dateStart !== undefined
              ? { dateStart: date(body.dateStart) }
              : {}),
            ...(body.dateEnd !== undefined
              ? { dateEnd: date(body.dateEnd) }
              : {}),
          },
        });
        if (updateResult.count !== 1) {
          throw new ConflictException("CONFERENCE_UPDATE_CONFLICT");
        }
        const updated = await tx.conference.findUniqueOrThrow({
          where: { id: conferenceId },
        });
        await tx.authAuditLog.create({
          data: {
            actorUserId,
            eventType: "CONFERENCE_UPDATED",
            result: "success",
            requestId,
            metadata: {
              conferenceId,
              before: this.conferenceAuditSnapshot(current),
              after: this.conferenceAuditSnapshot(updated),
            },
          },
        });
        return updated;
      });
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  async createAbstract(
    conferenceId: string,
    body: CreateAdminConferenceAbstractDto,
    organizationId: string | undefined,
    actorUserId: string,
    requestId: string,
  ) {
    await this.assertConference(conferenceId, organizationId);
    return this.prisma.client.$transaction(async (tx) => {
      const created = await tx.conferenceAbstract.create({
        data: {
          conferenceId,
          sourceSystem: "WORKSPACE_ADMIN",
          ...this.abstractData(body),
          title: body.title.trim(),
        },
      });
      await tx.authAuditLog.create({
        data: {
          actorUserId,
          eventType: "CONFERENCE_ABSTRACT_CREATED",
          result: "success",
          requestId,
          metadata: this.abstractAuditSnapshot(created),
        },
      });
      return created;
    });
  }

  async updateAbstract(
    abstractId: string,
    body: UpdateAdminConferenceAbstractDto,
    organizationId: string | undefined,
    actorUserId: string,
    requestId: string,
  ) {
    const abstract = await this.prisma.client.conferenceAbstract.findFirst({
      where: {
        id: abstractId,
        deletedAt: null,
        conference: { deletedAt: null, organizationId },
      },
      select: {
        id: true,
        conferenceId: true,
        title: true,
        abstractNumber: true,
        sourceSystem: true,
        updatedAt: true,
      },
    });
    if (!abstract) throw new NotFoundException("CONFERENCE_ABSTRACT_NOT_FOUND");
    this.assertExpectedUpdatedAt(
      abstract.updatedAt,
      body.expectedUpdatedAt,
      "CONFERENCE_ABSTRACT_UPDATE_CONFLICT",
    );
    if (body.conferenceId && body.conferenceId !== abstract.conferenceId) {
      await this.assertConference(body.conferenceId, organizationId);
    }
    return this.prisma.client.$transaction(async (tx) => {
      const updateResult = await tx.conferenceAbstract.updateMany({
        where: {
          id: abstractId,
          deletedAt: null,
          updatedAt: abstract.updatedAt,
        },
        data: {
          ...this.abstractData(body),
          ...(body.conferenceId ? { conferenceId: body.conferenceId } : {}),
        },
      });
      if (updateResult.count !== 1) {
        throw new ConflictException("CONFERENCE_ABSTRACT_UPDATE_CONFLICT");
      }
      const updated = await tx.conferenceAbstract.findUniqueOrThrow({
        where: { id: abstractId },
      });
      await tx.authAuditLog.create({
        data: {
          actorUserId,
          eventType: "CONFERENCE_ABSTRACT_UPDATED",
          result: "success",
          requestId,
          metadata: {
            abstractId,
            before: this.abstractAuditSnapshot(abstract),
            after: this.abstractAuditSnapshot(updated),
          },
        },
      });
      return updated;
    });
  }

  async deleteConference(
    conferenceId: string,
    expectedUpdatedAt: string | undefined,
    organizationId: string | undefined,
    actorUserId: string,
    requestId: string,
  ) {
    return this.prisma.client.$transaction(
      async (tx) => {
        const current = await tx.conference.findFirst({
          where: { id: conferenceId, organizationId },
        });
        if (!current) throw new NotFoundException("CONFERENCE_NOT_FOUND");
        if (current.deletedAt)
          throw new ConflictException("CONFERENCE_ALREADY_DELETED");
        this.assertExpectedUpdatedAt(
          current.updatedAt,
          expectedUpdatedAt,
          "CONFERENCE_UPDATE_CONFLICT",
        );
        const activeAbstractCount = await tx.conferenceAbstract.count({
          where: { conferenceId, deletedAt: null },
        });
        if (activeAbstractCount > 0) {
          throw new ConflictException({
            message: "CONFERENCE_HAS_ACTIVE_ABSTRACTS",
            activeAbstractCount,
          });
        }
        const deleted = await tx.conference.update({
          where: { id: conferenceId },
          data: { deletedAt: new Date() },
        });
        await tx.authAuditLog.create({
          data: {
            actorUserId,
            eventType: "CONFERENCE_DELETED",
            result: "success",
            requestId,
            metadata: this.conferenceAuditSnapshot(deleted),
          },
        });
        return deleted;
      },
      { isolationLevel: "Serializable" },
    );
  }

  async restoreConference(
    conferenceId: string,
    organizationId: string | undefined,
    actorUserId: string,
    requestId: string,
  ) {
    return this.prisma.client.$transaction(
      async (tx) => {
        const current = await tx.conference.findFirst({
          where: { id: conferenceId, organizationId, deletedAt: { not: null } },
        });
        if (!current) throw new NotFoundException("CONFERENCE_NOT_FOUND");
        const restored = await tx.conference.update({
          where: { id: conferenceId },
          data: { deletedAt: null },
        });
        await tx.authAuditLog.create({
          data: {
            actorUserId,
            eventType: "CONFERENCE_RESTORED",
            result: "success",
            requestId,
            metadata: this.conferenceAuditSnapshot(restored),
          },
        });
        return restored;
      },
      { isolationLevel: "Serializable" },
    );
  }

  async deleteAbstract(
    abstractId: string,
    expectedUpdatedAt: string | undefined,
    organizationId: string | undefined,
    actorUserId: string,
    requestId: string,
  ) {
    return this.prisma.client.$transaction(
      async (tx) => {
        const current = await tx.conferenceAbstract.findFirst({
          where: {
            id: abstractId,
            conference: { organizationId },
          },
        });
        if (!current)
          throw new NotFoundException("CONFERENCE_ABSTRACT_NOT_FOUND");
        if (current.deletedAt) {
          throw new ConflictException("CONFERENCE_ABSTRACT_ALREADY_DELETED");
        }
        this.assertExpectedUpdatedAt(
          current.updatedAt,
          expectedUpdatedAt,
          "CONFERENCE_ABSTRACT_UPDATE_CONFLICT",
        );
        const deleted = await tx.conferenceAbstract.update({
          where: { id: abstractId },
          data: { deletedAt: new Date() },
        });
        await tx.authAuditLog.create({
          data: {
            actorUserId,
            eventType: "CONFERENCE_ABSTRACT_DELETED",
            result: "success",
            requestId,
            metadata: this.abstractAuditSnapshot(deleted),
          },
        });
        return deleted;
      },
      { isolationLevel: "Serializable" },
    );
  }

  async restoreAbstract(
    abstractId: string,
    organizationId: string | undefined,
    actorUserId: string,
    requestId: string,
  ) {
    return this.prisma.client.$transaction(
      async (tx) => {
        const current = await tx.conferenceAbstract.findFirst({
          where: {
            id: abstractId,
            deletedAt: { not: null },
            conference: { organizationId, deletedAt: null },
          },
        });
        if (!current)
          throw new NotFoundException("CONFERENCE_ABSTRACT_NOT_FOUND");
        const restored = await tx.conferenceAbstract.update({
          where: { id: abstractId },
          data: { deletedAt: null },
        });
        await tx.authAuditLog.create({
          data: {
            actorUserId,
            eventType: "CONFERENCE_ABSTRACT_RESTORED",
            result: "success",
            requestId,
            metadata: this.abstractAuditSnapshot(restored),
          },
        });
        return restored;
      },
      { isolationLevel: "Serializable" },
    );
  }

  private abstractData(
    body: CreateAdminConferenceAbstractDto | UpdateAdminConferenceAbstractDto,
  ) {
    return {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.sourceUrl !== undefined
        ? { sourceUrl: nullable(body.sourceUrl) }
        : {}),
      ...(body.firstAuthorName !== undefined
        ? { firstAuthorName: nullable(body.firstAuthorName) }
        : {}),
      ...(body.firstAuthorOrganization !== undefined
        ? { firstAuthorOrganization: nullable(body.firstAuthorOrganization) }
        : {}),
      ...(body.authors !== undefined ? { authors: body.authors } : {}),
      ...(body.meeting !== undefined
        ? { meeting: nullable(body.meeting) }
        : {}),
      ...(body.sessionType !== undefined
        ? { sessionType: nullable(body.sessionType) }
        : {}),
      ...(body.sessionTitle !== undefined
        ? { sessionTitle: nullable(body.sessionTitle) }
        : {}),
      ...(body.track !== undefined ? { track: nullable(body.track) } : {}),
      ...(body.subTrack !== undefined
        ? { subTrack: nullable(body.subTrack) }
        : {}),
      ...(body.abstractNumber !== undefined
        ? { abstractNumber: nullable(body.abstractNumber) }
        : {}),
      ...(body.posterNumber !== undefined
        ? { posterNumber: nullable(body.posterNumber) }
        : {}),
      ...(body.clinicalTrialRegistrationNumber !== undefined
        ? {
            clinicalTrialRegistrationNumber: nullable(
              body.clinicalTrialRegistrationNumber,
            ),
          }
        : {}),
      ...(body.dateOpen !== undefined ? { dateOpen: date(body.dateOpen) } : {}),
      ...(body.contentsJson !== undefined
        ? { contents: contents(body.contentsJson) as any }
        : {}),
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
    if (!conference) throw new NotFoundException("CONFERENCE_NOT_FOUND");
  }

  private assertExpectedUpdatedAt(
    actual: Date,
    expected: string | undefined,
    errorCode: string,
  ): void {
    if (!expected) return;
    if (actual.getTime() !== new Date(expected).getTime()) {
      throw new ConflictException(errorCode);
    }
  }

  private conferenceAuditSnapshot(conference: {
    id: string;
    organizationId: string;
    sourceSystem: string;
    title: string;
    abbreviation: string;
    year: number;
    status: string;
    deletedAt?: Date | null;
  }) {
    return {
      conferenceId: conference.id,
      organizationId: conference.organizationId,
      sourceSystem: conference.sourceSystem,
      title: conference.title,
      abbreviation: conference.abbreviation,
      year: conference.year,
      status: conference.status,
      deleted: Boolean(conference.deletedAt),
    };
  }

  private abstractAuditSnapshot(abstract: {
    id: string;
    conferenceId: string;
    sourceSystem: string;
    title: string;
    abstractNumber: string | null;
    deletedAt?: Date | null;
  }) {
    return {
      abstractId: abstract.id,
      conferenceId: abstract.conferenceId,
      sourceSystem: abstract.sourceSystem,
      title: abstract.title,
      abstractNumber: abstract.abstractNumber,
      deleted: Boolean(abstract.deletedAt),
    };
  }

  private rethrowConflict(error: unknown): never {
    const candidate = error as { code?: string };
    if (candidate?.code === "P2002") {
      throw new ConflictException("CONFERENCE_ABBREVIATION_YEAR_DUPLICATED");
    }
    throw error;
  }
}
