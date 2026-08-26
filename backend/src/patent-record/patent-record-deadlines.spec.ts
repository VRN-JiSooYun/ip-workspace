/**
 * Prisma 실물 client는 import만으로 DATABASE_URL을 요구하고, 생성 코드가 `import.meta`를
 * 써서 ts-jest(CJS)에서 파싱되지 않는다. service를 unit test하려면 이 모듈을 먼저 끊어야
 * 한다. jest.mock은 hoisting되므로 아래 import보다 먼저 적용된다.
 */
jest.mock("../database/prisma.client", () => ({ prisma: {} }));

import type { PrismaService } from "../database/prisma.service";
import type { PatentDeadlineQueryDto } from "./dto/patent-deadline-query.dto";
import type { PatentRecordListQueryDto } from "./dto/patent-record-list-query.dto";
import type { PatentStageQueryDto } from "./dto/patent-stage-query.dto";
import { PatentAuditService } from "./patent-audit.service";
import { PatentRecordService } from "./patent-record.service";
import { PATENT_QUALITY_FILTERS } from "./patent-quality";

/**
 * 대시보드용 집계(deadlines·summary)와 목록의 quality 필터 검증.
 *
 * Prisma를 통째로 가짜로 세우고 **어떤 where로 물었는지**를 본다. 실제 DB 없이 확인해야
 * 하는 것이 "경계를 맞게 잡았는가"이기 때문이다(to 포함 여부, 버킷 겹침, 완료 제외).
 */

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

type Call = { where: Record<string, any>; [key: string]: any };

const makePrisma = (options: {
  todos?: any[];
  patents?: any[];
  todoCount?: number;
  patentCount?: number;
} = {}) => {
  const calls = {
    todoFindMany: [] as Call[],
    patentFindMany: [] as Call[],
    todoCount: [] as Call[],
    patentCount: [] as Call[],
    auditCreate: [] as Call[],
    auditCreateMany: [] as Call[],
  };

  const client = {
    patentTodo: {
      findMany: jest.fn(async (args: Call) => {
        calls.todoFindMany.push(args);
        return options.todos ?? [];
      }),
      count: jest.fn(async (args: Call) => {
        calls.todoCount.push(args);
        return options.todoCount ?? 0;
      }),
    },
    patent: {
      findMany: jest.fn(async (args: Call) => {
        calls.patentFindMany.push(args);
        return options.patents ?? [];
      }),
      count: jest.fn(async (args: Call) => {
        calls.patentCount.push(args);
        return options.patentCount ?? 0;
      }),
      groupBy: jest.fn(async () => []),
    },
    patentAdmin: { findMany: jest.fn(async () => []) },
    patentStageGroup: { findMany: jest.fn(async () => []) },
    legalStatus: { findMany: jest.fn(async () => []) },
    patentAuditLog: {
      create: jest.fn(async (args: Call) => {
        calls.auditCreate.push(args);
        return {};
      }),
      createMany: jest.fn(async (args: Call) => {
        calls.auditCreateMany.push(args);
        return { count: 0 };
      }),
    },
    // create/update/remove가 갱신과 감사 로그를 한 트랜잭션에 묶는다. 같은 가짜 client를
    // tx로 그대로 넘겨 어떤 로그를 썼는지 calls로 본다.
    $transaction: jest.fn(async (run: (tx: unknown) => Promise<unknown>) => run(client)),
  };

  const prisma = { client } as unknown as PrismaService;
  const service = new PatentRecordService(prisma, new PatentAuditService(prisma));
  return { service, calls, client };
};

const patentRow = (overrides: Record<string, any> = {}) => ({
  id: 1,
  internalRef: "A25W001",
  applicationNumber: "10-2026-0000001",
  koreanTitle: "한글 명칭",
  englishTitle: "English title",
  target: "FGFR",
  country: { country: "KR" },
  ...overrides,
});

const deadlineQuery = (
  overrides: Partial<PatentDeadlineQueryDto> = {},
): PatentDeadlineQueryDto => ({
  from: "2026-08-01",
  to: "2026-08-31",
  limit: 100,
  ...overrides,
}) as PatentDeadlineQueryDto;

beforeEach(() => {
  jest.useFakeTimers();
  // Asia/Seoul 기준 2026-08-24. UTC 15:00 이후여야 서울에서 다음 날이 되므로
  // 오늘 계산이 시간대에 흔들리지 않는지도 함께 확인된다.
  jest.setSystemTime(new Date("2026-08-24T01:00:00.000Z"));
});

afterEach(() => {
  jest.useRealTimers();
});

