/**
 * Prisma 실물 client는 import만으로 DATABASE_URL을 요구한다. service를 unit test하려면
 * 이 모듈을 먼저 끊어야 한다(patent-record-deadlines.spec.ts와 같은 이유).
 */
jest.mock("../database/prisma.client", () => ({ prisma: {} }));

import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../database/prisma.service";
import { CalendarEventService, type CalendarActor } from "./calendar-event.service";
import type { CreateCalendarEventDto } from "./dto/calendar-event.dto";

/**
 * 확인하려는 것은 두 가지다.
 *   1) 어떤 where로 물었는가 — 기간이 "겹치는" 조건인가, 남의 일정을 끌어오지 않는가
 *   2) 어떤 조합을 거절하는가 — 종일/시각, 팀 공개/팀, 소유자
 * 둘 다 실제 DB 없이 확인해야 하는 것이라 Prisma를 통째로 가짜로 세운다.
 */

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

const row = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "e1",
  ownerId: "me",
  teamId: null,
  visibility: "PRIVATE",
  title: "회의",
  startDate: day("2026-08-25"),
  endDate: day("2026-08-25"),
  allDay: true,
  startTime: null,
  endTime: null,
  color: "purple",
  memo: null,
  createdAt: day("2026-08-01"),
  updatedAt: day("2026-08-01"),
  owner: { id: "me", name: "김가이" },
  team: null,
  patentId: null,
  patent: null,
  ...overrides,
});

const makePrisma = (
  options: { rows?: any[]; existing?: any; patents?: number[] } = {},
) => {
  const calls = {
    findMany: [] as any[],
    create: [] as any[],
    update: [] as any[],
    delete: [] as any[],
  };

  const client = {
    calendarEvent: {
      findMany: async (args: any) => {
        calls.findMany.push(args);
        return options.rows ?? [];
      },
      findUnique: async () => options.existing ?? null,
      create: async (args: any) => {
        calls.create.push(args);
        return row({ ...args.data, owner: { id: args.data.ownerId, name: "김가이" } });
      },
      update: async (args: any) => {
        calls.update.push(args);
        return row({ ...args.data, id: args.where.id });
      },
      delete: async (args: any) => {
        calls.delete.push(args);
        return { id: args.where.id };
      },
    },
    // 일정에 특허를 연결할 때 그 특허가 실재하는지 본다.
    patent: {
      findUnique: async (args: any) =>
        (options.patents ?? []).includes(args.where.id)
          ? { id: args.where.id }
          : null,
    },
  };

  return { service: new CalendarEventService({ client } as unknown as PrismaService), calls };
};

const ACTOR: CalendarActor = { userId: "me", teamIds: ["t1", "t2"] };

const input = (overrides: Partial<CreateCalendarEventDto> = {}): CreateCalendarEventDto => ({
  title: "회의",
  start: "2026-08-25",
  end: "2026-08-25",
  allDay: true,
  color: "purple",
  visibility: "PRIVATE",
  ...overrides,
});

