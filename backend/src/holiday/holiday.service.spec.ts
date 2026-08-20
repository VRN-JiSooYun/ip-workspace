import { GoogleCalendarClient } from "./google-calendar.client";
import { HolidayService } from "./holiday.service";
import { GoogleCalendarEvent } from "./holiday.types";

const CONFIG = {
  "googleCalendar.holidayCalendarIds": ["holidays@example.com"],
  "googleCalendar.observanceMarkers": ["observance", "관습일"],
  "googleCalendar.cacheTtlMs": 60_000,
} as const;

const configWith = (overrides: Record<string, unknown> = {}) =>
  ({
    get: (key: string, fallback?: unknown) =>
      ({ ...CONFIG, ...overrides })[key as keyof typeof CONFIG] ?? fallback,
  }) as never;

const clientWith = (
  events: GoogleCalendarEvent[],
  isConfigured = true,
): { client: GoogleCalendarClient; listEvents: jest.Mock } => {
  const listEvents = jest.fn().mockResolvedValue(events);
  return {
    client: { isConfigured, listEvents } as unknown as GoogleCalendarClient,
    listEvents,
  };
};

const allDay = (
  summary: string,
  start: string,
  endExclusive: string,
  description?: string,
): GoogleCalendarEvent => ({
  summary,
  description,
  start: { date: start },
  end: { date: endExclusive },
});

describe("HolidayService", () => {
  it("종일 일정을 배타적 end 기준으로 펼친다", async () => {
    const { client } = clientWith([
      allDay("여름 단체휴가", "2026-08-03", "2026-08-08"),
    ]);
    const service = new HolidayService(client, configWith());

    const result = await service.findByYear(2026);

    expect(result.configured).toBe(true);
    expect(result.holidays.map((holiday) => holiday.date)).toEqual([
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
    ]);
  });

  it("하루짜리 일정은 그 하루만 반환한다", async () => {
    const { client } = clientWith([
      allDay("광복절", "2026-08-15", "2026-08-16"),
    ]);
    const service = new HolidayService(client, configWith());

    const result = await service.findByYear(2026);

    expect(result.holidays).toEqual([
      { date: "2026-08-15", name: "광복절", calendarId: "holidays@example.com" },
    ]);
  });

  it("description이 기념일로 표시된 일정은 제외한다", async () => {
    const { client } = clientWith([
      allDay("광복절", "2026-08-15", "2026-08-16", "공휴일"),
      allDay("어버이날", "2026-05-08", "2026-05-09", "Observance"),
    ]);
    const service = new HolidayService(client, configWith());

    const result = await service.findByYear(2026);

    expect(result.holidays.map((holiday) => holiday.name)).toEqual(["광복절"]);
  });

  it("description이 없는 일정은 휴무로 본다 (사내 캘린더)", async () => {
    const { client } = clientWith([
      allDay("창립기념일", "2026-04-01", "2026-04-02"),
    ]);
    const service = new HolidayService(client, configWith());

    const result = await service.findByYear(2026);

    expect(result.holidays.map((holiday) => holiday.name)).toEqual([
      "창립기념일",
    ]);
  });

  it("연 경계를 넘어간 날짜는 잘라낸다", async () => {
    const { client } = clientWith([
      allDay("연말연시 휴무", "2026-12-30", "2027-01-03"),
    ]);
    const service = new HolidayService(client, configWith());

    const result = await service.findByYear(2026);

    expect(result.holidays.map((holiday) => holiday.date)).toEqual([
      "2026-12-30",
      "2026-12-31",
    ]);
  });

  it("취소된 일정과 제목 없는 일정은 건너뛴다", async () => {
    const { client } = clientWith([
      { ...allDay("취소됨", "2026-03-02", "2026-03-03"), status: "cancelled" },
      allDay("", "2026-03-04", "2026-03-05"),
      allDay("삼일절 대체공휴일", "2026-03-02", "2026-03-03"),
    ]);
    const service = new HolidayService(client, configWith());

    const result = await service.findByYear(2026);

    expect(result.holidays.map((holiday) => holiday.name)).toEqual([
      "삼일절 대체공휴일",
    ]);
  });

  it("같은 날이 여러 캘린더에 있으면 앞선 캘린더가 이긴다", async () => {
    const listEvents = jest
      .fn()
      .mockResolvedValueOnce([allDay("공휴일 쪽 이름", "2026-05-05", "2026-05-06")])
      .mockResolvedValueOnce([allDay("사내 쪽 이름", "2026-05-05", "2026-05-06")]);
    const client = {
      isConfigured: true,
      listEvents,
    } as unknown as GoogleCalendarClient;
    const service = new HolidayService(
      client,
      configWith({
        "googleCalendar.holidayCalendarIds": ["public@example.com", "company@example.com"],
      }),
    );

    const result = await service.findByYear(2026);

    expect(result.holidays).toEqual([
      {
        date: "2026-05-05",
        name: "공휴일 쪽 이름",
        calendarId: "public@example.com",
      },
    ]);
  });

  it("같은 연도를 두 번 물어도 상위 API는 한 번만 부른다", async () => {
    const { client, listEvents } = clientWith([
      allDay("광복절", "2026-08-15", "2026-08-16"),
    ]);
    const service = new HolidayService(client, configWith());

    await service.findByYear(2026);
    await service.findByYear(2026);

    expect(listEvents).toHaveBeenCalledTimes(1);
  });

  it("자격증명이 없으면 오류 대신 configured=false를 준다", async () => {
    const { client, listEvents } = clientWith([], false);
    const service = new HolidayService(client, configWith());

    const result = await service.findByYear(2026);

    expect(result).toEqual({ year: 2026, configured: false, holidays: [] });
    expect(listEvents).not.toHaveBeenCalled();
  });
});