describe("deadlines - 조회 범위", () => {
  it("to를 포함한다 (상한은 다음 날 자정)", async () => {
    const { service, calls } = makePrisma();

    await service.deadlines(deadlineQuery({ from: "2026-08-01", to: "2026-08-31" }));

    expect(calls.todoFindMany[0].where.dueDate).toEqual({
      gte: day("2026-08-01"),
      lt: day("2026-09-01"),
    });
    expect(calls.patentFindMany[0].where.expectedExpiryDate).toEqual({
      gte: day("2026-08-01"),
      lt: day("2026-09-01"),
    });
  });

  it("완료된 To-do는 세지 않는다", async () => {
    const { service, calls } = makePrisma();

    await service.deadlines(deadlineQuery());

    for (const call of [...calls.todoFindMany, ...calls.todoCount]) {
      expect(call.where.completed).toBe(false);
    }
  });

  it("Target 필터는 특허와 To-do 양쪽에 같은 조건으로 걸린다", async () => {
    const { service, calls } = makePrisma();

    await service.deadlines(deadlineQuery({ targets: ["FGFR", "  cMET  "] }));

    // 공백은 다듬어 넘긴다.
    expect(calls.patentFindMany[0].where.target).toEqual({ in: ["FGFR", "cMET"] });
    expect(calls.todoFindMany[0].where.patent).toEqual({
      target: { in: ["FGFR", "cMET"] },
    });
  });

  it("빈 Target 배열은 필터로 걸지 않는다", async () => {
    const { service, calls } = makePrisma();

    await service.deadlines(deadlineQuery({ targets: ["", "   "] }));

    expect(calls.patentFindMany[0].where.target).toBeUndefined();
    expect(calls.todoFindMany[0].where.patent).toEqual({});
  });
});

describe("deadlines - 버킷", () => {
  it("네 버킷이 오늘 기준으로 서로 겹치지 않는다", async () => {
    const { service, calls } = makePrisma();

    await service.deadlines(deadlineQuery());

    // 첫 호출은 범위 total이고 그 뒤 4개가 버킷이다.
    const buckets = calls.patentCount.slice(1).map((call) => call.where.expectedExpiryDate);

    expect(buckets).toEqual([
      { lt: day("2026-08-24") },
      { gte: day("2026-08-24"), lt: day("2026-08-25") },
      { gte: day("2026-08-25"), lt: day("2026-09-01") },
      { gte: day("2026-09-01"), lt: day("2026-09-24") },
    ]);
  });

  it("버킷 건수는 To-do와 예상 만료일을 합한 값이다", async () => {
    const { service } = makePrisma({ todoCount: 3, patentCount: 2 });

    const result = await service.deadlines(deadlineQuery());

    expect(result.counts).toEqual({
      overdue: 5,
      today: 5,
      within7: 5,
      within30: 5,
    });
  });
});

describe("deadlines - 항목 병합", () => {
  it("두 원본을 날짜 오름차순으로 합친다", async () => {
    const { service } = makePrisma({
      todos: [
        {
          id: 11,
          title: "의견서 제출",
          dueDate: day("2026-08-20"),
          patent: patentRow({ id: 1, applicationNumber: "10-2026-0000001" }),
        },
      ],
      patents: [
        patentRow({
          id: 2,
          applicationNumber: "10-2026-0000002",
          expectedExpiryDate: day("2026-08-10"),
        }),
      ],
    });

    const result = await service.deadlines(deadlineQuery());

    expect(result.items.map((item) => [item.date, item.type])).toEqual([
      ["2026-08-10", "EXPECTED_EXPIRY"],
      ["2026-08-20", "TODO"],
    ]);
  });

  it("To-do 항목은 todoId와 To-do 제목을 함께 준다", async () => {
    const { service } = makePrisma({
      todos: [
        {
          id: 11,
          title: "의견서 제출",
          dueDate: day("2026-08-20"),
          patent: patentRow(),
        },
      ],
    });

    const [item] = (await service.deadlines(deadlineQuery())).items;

    expect(item).toMatchObject({
      patentId: 1,
      todoId: 11,
      todoTitle: "의견서 제출",
      patentTitle: "한글 명칭",
      internalRef: "A25W001",
      country: "KR",
      target: "FGFR",
      type: "TODO",
      label: "To-do 마감일",
      date: "2026-08-20",
    });
  });

  it("예상 만료 항목은 todoId가 없고 한글 명칭이 없으면 영문 명칭을 쓴다", async () => {
    const { service } = makePrisma({
      patents: [
        patentRow({
          koreanTitle: null,
          expectedExpiryDate: day("2026-08-10"),
        }),
      ],
    });

    const [item] = (await service.deadlines(deadlineQuery())).items;

    expect(item).toMatchObject({
      todoId: null,
      todoTitle: null,
      patentTitle: "English title",
      type: "EXPECTED_EXPIRY",
      label: "예상 만료일",
    });
  });

  it("limit으로 자르되 전체 건수를 total로 알려 준다", async () => {
    const { service } = makePrisma({
      todos: [
        {
          id: 11,
          title: "A",
          dueDate: day("2026-08-02"),
          patent: patentRow({ id: 1, applicationNumber: "10-2026-0000001" }),
        },
        {
          id: 12,
          title: "B",
          dueDate: day("2026-08-03"),
          patent: patentRow({ id: 2, applicationNumber: "10-2026-0000002" }),
        },
      ],
      todoCount: 40,
      patentCount: 2,
    });

    const result = await service.deadlines(deadlineQuery({ limit: 1 }));

    expect(result.items).toHaveLength(1);
    expect(result.items[0].date).toBe("2026-08-02");
    // 범위 total은 To-do 40 + 예상 만료 2. 버킷 집계와는 별개다.
    expect(result.total).toBe(42);
  });

  it("dueDate가 없는 To-do는 항목에서 빠진다", async () => {
    const { service } = makePrisma({
      todos: [{ id: 11, title: "A", dueDate: null, patent: patentRow() }],
    });

    expect((await service.deadlines(deadlineQuery())).items).toEqual([]);
  });
});

