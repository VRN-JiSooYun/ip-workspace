import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../database/prisma.service";
import type { ConferenceAbstractSearchQueryDto } from "./dto/conference-abstract-search-query.dto";

const parseDate = (value?: string): Date | undefined =>
  value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : undefined;

const assertDateRange = (dateFrom?: string, dateTo?: string): void => {
  if (dateFrom && dateTo && dateFrom.slice(0, 10) > dateTo.slice(0, 10)) {
    throw new BadRequestException("INVALID_DATE_RANGE");
  }
};

const assetDto = (asset: {
  id: string;
  kind: string;
  originalFilename: string;
  mimeType: string | null;
  byteSize: bigint | null;
  sortOrder?: number;
}) => ({
  id: asset.id,
  kind: asset.kind,
  filename: asset.originalFilename,
  mimeType: asset.mimeType,
  byteSize: asset.byteSize === null ? null : asset.byteSize.toString(),
  sortOrder: asset.sortOrder ?? 0,
  contentUrl: `/api/conference-assets/${asset.id}/content`,
  downloadUrl:
    asset.kind === "VIDEO"
      ? null
      : `/api/conference-assets/${asset.id}/download`,
});

@Injectable()
export class ConferenceReadService {
  constructor(private readonly prisma: PrismaService) {}

