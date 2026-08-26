import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type {
  CalendarEventQueryDto,
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
} from "./dto/calendar-event.dto";

/**
 * 일정을 다루는 사람. controller가 WorkspaceAccessContext에서 뽑아 준다.
 * service는 요청 객체를 모르고 이 두 값만 본다(테스트가 쉬워진다).
 */
export type CalendarActor = {
  userId: string;
  teamIds: string[];
};

/** 한 번에 물을 수 있는 최대 기간. 달력이 보는 것은 길어야 몇 달이다. */
const MAX_RANGE_DAYS = 400;
/** 한 번에 돌려줄 최대 건수. 달력이 그릴 수 있는 양을 넘으면 어차피 읽히지 않는다. */
const MAX_ITEMS = 1000;

/**
 * `YYYY-MM-DD` ↔ date-only UTC 시각.
 *
 * column이 `date`라 시각이 없다. UTC 자정으로 고정해서 서버 시간대와 무관하게 같은 날짜를
 * 가리키게 한다(patent-record.service의 같은 이름 함수와 같은 이유·같은 규칙이다).
 */
const toDateKey = (value: Date): string => value.toISOString().slice(0, 10);

const fromDateKey = (value: string): Date => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const daysBetween = (from: string, to: string): number =>
  Math.round(
    (fromDateKey(to).getTime() - fromDateKey(from).getTime()) / 86_400_000,
  );

const EVENT_SELECT = {
  id: true,
  ownerId: true,
  teamId: true,
  visibility: true,
  title: true,
  startDate: true,
  endDate: true,
  allDay: true,
  startTime: true,
  endTime: true,
  color: true,
  memo: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, name: true } },
  team: { select: { id: true, name: true } },
} as const;

type EventRow = {
  id: string;
  ownerId: string;
  teamId: string | null;
  visibility: string;
  title: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  color: string;
  memo: string | null;
  createdAt: Date;
  updatedAt: Date;
  owner: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
};