describe("summary", () => {
  const stageQuery = (
    overrides: Partial<PatentStageQueryDto> = {},
  ): PatentStageQueryDto => overrides as PatentStageQueryDto;

  it("만료 임박은 오늘부터 1년(366일 상한)을 본다", async () => {
    const { service, calls } = makePrisma();

    await service.summary(stageQuery());

    const ranges = calls.patentCount.map((call) => call.where.expectedExpiryDate);
    expect(ranges).toContainEqual({
      gte: day("2026-08-24"),
      lt: day("2027-08-25"),
    });
  });

  it("등록 대기는 stageCode ALLOWANCE로 센다", async () => {
    const { service, calls } = makePrisma();

    await service.summary(stageQuery());

    const stageCodes = calls.patentCount.map(
      (call) => call.where.legalStatus?.stageCode,
    );
    expect(stageCodes).toContain("ALLOWANCE");
  });

  it("품질 조건을 모두 센다", async () => {
    const { service } = makePrisma({ patentCount: 7 });

    const result = await service.summary(stageQuery());

    expect(Object.keys(result.quality).sort()).toEqual(
      Object.keys(PATENT_QUALITY_FILTERS).sort(),
    );
    expect(result.quality.refParseFailed).toBe(7);
  });

  it("quality 필터가 들어와도 품질 집계에는 적용하지 않는다", async () => {
    const { service, calls } = makePrisma();

    await service.summary(stageQuery({ quality: "refParseFailed" }));

    // 모집단(total) 쿼리에 refParseFailed 조건이 섞이면 순환이다.
    const totalCall = calls.patentCount[0];
    const serialized = JSON.stringify(totalCall.where);
    expect(serialized).not.toContain("refOrigin");
  });
});

describe("목록 quality 필터", () => {
  const listQuery = (
    overrides: Partial<PatentRecordListQueryDto> = {},
  ): PatentRecordListQueryDto => ({
    sort: "applicationDateDesc",
    page: 1,
    pageSize: 20,
    ...overrides,
  }) as PatentRecordListQueryDto;

  it("quality 조건을 AND에 담는다", async () => {
    const { service, calls } = makePrisma();

    await service.list(listQuery({ quality: "refParseFailed" }));

    expect(calls.patentFindMany[0].where.AND).toEqual([
      PATENT_QUALITY_FILTERS.refParseFailed,
    ]);
  });

  it("다른 필터와 함께 걸면 서로 덮어쓰지 않는다", async () => {
    const { service, calls } = makePrisma();

    await service.list(listQuery({ q: "FGFR", quality: "noTodo" }));

    const and = calls.patentFindMany[0].where.AND;
    expect(and).toHaveLength(2);
    expect(and[0].OR).toBeDefined();
    expect(and[1]).toEqual(PATENT_QUALITY_FILTERS.noTodo);
  });

  it("미매핑 단계 필터는 품질 표의 정의를 그대로 쓴다", async () => {
    const { service, calls } = makePrisma();

    await service.list(listQuery({ stageGroup: "UNMAPPED" }));

    expect(calls.patentFindMany[0].where.AND).toEqual([
      PATENT_QUALITY_FILTERS.unmappedStatus,
    ]);
  });
});