describe("CalendarEventService.list", () => {
  it("기간이 겹치는 일정을 묻는다(시작일만 보지 않는다)", async () => {
    const { service, calls } = makePrisma();
    await service.list({ from: "2026-08-01", to: "2026-08-31" }, ACTOR);

    const where = calls.findMany[0].where;
    expect(where.startDate).toEqual({ lte: day("2026-08-31") });
    expect(where.endDate).toEqual({ gte: day("2026-08-01") });
  });

  it("내 것과 내 팀에 공개된 것만 가져온다", async () => {
    const { service, calls } = makePrisma();
    await service.list({ from: "2026-08-01", to: "2026-08-31" }, ACTOR);

    expect(calls.findMany[0].where.OR).toEqual([
      { ownerId: "me" },
      { visibility: "TEAM", teamId: { in: ["t1", "t2"] } },
    ]);
  });

  it("팀이 없으면 팀 조건이 아무것도 걸지 않는다", async () => {
    const { service, calls } = makePrisma();
    await service.list({ from: "2026-08-01", to: "2026-08-31" }, { userId: "me", teamIds: [] });

    expect(calls.findMany[0].where.OR[1]).toEqual({
      visibility: "TEAM",
      teamId: { in: [] },
    });
  });

  it("거꾸로 된 구간과 지나치게 넓은 구간은 거절한다", async () => {
    const { service } = makePrisma();
    await expect(
      service.list({ from: "2026-08-31", to: "2026-08-01" }, ACTOR),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.list({ from: "2020-01-01", to: "2026-08-01" }, ACTOR),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("남의 팀 일정은 볼 수는 있어도 고칠 수 없다고 표시한다", async () => {
    const { service } = makePrisma({
      rows: [row({ ownerId: "other", visibility: "TEAM", teamId: "t1", team: { id: "t1", name: "IP팀" }, owner: { id: "other", name: "송채안" } })],
    });
    const [event] = await service.list({ from: "2026-08-01", to: "2026-08-31" }, ACTOR);

    expect(event.canEdit).toBe(false);
    expect(event.owner).toEqual({ id: "other", name: "송채안" });
    expect(event.teamName).toBe("IP팀");
    // 날짜는 화면이 그대로 쓰는 `YYYY-MM-DD` 문자열이어야 한다.
    expect(event.start).toBe("2026-08-25");
  });
});

describe("CalendarEventService.create", () => {
  it("종일이면 시각을 버린다", async () => {
    const { service, calls } = makePrisma();
    await service.create(input({ allDay: true, startTime: "09:00", endTime: "10:00" }), ACTOR);

    expect(calls.create[0].data.startTime).toBeNull();
    expect(calls.create[0].data.endTime).toBeNull();
  });

  it("시각이 반쪽만 오면 종일로 되돌린다", async () => {
    const { service, calls } = makePrisma();
    await service.create(input({ allDay: false, startTime: "09:00" }), ACTOR);

    expect(calls.create[0].data.allDay).toBe(true);
    expect(calls.create[0].data.startTime).toBeNull();
  });

  it("하루 안에서 끝 시각이 시작보다 앞서면 거절한다", async () => {
    const { service } = makePrisma();
    await expect(
      service.create(input({ allDay: false, startTime: "13:00", endTime: "12:00" }), ACTOR),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("여러 날짜 일정은 끝 시각이 앞서도 받는다(다음 날이므로)", async () => {
    const { service, calls } = makePrisma();
    await service.create(
      input({ end: "2026-08-27", allDay: false, startTime: "15:00", endTime: "09:00" }),
      ACTOR,
    );

    expect(calls.create[0].data.startTime).toBe("15:00");
    expect(calls.create[0].data.endTime).toBe("09:00");
  });

  it("거꾸로 된 기간은 거절한다", async () => {
    const { service } = makePrisma();
    await expect(
      service.create(input({ start: "2026-08-27", end: "2026-08-25" }), ACTOR),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("팀 공개인데 팀이 없으면 거절한다", async () => {
    const { service } = makePrisma();
    await expect(
      service.create(input({ visibility: "TEAM" }), ACTOR),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("내가 속하지 않은 팀으로는 공개할 수 없다", async () => {
    const { service } = makePrisma();
    await expect(
      service.create(input({ visibility: "TEAM", teamId: "t9" }), ACTOR),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("비공개로 만들면 팀 연결을 끊는다", async () => {
    const { service, calls } = makePrisma();
    await service.create(input({ visibility: "PRIVATE", teamId: "t1" }), ACTOR);

    expect(calls.create[0].data.teamId).toBeNull();
  });

  it("만든 사람은 언제나 요청자다", async () => {
    const { service, calls } = makePrisma();
    await service.create(input(), ACTOR);

    expect(calls.create[0].data.ownerId).toBe("me");
  });
});

describe("CalendarEventService 특허 연결", () => {
  it("특허를 연결하면 patentId로 저장한다", async () => {
    const { service, calls } = makePrisma({ patents: [11] });
    await service.create(input({ patentId: 11 }), ACTOR);
    expect(calls.create[0].data.patentId).toBe(11);
  });

  it("연결하지 않으면 null로 둔다", async () => {
    const { service, calls } = makePrisma();
    await service.create(input(), ACTOR);
    expect(calls.create[0].data.patentId).toBeNull();
  });

  // 깨진 링크는 화면에서 '연결 없음'과 구분되지 않는다. 저장 전에 막는다.
  it("없는 특허를 연결하려 하면 거절한다", async () => {
    const { service } = makePrisma({ patents: [11] });
    await expect(service.create(input({ patentId: 99 }), ACTOR)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("연결된 특허는 내부관리번호와 함께 돌려준다", async () => {
    const { service } = makePrisma({
      rows: [
        row({
          patentId: 11,
          patent: {
            id: 11,
            internalRef: "A25W011",
            applicationNumber: "10-2026-0000011",
            koreanTitle: "치환된 헤테로아릴 화합물",
            englishTitle: null,
          },
        }),
      ],
    });
    const [event] = await service.list({ from: "2026-08-01", to: "2026-08-31" }, ACTOR);
    expect(event.patent).toEqual({
      id: 11,
      internalRef: "A25W011",
      applicationNumber: "10-2026-0000011",
      title: "치환된 헤테로아릴 화합물",
    });
  });
});

describe("CalendarEventService.update / remove", () => {
  it("없는 일정은 404", async () => {
    const { service } = makePrisma({ existing: null });
    await expect(service.update("e1", input(), ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("남의 일정은 고칠 수 없다(팀에 공개돼 있어도)", async () => {
    const { service } = makePrisma({ existing: { id: "e1", ownerId: "other" } });
    await expect(service.update("e1", input(), ACTOR)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.remove("e1", ACTOR)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("내 일정은 고치고 지울 수 있다", async () => {
    const { service, calls } = makePrisma({ existing: { id: "e1", ownerId: "me" } });
    await service.update("e1", input({ title: "  바뀐 제목  " }), ACTOR);
    await service.remove("e1", ACTOR);

    expect(calls.update[0].data.title).toBe("바뀐 제목");
    expect(calls.delete[0].where).toEqual({ id: "e1" });
  });
});