@Injectable()
export class CalendarEventService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 기간이 겹치는 일정. 내 것과 내 팀에 공개된 것을 함께 준다.
   *
   * "겹친다"는 `start <= to && end >= from`이다. 시작일만 보면 구간 앞에서 시작해 구간
   * 안까지 이어지는 여러 날짜 일정이 빠진다.
   */
  async list(query: CalendarEventQueryDto, actor: CalendarActor) {
    if (query.from > query.to) {
      throw new BadRequestException("CALENDAR_EVENT_INVALID_RANGE");
    }
    if (daysBetween(query.from, query.to) > MAX_RANGE_DAYS) {
      throw new BadRequestException("CALENDAR_EVENT_RANGE_TOO_WIDE");
    }

    const rows = (await this.prisma.client.calendarEvent.findMany({
      where: {
        startDate: { lte: fromDateKey(query.to) },
        endDate: { gte: fromDateKey(query.from) },
        OR: [
          { ownerId: actor.userId },
          // 팀이 없으면 in: []이라 아무것도 걸리지 않는다(내 것만 남는다).
          { visibility: "TEAM", teamId: { in: actor.teamIds } },
        ],
      },
      select: EVENT_SELECT,
      orderBy: [{ startDate: "asc" }, { startTime: "asc" }, { title: "asc" }],
      take: MAX_ITEMS,
    })) as EventRow[];

    return rows.map((row) => this.toResponse(row, actor));
  }

  async create(dto: CreateCalendarEventDto, actor: CalendarActor) {
    const data = this.normalize(dto, actor);
    const row = (await this.prisma.client.calendarEvent.create({
      data: { ...data, ownerId: actor.userId },
      select: EVENT_SELECT,
    })) as EventRow;
    return this.toResponse(row, actor);
  }

  /** 고치는 것은 만든 사람만 한다. 팀 공개는 '보이는 범위'일 뿐 '고칠 권한'이 아니다. */
  async update(id: string, dto: UpdateCalendarEventDto, actor: CalendarActor) {
    await this.assertOwned(id, actor);
    const row = (await this.prisma.client.calendarEvent.update({
      where: { id },
      data: this.normalize(dto, actor),
      select: EVENT_SELECT,
    })) as EventRow;
    return this.toResponse(row, actor);
  }

  async remove(id: string, actor: CalendarActor) {
    await this.assertOwned(id, actor);
    await this.prisma.client.calendarEvent.delete({ where: { id } });
    return { id };
  }

  private async assertOwned(id: string, actor: CalendarActor) {
    const existing = await this.prisma.client.calendarEvent.findUnique({
      where: { id },
      select: { id: true, ownerId: true },
    });
    if (!existing) throw new NotFoundException("CALENDAR_EVENT_NOT_FOUND");
    if (existing.ownerId !== actor.userId) {
      throw new ForbiddenException("CALENDAR_EVENT_FORBIDDEN");
    }
    return existing;
  }

  /**
   * 저장 가능한 모양으로 다듬으면서 서로 얽힌 규칙을 한 곳에서 지킨다.
   *
   * 화면에도 같은 규칙이 있지만 여기서 다시 본다. API는 화면 말고도 부를 수 있고, 어긋난
   * 조합(종일인데 시각이 있는, 팀 공개인데 팀이 없는)이 들어오면 달력이 그리지 못한다.
   */
  private normalize(dto: CreateCalendarEventDto, actor: CalendarActor) {
    const title = dto.title.trim();
    if (!title) throw new BadRequestException("CALENDAR_EVENT_TITLE_REQUIRED");
    if (dto.start > dto.end) {
      throw new BadRequestException("CALENDAR_EVENT_INVALID_RANGE");
    }

    const allDay = dto.allDay || !dto.startTime || !dto.endTime;
    const startTime = allDay ? null : (dto.startTime ?? null);
    const endTime = allDay ? null : (dto.endTime ?? null);
    // 하루 안에서는 끝이 시작보다 뒤여야 한다. 여러 날짜면 끝 시각이 앞서는 것이 정상이다.
    if (!allDay && dto.start === dto.end && endTime! <= startTime!) {
      throw new BadRequestException("CALENDAR_EVENT_INVALID_TIME_RANGE");
    }

    const isTeam = dto.visibility === "TEAM";
    if (isTeam && !dto.teamId) {
      throw new BadRequestException("CALENDAR_EVENT_TEAM_REQUIRED");
    }
    if (isTeam && !actor.teamIds.includes(dto.teamId!)) {
      throw new ForbiddenException("CALENDAR_EVENT_TEAM_FORBIDDEN");
    }

    return {
      title,
      startDate: fromDateKey(dto.start),
      endDate: fromDateKey(dto.end),
      allDay,
      startTime,
      endTime,
      color: dto.color,
      memo: dto.memo?.trim() ? dto.memo.trim() : null,
      visibility: dto.visibility,
      // 비공개로 되돌리면 팀 연결도 끊는다. 남겨 두면 나중에 공개 범위와 팀이 어긋난다.
      teamId: isTeam ? dto.teamId! : null,
    };
  }

  /**
   * 화면이 쓰는 모양. 날짜는 `YYYY-MM-DD` 문자열로 준다(달력이 그대로 쓴다).
   *
   * `canEdit`을 서버가 계산해 주는 이유: 남의 팀 일정에 수정·삭제 버튼을 그리지 않으려면
   * 화면이 소유자를 알아야 하는데, 판단 규칙이 두 곳에 생기면 언젠가 갈린다.
   */
  private toResponse(row: EventRow, actor: CalendarActor) {
    return {
      id: row.id,
      title: row.title,
      start: toDateKey(row.startDate),
      end: toDateKey(row.endDate),
      allDay: row.allDay,
      startTime: row.startTime,
      endTime: row.endTime,
      color: row.color,
      memo: row.memo,
      visibility: row.visibility,
      teamId: row.teamId,
      teamName: row.team?.name ?? null,
      owner: { id: row.ownerId, name: row.owner?.name ?? "" },
      canEdit: row.ownerId === actor.userId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