  async getConference(conferenceId: string, organizationId?: string) {
    const conference = await this.prisma.client.conference.findFirst({
      where: { id: conferenceId, deletedAt: null, organizationId },
      include: {
        assets: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            kind: true,
            originalFilename: true,
            mimeType: true,
            byteSize: true,
          },
        },
        _count: { select: { abstracts: { where: { deletedAt: null } } } },
      },
    });
    if (!conference) throw new NotFoundException("CONFERENCE_NOT_FOUND");
    return {
      id: conference.id,
      title: conference.title,
      abbreviation: conference.abbreviation,
      fullTitle: conference.fullTitle,
      year: conference.year,
      status: conference.status,
      sourceUrl: conference.sourceUrl,
      dateStart: conference.dateStart,
      dateEnd: conference.dateEnd,
      abstractCount: conference._count.abstracts,
      assets: conference.assets.map(assetDto),
    };
  }

  async searchAbstracts(
    userId: string,
    query: ConferenceAbstractSearchQueryDto,
    organizationId?: string,
  ) {
    assertDateRange(query.dateFrom, query.dateTo);
    const q = query.q?.trim();
    const dateFrom = parseDate(query.dateFrom);
    const dateTo = parseDate(query.dateTo);
    const conferenceWhere: Prisma.ConferenceWhereInput = {
      deletedAt: null,
      organizationId,
      ...(query.conferenceIds?.length
        ? { id: { in: query.conferenceIds } }
        : {}),
      ...(query.years?.length ? { year: { in: query.years } } : {}),
      ...(query.dateField === "conferencePeriod" && dateFrom
        ? { dateEnd: { gte: dateFrom } }
        : {}),
      ...(query.dateField === "conferencePeriod" && dateTo
        ? { dateStart: { lte: dateTo } }
        : {}),
    };
    const and: Prisma.ConferenceAbstractWhereInput[] = [];

    if (q) {
      const insensitive = { contains: q, mode: "insensitive" as const };
      const abstractNumber = { abstractNumber: insensitive };
      const title = { title: insensitive };
      const authorConditions: Prisma.ConferenceAbstractWhereInput[] = [
        { firstAuthorName: insensitive },
        { firstAuthorOrganization: insensitive },
      ];
      const conferenceCondition: Prisma.ConferenceAbstractWhereInput = {
        conference: {
          OR: [
            { title: insensitive },
            { abbreviation: insensitive },
            { fullTitle: insensitive },
          ],
        },
      };
      const searchConditions: Prisma.ConferenceAbstractWhereInput[] =
        query.searchField === "conference"
          ? [conferenceCondition]
          : query.searchField === "title"
            ? [title]
            : query.searchField === "author"
              ? authorConditions
              : query.searchField === "abstractNumber"
                ? [abstractNumber]
                : [
                    title,
                    abstractNumber,
                    ...authorConditions,
                    conferenceCondition,
                    { meeting: insensitive },
                    { sessionType: insensitive },
                    { sessionTitle: insensitive },
                    { track: insensitive },
                    { subTrack: insensitive },
                  ];
      and.push({ OR: searchConditions });
    }
    if (query.favoriteOnly) {
      and.push({ bookmarks: { some: { userId } } });
    }
    if (query.dateField === "dateOpen" && (dateFrom || dateTo)) {
      and.push({
        dateOpen: {
          ...(dateFrom ? { gte: dateFrom } : {}),
          ...(dateTo ? { lte: dateTo } : {}),
        },
      });
    }
    if (query.hasPoster) and.push({ assets: { some: { kind: "POSTER" } } });
    if (query.hasVideo) and.push({ assets: { some: { kind: "VIDEO" } } });
    if (query.hasDocument) and.push({ assets: { some: { kind: "DOCUMENT" } } });

    const where: Prisma.ConferenceAbstractWhereInput = {
      deletedAt: null,
      conference: conferenceWhere,
      ...(and.length ? { AND: and } : {}),
    };
    const orderBy: Prisma.ConferenceAbstractOrderByWithRelationInput[] =
      query.sort === "titleAsc"
        ? [{ title: "asc" }, { id: "asc" }]
        : query.sort === "dateOpenDesc"
          ? [{ dateOpen: "desc" }, { title: "asc" }, { id: "asc" }]
          : query.sort === "commentCountDesc"
            ? [
                { comments: { _count: "desc" } },
                { abstractNumber: "asc" },
                { id: "asc" },
              ]
            : query.sort === "abstractNumberAsc"
              ? [
                  { conference: { year: "desc" } },
                  { abstractNumber: "asc" },
                  { id: "asc" },
                ]
              : [
                  { conference: { year: "desc" } },
                  { conference: { abbreviation: "asc" } },
                  { abstractNumber: "asc" },
                  { id: "asc" },
                ];
    const [items, total, facetConferences] = await Promise.all([
      this.prisma.client.conferenceAbstract.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          conference: {
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
          },
          bookmarks: { where: { userId }, select: { userId: true } },
          assets: {
            select: { kind: true },
          },
          _count: {
            select: {
              comments: { where: { deletedAt: null } },
            },
          },
        },
      }),
      this.prisma.client.conferenceAbstract.count({ where }),
      this.prisma.client.conference.findMany({
        where: {
          deletedAt: null,
          organizationId,
          abstracts: { some: { deletedAt: null } },
        },
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
      }),
    ]);
    return {
      items: items.map((abstract) => {
        const assetCounts = abstract.assets.reduce(
          (counts, asset) => {
            counts[asset.kind] = (counts[asset.kind] ?? 0) + 1;
            return counts;
          },
          {} as Partial<Record<string, number>>,
        );
        return {
          id: abstract.id,
          conference: abstract.conference,
          abstractNumber: abstract.abstractNumber,
          title: abstract.title,
          firstAuthorName: abstract.firstAuthorName,
          firstAuthorOrganization: abstract.firstAuthorOrganization,
          meeting: abstract.meeting,
          sessionType: abstract.sessionType,
          sessionTitle: abstract.sessionTitle,
          track: abstract.track,
          dateOpen: abstract.dateOpen,
          isFavorite: abstract.bookmarks.length > 0,
          commentCount: abstract._count.comments,
          assetSummary: {
            posterCount: assetCounts.POSTER ?? 0,
            videoCount: assetCounts.VIDEO ?? 0,
            documentCount: assetCounts.DOCUMENT ?? 0,
            referenceImageCount: assetCounts.REFERENCE_IMAGE ?? 0,
          },
        };
      }),
      page: query.page,
      pageSize: query.pageSize,
      total,
      hasNext: query.page * query.pageSize < total,
      facets: {
        conferences: facetConferences,
        years: [...new Set(facetConferences.map(({ year }) => year))],
      },
    };
  }

  async getAbstract(
    userId: string,
    abstractId: string,
    organizationId?: string,
  ) {
    const abstract = await this.prisma.client.conferenceAbstract.findFirst({
      where: {
        id: abstractId,
        deletedAt: null,
        conference: { deletedAt: null, organizationId },
      },
      include: {
        conference: {
          select: {
            id: true,
            title: true,
            abbreviation: true,
            fullTitle: true,
            year: true,
          },
        },
        bookmarks: { where: { userId }, select: { userId: true } },
        assets: {
          orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
          select: {
            id: true,
            kind: true,
            originalFilename: true,
            mimeType: true,
            byteSize: true,
            sortOrder: true,
          },
        },
        comments: {
          where: { deletedAt: null },
          orderBy: [
            { createdAt: "asc" },
            { legacyOrder: "asc" },
            { id: "asc" },
          ],
          select: {
            id: true,
            content: true,
            createdAt: true,
            updatedAt: true,
            sourceSystem: true,
            sourceCreatedAt: true,
            authorNameSnapshot: true,
            author: { select: { id: true, name: true, email: true } },
            legacyAuthorRecipient: {
              select: { id: true, name: true, email: true },
            },
            mentions: {
              select: {
                mentionedRecipient: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
            mailOutboxes: {
              where: { recipientId: null },
              select: { recipientEmailSnapshot: true },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });
    if (!abstract) throw new NotFoundException("CONFERENCE_ABSTRACT_NOT_FOUND");
    return {
      id: abstract.id,
      conference: abstract.conference,
      title: abstract.title,
      sourceUrl: abstract.sourceUrl,
      firstAuthorName: abstract.firstAuthorName,
      firstAuthorOrganization: abstract.firstAuthorOrganization,
      firstAuthorUrl: abstract.firstAuthorUrl,
      authors: abstract.authors,
      authorOrganizations: abstract.authorOrganizations,
      organizations: abstract.organizations,
      contents: abstract.contents,
      meeting: abstract.meeting,
      meetingUrl: abstract.meetingUrl,
      sessionType: abstract.sessionType,
      sessionTypeUrl: abstract.sessionTypeUrl,
      sessionTitle: abstract.sessionTitle,
      sessionTitleUrl: abstract.sessionTitleUrl,
      track: abstract.track,
      trackUrl: abstract.trackUrl,
      subTrack: abstract.subTrack,
      subTrackUrl: abstract.subTrackUrl,
      abstractNumber: abstract.abstractNumber,
      posterNumber: abstract.posterNumber,
      clinicalTrialRegistrationNumber: abstract.clinicalTrialRegistrationNumber,
      dateOpen: abstract.dateOpen,
      isFavorite: abstract.bookmarks.length > 0,
      assets: abstract.assets.map(assetDto),
      comments: abstract.comments.map((comment) => ({
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        sourceSystem: comment.sourceSystem,
        sourceCreatedAt: comment.sourceCreatedAt,
        author: comment.author ?? {
          id: null,
          name:
            comment.authorNameSnapshot ||
            comment.legacyAuthorRecipient?.name ||
            "이관 사용자",
          email: comment.legacyAuthorRecipient?.email || "",
        },
        mentionedRecipients: comment.mentions.map(
          (mention) => mention.mentionedRecipient,
        ),
        directRecipientEmails: comment.mailOutboxes.map(
          (outbox) => outbox.recipientEmailSnapshot,
        ),
      })),
    };
  }
}