describe("목록 컬럼별 필터", () => {
  const listQuery = (
    overrides: Partial<PatentRecordListQueryDto> = {},
  ): PatentRecordListQueryDto => ({
    sort: "applicationDateDesc",
    page: 1,
    pageSize: 20,
    ...overrides,
  }) as PatentRecordListQueryDto;

  const whereOf = async (overrides: Partial<PatentRecordListQueryDto>) => {
    const { service, calls } = makePrisma();
    await service.list(listQuery(overrides));
    return calls.patentFindMany[0].where as Record<string, any>;
  };

  it("부분 일치 조건은 대소문자를 무시한다", async () => {
    const where = await whereOf({ internalRef: "a25w" });

    expect(where.AND).toEqual([
      { internalRef: { contains: "a25w", mode: "insensitive" } },
    ]);
  });

  it("공백만 들어온 조건은 버린다", async () => {
    // 입력을 비웠을 때 `contains: ""`로 전체를 훑으면 필터가 없는 것과 같아진다.
    const where = await whereOf({ applicant: "   " });

    expect(where.AND).toBeUndefined();
  });

  it("명칭은 국문·영문 중 하나만 걸려도 통과시킨다", async () => {
    const where = await whereOf({ title: "억제제" });

    expect(where.AND).toEqual([
      {
        OR: [
          { koreanTitle: { contains: "억제제", mode: "insensitive" } },
          { englishTitle: { contains: "억제제", mode: "insensitive" } },
        ],
      },
    ]);
  });

  it("출원일 to는 그 날을 포함한다 (상한은 다음 날 자정)", async () => {
    const where = await whereOf({
      applicationDateFrom: "2026-01-01",
      applicationDateTo: "2026-01-31",
    });

    expect(where.AND).toEqual([
      { applicationDate: { gte: day("2026-01-01"), lt: day("2026-02-01") } },
    ]);
  });

  it("출원일은 한쪽만 줘도 걸린다", async () => {
    expect(await whereOf({ applicationDateFrom: "2026-01-01" })).toMatchObject({
      AND: [{ applicationDate: { gte: day("2026-01-01") } }],
    });
    expect(await whereOf({ applicationDateTo: "2026-01-31" })).toMatchObject({
      AND: [{ applicationDate: { lt: day("2026-02-01") } }],
    });
  });

  it("문서 있음/없음이 서로 반대 조건이다", async () => {
    const hasOfficeAction = { admins: { some: { officeActions: { some: {} } } } };

    expect(await whereOf({ hasDocuments: true })).toEqual({ AND: [hasOfficeAction] });
    expect(await whereOf({ hasDocuments: false })).toEqual({
      AND: [{ NOT: hasOfficeAction }],
    });
  });

  it("문서 조건을 안 주면 문서로 거르지 않는다", async () => {
    // hasDocuments가 false여도 조건이 걸려야 하므로 undefined와 구분되어야 한다.
    expect(await whereOf({})).toEqual({});
  });

  it("대리인은 코드로 정확히 일치한다", async () => {
    expect(await whereOf({ attorneyNumber: 101 })).toEqual({
      AND: [{ attorneyNumber: 101 }],
    });
  });

  it("여러 컬럼 조건은 서로 덮어쓰지 않고 모두 AND로 쌓인다", async () => {
    const where = await whereOf({
      q: "FGFR",
      internalRef: "A25",
      applicationNumber: "10-2026",
      title: "억제제",
      applicant: "보로노이",
      registrationNumber: "10-22",
      attorneyNumber: 100,
      applicationDateFrom: "2026-01-01",
      hasDocuments: true,
      countryId: 1,
      legalStatusId: 2,
      examStatusId: 3,
      targets: ["EGFR", "BTK"],
    });

    // q(OR) + 부분일치 5 + 대리인 + 출원일 + 문서 = 9
    expect(where.AND).toHaveLength(9);
    // 코드 조건은 AND 밖에서 그대로 걸린다(기존 계약 유지).
    expect(where.countryId).toBe(1);
    expect(where.legalStatusId).toBe(2);
    expect(where.examStatusId).toBe(3);
    expect(where.target).toEqual({ in: ["EGFR", "BTK"] });
  });

  it("집계도 목록과 같은 컬럼 조건을 본다", async () => {
    // 상세 검색의 '총 N건'과 단계 select의 건수가 목록과 어긋나면 안 된다.
    const { service, calls } = makePrisma();

    await service.stages({ applicant: "보로노이", hasDocuments: false } as PatentStageQueryDto);

    const where = calls.patentCount[0].where as Record<string, any>;
    expect(where.AND).toEqual([
      { applicant: { contains: "보로노이", mode: "insensitive" } },
      { NOT: { admins: { some: { officeActions: { some: {} } } } } },
    ]);
  });
});
