import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { ConferenceAbstractListQueryDto } from './dto/conference-abstract-list-query.dto';
import type { ConferenceListQueryDto } from './dto/conference-list-query.dto';

const parseDate = (value?: string): Date | undefined => (
  value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : undefined
);

const assertDateRange = (dateFrom?: string, dateTo?: string): void => {
  if (dateFrom && dateTo && dateFrom.slice(0, 10) > dateTo.slice(0, 10)) {
    throw new BadRequestException('INVALID_DATE_RANGE');
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
  downloadUrl: asset.kind === 'VIDEO'
    ? null
    : `/api/conference-assets/${asset.id}/download`,
});

@Injectable()
export class ConferenceReadService {
  constructor(private readonly prisma: PrismaService) {}

  async listConferences(userId: string, query: ConferenceListQueryDto) {
    assertDateRange(query.dateFrom, query.dateTo);
    const q = query.q?.trim();
    const dateFrom = parseDate(query.dateFrom);
    const dateTo = parseDate(query.dateTo);
    const where = {
      deletedAt: null,
      ...(q ? {
        OR: [
          { title: { contains: q, mode: 'insensitive' as const } },
          { abbreviation: { contains: q, mode: 'insensitive' as const } },
          { fullTitle: { contains: q, mode: 'insensitive' as const } },
        ],
      } : {}),
      ...(query.favoriteOnly ? {
        bookmarks: { some: { userId } },
      } : {}),
      ...(dateFrom ? { dateEnd: { gte: dateFrom } } : {}),
      ...(dateTo ? { dateStart: { lte: dateTo } } : {}),
    };
    const orderBy = query.sort === 'titleAsc'
      ? [{ title: 'asc' as const }]
      : [{ year: 'desc' as const }, { title: 'asc' as const }];
    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.conference.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          bookmarks: { where: { userId }, select: { userId: true } },
          assets: {
            where: { kind: 'LOGO' },
            select: {
              id: true,
              kind: true,
              originalFilename: true,
              mimeType: true,
              byteSize: true,
            },
            take: 1,
          },
          _count: {
            select: { abstracts: { where: { deletedAt: null } } },
          },
        },
      }),
      this.prisma.client.conference.count({ where }),
    ]);
    return {
      items: items.map((conference) => ({
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
        isFavorite: conference.bookmarks.length > 0,
        logo: conference.assets[0] ? assetDto(conference.assets[0]) : null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      hasNext: query.page * query.pageSize < total,
    };
  }

  async getConference(userId: string, conferenceId: string) {
    const conference = await this.prisma.client.conference.findFirst({
      where: { id: conferenceId, deletedAt: null },
      include: {
        bookmarks: { where: { userId }, select: { userId: true } },
        assets: {
          orderBy: { createdAt: 'asc' },
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
    if (!conference) throw new NotFoundException('CONFERENCE_NOT_FOUND');
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
      isFavorite: conference.bookmarks.length > 0,
      assets: conference.assets.map(assetDto),
    };
  }

  async listAbstracts(
    userId: string,
    conferenceId: string,
    query: ConferenceAbstractListQueryDto,
  ) {
    assertDateRange(query.dateFrom, query.dateTo);
    const conference = await this.prisma.client.conference.findFirst({
      where: { id: conferenceId, deletedAt: null },
      select: { id: true, title: true, abbreviation: true, year: true },
    });
    if (!conference) throw new NotFoundException('CONFERENCE_NOT_FOUND');

    const q = query.q?.trim();
    const where = {
      conferenceId,
      deletedAt: null,
      ...(q ? {
        OR: [
          { title: { contains: q, mode: 'insensitive' as const } },
          { abstractNumber: { contains: q, mode: 'insensitive' as const } },
          { firstAuthorName: { contains: q, mode: 'insensitive' as const } },
          { firstAuthorOrganization: { contains: q, mode: 'insensitive' as const } },
          { meeting: { contains: q, mode: 'insensitive' as const } },
          { sessionType: { contains: q, mode: 'insensitive' as const } },
          { sessionTitle: { contains: q, mode: 'insensitive' as const } },
          { track: { contains: q, mode: 'insensitive' as const } },
          { subTrack: { contains: q, mode: 'insensitive' as const } },
        ],
      } : {}),
      ...(query.favoriteOnly ? { bookmarks: { some: { userId } } } : {}),
      ...(query.dateFrom ? { dateOpen: { gte: parseDate(query.dateFrom) } } : {}),
      ...(query.dateTo ? { dateOpen: { lte: parseDate(query.dateTo) } } : {}),
      ...(query.hasPoster ? { assets: { some: { kind: 'POSTER' as const } } } : {}),
      ...(query.hasVideo ? { assets: { some: { kind: 'VIDEO' as const } } } : {}),
      ...(query.hasDocument ? { assets: { some: { kind: 'DOCUMENT' as const } } } : {}),
    };
    const orderBy = query.sort === 'titleAsc'
      ? [{ title: 'asc' as const }]
      : query.sort === 'dateOpenDesc'
        ? [{ dateOpen: 'desc' as const }, { title: 'asc' as const }]
        : query.sort === 'commentCountDesc'
          ? [
            { comments: { _count: 'desc' as const } },
            { abstractNumber: 'asc' as const },
            { title: 'asc' as const },
          ]
          : [{ abstractNumber: 'asc' as const }, { title: 'asc' as const }];
    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.conferenceAbstract.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
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
    ]);
    return {
      conference,
      items: items.map((abstract) => {
        const kinds = new Set(abstract.assets.map((asset) => asset.kind));
        return {
          id: abstract.id,
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
            hasPoster: kinds.has('POSTER'),
            hasVideo: kinds.has('VIDEO'),
            hasDocument: kinds.has('DOCUMENT'),
            hasReferenceImage: kinds.has('REFERENCE_IMAGE'),
          },
        };
      }),
      page: query.page,
      pageSize: query.pageSize,
      total,
      hasNext: query.page * query.pageSize < total,
    };
  }

  async getAbstract(userId: string, abstractId: string) {
    const abstract = await this.prisma.client.conferenceAbstract.findFirst({
      where: {
        id: abstractId,
        deletedAt: null,
        conference: { deletedAt: null },
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
          orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }],
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
          orderBy: [{ createdAt: 'asc' }, { legacyOrder: 'asc' }, { id: 'asc' }],
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
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });
    if (!abstract) throw new NotFoundException('CONFERENCE_ABSTRACT_NOT_FOUND');
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
          name: comment.authorNameSnapshot || comment.legacyAuthorRecipient?.name || '이관 사용자',
          email: comment.legacyAuthorRecipient?.email || '',
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
