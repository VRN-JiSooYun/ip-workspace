import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleCalendarClient } from "./google-calendar.client";
import { Holiday, HolidayYearResult } from "./holiday.types";

/** 종일 일정의 날짜를 KST 기준 `YYYY-MM-DD`로 뽑기 위한 포매터. */
const SEOUL_DATE = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const shiftDate = (dateKey: string, offset: number): string => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return date.toISOString().slice(0, 10);
};

type CacheEntry = { result: HolidayYearResult; expiresAt: number };

@Injectable()
export class HolidayService {
  private readonly logger = new Logger(HolidayService.name);
  private readonly calendarIds: string[];
  private readonly observanceMarkers: string[];
  private readonly cacheTtlMs: number;

  private readonly cache = new Map<number, CacheEntry>();
  /** 같은 연도를 동시에 요청받아도 상위 API는 한 번만 부른다. */
  private readonly inFlight = new Map<number, Promise<HolidayYearResult>>();

  constructor(
    private readonly calendar: GoogleCalendarClient,
    private readonly configService: ConfigService,
  ) {
    this.calendarIds = this.configService.get<string[]>(
      "googleCalendar.holidayCalendarIds",
      [],
    );
    this.observanceMarkers = this.configService
      .get<string[]>("googleCalendar.observanceMarkers", [])
      .map((marker) => marker.toLowerCase());
    this.cacheTtlMs = this.configService.get<number>(
      "googleCalendar.cacheTtlMs",
      12 * 60 * 60 * 1000,
    );
  }

  async findByYear(year: number): Promise<HolidayYearResult> {
    if (!this.calendar.isConfigured || this.calendarIds.length === 0) {
      return { year, configured: false, holidays: [] };
    }

    const cached = this.cache.get(year);
    if (cached && cached.expiresAt > Date.now()) return cached.result;

    const existing = this.inFlight.get(year);
    if (existing) return existing;

    const request = this.fetchYear(year)
      .then((result) => {
        this.cache.set(year, {
          result,
          expiresAt: Date.now() + this.cacheTtlMs,
        });
        return result;
      })
      .finally(() => {
        this.inFlight.delete(year);
      });
    this.inFlight.set(year, request);
    return request;
  }

  private async fetchYear(year: number): Promise<HolidayYearResult> {
    // 종일 일정이므로 KST 기준 연 경계로 자른다.
    const timeMin = `${year}-01-01T00:00:00+09:00`;
    const timeMax = `${year + 1}-01-01T00:00:00+09:00`;

    /** 같은 날에 여러 캘린더가 걸리면 먼저 나온 캘린더의 이름을 쓴다. */
    const byDate = new Map<string, Holiday>();

    for (const calendarId of this.calendarIds) {
      const events = await this.calendar.listEvents(
        calendarId,
        timeMin,
        timeMax,
      );
      const skipped: string[] = [];

      for (const event of events) {
        if (event.status === "cancelled") continue;
        if (this.isObservance(event.description)) {
          if (event.description) skipped.push(event.description);
          continue;
        }
        const name = event.summary?.trim();
        if (!name) continue;

        for (const date of this.expandDates(event)) {
          if (date < `${year}-01-01` || date > `${year}-12-31`) continue;
          if (!byDate.has(date)) byDate.set(date, { date, name, calendarId });
        }
      }

      if (skipped.length > 0) {
        // 어떤 description이 걸러졌는지 남긴다. OBSERVANCE_MARKERS 조정용 근거다.
        this.logger.debug(
          `${calendarId}: skipped ${skipped.length} observance events (${[
            ...new Set(skipped),
          ].join(", ")})`,
        );
      }
    }

    const holidays = [...byDate.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    this.logger.log(
      `Loaded ${holidays.length} holidays for ${year} from ${this.calendarIds.length} calendar(s)`,
    );
    return { year, configured: true, holidays };
  }

  /**
   * 종일 일정은 `end.date`가 배타적이라 하루 이상 걸친 일정을 펼쳐야 한다.
   * (사내 휴무 캘린더의 "여름 단체휴가 8/3~8/7" 같은 일정이 여기 해당한다.)
   */
  private expandDates(event: {
    start?: { date?: string; dateTime?: string };
    end?: { date?: string; dateTime?: string };
  }): string[] {
    const start = event.start?.date ?? this.toSeoulDate(event.start?.dateTime);
    if (!start) return [];
    const endExclusive = event.end?.date;
    if (!endExclusive) {
      const end = this.toSeoulDate(event.end?.dateTime);
      return end && end !== start ? this.range(start, end, true) : [start];
    }
    return this.range(start, endExclusive, false);
  }

  private range(start: string, end: string, inclusive: boolean): string[] {
    const dates: string[] = [];
    let cursor = start;
    // 상한을 두어 잘못된 일정 하나가 응답을 부풀리지 못하게 한다.
    while (
      (inclusive ? cursor <= end : cursor < end) &&
      dates.length < 366
    ) {
      dates.push(cursor);
      cursor = shiftDate(cursor, 1);
    }
    return dates.length > 0 ? dates : [start];
  }

  private toSeoulDate(dateTime: string | undefined): string | undefined {
    if (!dateTime) return undefined;
    const parsed = new Date(dateTime);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return SEOUL_DATE.format(parsed);
  }

  /**
   * Google 공휴일 캘린더에는 공휴일이 아닌 기념일(어버이날·발렌타인데이 등)도 함께 들어 있고,
   * `description`으로만 구분된다. 표기가 로케일에 따라 달라질 수 있어 env로 조정한다.
   * description이 없는 일정(사내 캘린더가 보통 그렇다)은 휴무로 본다.
   */
  private isObservance(description: string | undefined): boolean {
    if (!description) return false;
    const normalized = description.toLowerCase();
    return this.observanceMarkers.some((marker) =>
      normalized.includes(marker),
    );
  }
}
