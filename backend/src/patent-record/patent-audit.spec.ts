/**
 * 감사 로그 기록 검증.
 *
 * Prisma를 통째로 가짜로 세우고 **어떤 로그 행을 썼는지**를 본다. 실제 DB 없이 확인해야
 * 하는 것이 "이력이 사실과 같은가"이기 때문이다 — 안 바뀐 필드로 행을 만들지 않는가,
 * 코드 id가 아니라 사람이 읽는 값으로 남는가, 파생 컬럼이 같은 사실을 여섯 번 말하지 않는가.
 *
 * prisma.client mock은 patent-record-deadlines.spec.ts와 같은 이유로 필요하다(생성 코드가
 * import.meta를 써서 ts-jest가 파싱하지 못한다).
 */
jest.mock("../database/prisma.client", () => ({ prisma: {} }));

import type { PrismaService } from "../database/prisma.service";
import type { CreatePatentRecordDto } from "./dto/create-patent-record.dto";
import type { UpdatePatentRecordDto } from "./dto/update-patent-record.dto";
import {
  auditedFieldNames,
  diffAuditableFields,
  type AuditablePatent,
} from "./patent-audit-fields";
import { PatentAuditService } from "./patent-audit.service";
import { PatentRecordService } from "./patent-record.service";

type Call = Record<string, any>;

/** 조회 결과 한 행. LIST_INCLUDE가 붙은 모양이다. */
const patentRow = (overrides: Record<string, any> = {}) => ({
  id: 1,
  applicationNumber: "10-2026-0000001",
  internalRef: "A25W001",
  refOrigin: "A",
  refYear: 2025,
  refType: "W",
  refSerial: 1,
  refCountry: null,
  koreanTitle: "한글 명칭",
  englishTitle: "English title",
  applicationDate: new Date("2026-01-14T00:00:00.000Z"),
  applicant: "보로노이",
  registrationNumber: null,
  registrationDate: null,
  publicationNumber: null,
  publicationDate: null,
  intApplicationNumber: null,
  intApplicationDate: null,
  intPublicationNumber: null,
  intPublicationDate: null,
  parentApplicationNumber: null,
  exam: null,
  examDate: null,
  target: "EGFR",
  countryId: 1,
  attorneyNumber: null,
  legalStatusId: 1,
  examStatusId: null,
  country: { id: 1, country: "KR" },
  attorney: null,
  legalStatus: { id: 1, status: "출원" },
  examStatus: null,
  ...overrides,
});

/**
 * before/after를 지정해 update를 한 번 돌리고, 그때 쓴 감사 로그 행을 돌려준다.
 * findUnique는 처음 호출에 before를, update는 after를 준다.
 */
const runUpdate = async (
  before: Record<string, any>,
  after: Record<string, any>,
  dto: UpdatePatentRecordDto,
) => {
  const auditCreateMany: Call[] = [];
  const auditCreate: Call[] = [];
  const patentUpdates: Call[] = [];

  const client: any = {
    patent: {
      findUnique: jest.fn(async () => before),
      update: jest.fn(async (args: Call) => {
        patentUpdates.push(args);
        return after;
      }),
      delete: jest.fn(async () => after),
    },
    country: { findUnique: jest.fn(async () => ({ id: 1 })) },
    attorney: { findUnique: jest.fn(async () => ({ attorneyNumber: 1 })) },
    legalStatus: { findUnique: jest.fn(async () => ({ id: 1 })) },
    examStatus: { findUnique: jest.fn(async () => ({ id: 1 })) },
    patentTarget: { findUnique: jest.fn(async () => ({ target: "EGFR" })) },
    patentAuditLog: {
      createMany: jest.fn(async (args: Call) => {
        auditCreateMany.push(args);
        return { count: args.data.length };
      }),
      create: jest.fn(async (args: Call) => {
        auditCreate.push(args);
        return {};
      }),
    },
    $transaction: jest.fn(async (run: (tx: unknown) => Promise<unknown>) => run(client)),
  };

  const prisma = { client } as unknown as PrismaService;
  const service = new PatentRecordService(prisma, new PatentAuditService(prisma));
  await service.update(1, dto, "actor-1", "req-1");

  return {
    rows: auditCreateMany.flatMap((call) => call.data as Call[]),
    events: auditCreate.map((call) => call.data as Call),
    createManyCalls: auditCreateMany.length,
    /** 실제로 컬럼에 쓰인 값. dto를 그대로 넘기는지 다듬어 넘기는지 본다. */
    written: (patentUpdates[0]?.data ?? {}) as Call,
  };
};

describe("diffAuditableFields", () => {
  const base = patentRow() as unknown as AuditablePatent;

  it("값이 같으면 아무 행도 만들지 않는다", () => {
    // 같은 값을 다시 보내는 PATCH(고쳤다 되돌림, 자동 저장 중복)로 이력이 불어나면 안 된다.
    expect(diffAuditableFields(base, patentRow() as unknown as AuditablePatent)).toEqual([]);
  });

  it("코드 필드는 id가 아니라 라벨로 남는다", () => {
    const after = patentRow({
      legalStatusId: 2,
      legalStatus: { id: 2, status: "등록" },
    }) as unknown as AuditablePatent;

    expect(diffAuditableFields(base, after)).toEqual([
      {
        field: "legalStatusId",
        label: "법적 상태",
        beforeValue: "출원",
        afterValue: "등록",
      },
    ]);
  });

  it("internalRef가 바뀌어도 파생 컬럼 행을 만들지 않는다", () => {
    // ref_origin·ref_year·ref_type·ref_serial·ref_country가 함께 움직이지만, 피드가 같은
    // 사실을 여섯 번 말하면 못 쓴다. 원문 하나만 남긴다.
    const after = patentRow({
      internalRef: "B26W002",
      refOrigin: "B",
      refYear: 2026,
      refType: "W",
      refSerial: 2,
    }) as unknown as AuditablePatent;

    const changes = diffAuditableFields(base, after);
    expect(changes.map((change) => change.field)).toEqual(["internalRef"]);
  });

  it("날짜는 YYYY-MM-DD로, boolean은 청구/미청구로 남는다", () => {
    const after = patentRow({
      applicationDate: new Date("2026-03-02T00:00:00.000Z"),
      exam: true,
    }) as unknown as AuditablePatent;

    expect(diffAuditableFields(base, after)).toEqual([
      {
        field: "applicationDate",
        label: "출원일",
        beforeValue: "2026-01-14",
        afterValue: "2026-03-02",
      },
      { field: "exam", label: "심사청구", beforeValue: null, afterValue: "청구" },
    ]);
  });

  it("빈 문자열과 공백은 '없음'(null)과 같게 본다", () => {
    // CSV/폼이 빈 칸을 ""로 보내기도 한다. null과 ""를 다르게 보면 이력에 헛 행이 남는다.
    const before = patentRow({ applicant: "보로노이" }) as unknown as AuditablePatent;
    const after = patentRow({ applicant: "   " }) as unknown as AuditablePatent;

    expect(diffAuditableFields(after, patentRow({ applicant: null }) as unknown as AuditablePatent))
      .toEqual([]);
    expect(diffAuditableFields(before, after)).toEqual([
      { field: "applicant", label: "출원인", beforeValue: "보로노이", afterValue: null },
    ]);
  });
});

describe("update - 감사 로그", () => {
  it("바뀐 필드만 한 행씩 남긴다", async () => {
    const { rows } = await runUpdate(
      patentRow(),
      patentRow({ applicant: "Voronoi Inc.", koreanTitle: "새 명칭" }),
      { applicant: "Voronoi Inc.", koreanTitle: "새 명칭" },
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.field).sort()).toEqual(["applicant", "koreanTitle"]);
    expect(rows.every((row) => row.eventType === "PATENT_FIELD_CHANGED")).toBe(true);
  });

  it("한 요청의 행들은 같은 requestId와 행위자를 갖는다", async () => {
    const { rows } = await runUpdate(
      patentRow(),
      patentRow({ applicant: "A", koreanTitle: "B" }),
      { applicant: "A", koreanTitle: "B" },
    );

    expect(rows.every((row) => row.requestId === "req-1")).toBe(true);
    expect(rows.every((row) => row.actorUserId === "actor-1")).toBe(true);
  });

  it("값이 그대로면 로그를 아예 쓰지 않는다", async () => {
    const { rows, createManyCalls } = await runUpdate(
      patentRow(),
      patentRow(),
      { applicant: "보로노이" },
    );

    expect(rows).toEqual([]);
    // 빈 배열로 createMany를 부르지도 않는다(무의미한 쿼리를 남기지 않는다).
    expect(createManyCalls).toBe(0);
  });

  it("특허가 지워져도 어느 건이었는지 읽히게 metadata에 출원번호를 담는다", async () => {
    const { rows } = await runUpdate(
      patentRow(),
      patentRow({ applicant: "A" }),
      { applicant: "A" },
    );

    expect(rows[0].metadata).toEqual({
      applicationNumber: "10-2026-0000001",
      internalRef: "A25W001",
    });
  });

  it("출원번호가 바뀌면 metadata는 바뀐 뒤 값을 가리킨다", async () => {
    const { rows } = await runUpdate(
      patentRow(),
      patentRow({ applicationNumber: "10-2026-9999999" }),
      { applicationNumber: "10-2026-9999999" },
    );

    expect(rows[0].metadata.applicationNumber).toBe("10-2026-9999999");
  });
});

describe("create / remove - 감사 로그", () => {
  const makeService = () => {
    const auditCreate: Call[] = [];
    const client: any = {
      patent: {
        findUnique: jest.fn(async () => patentRow()),
        create: jest.fn(async () => patentRow()),
        delete: jest.fn(async () => patentRow()),
      },
      country: { findUnique: jest.fn(async () => ({ id: 1 })) },
      attorney: { findUnique: jest.fn(async () => ({ attorneyNumber: 1 })) },
      legalStatus: { findUnique: jest.fn(async () => ({ id: 1 })) },
      examStatus: { findUnique: jest.fn(async () => ({ id: 1 })) },
      patentTarget: { findUnique: jest.fn(async () => ({ target: "EGFR" })) },
      patentAuditLog: {
        create: jest.fn(async (args: Call) => {
          auditCreate.push(args);
          return {};
        }),
        createMany: jest.fn(async () => ({ count: 0 })),
      },
      $transaction: jest.fn(async (run: (tx: unknown) => Promise<unknown>) => run(client)),
    };
    const prisma = { client } as unknown as PrismaService;
    return {
      service: new PatentRecordService(prisma, new PatentAuditService(prisma)),
      client,
      events: auditCreate,
    };
  };

  it("생성은 PATENT_CREATED 한 행", async () => {
    const { service, events } = makeService();
    // findUnique가 값을 돌려주면 '출원번호 중복'으로 막히므로 그 검사만 비운다.
    (service as any).assertApplicationNumberFree = jest.fn();
    (service as any).assertInternalRefFree = jest.fn();

    await service.create(
      { countryId: 1, applicationNumber: "10-2026-0000001" } as CreatePatentRecordDto,
      "actor-1",
      "req-1",
    );

    expect(events).toHaveLength(1);
    expect(events[0].data).toMatchObject({
      eventType: "PATENT_CREATED",
      actorUserId: "actor-1",
      requestId: "req-1",
      patentId: 1,
    });
  });

  it("삭제는 지우기 **전에** PATENT_DELETED를 남긴다", async () => {
    const { service, client, events } = makeService();
    const order: string[] = [];
    client.patentAuditLog.create.mockImplementation(async (args: Call) => {
      order.push("log");
      events.push(args);
      return {};
    });
    client.patent.delete.mockImplementation(async () => {
      order.push("delete");
      return patentRow();
    });

    await service.remove(1, "actor-1", "req-1");

    // 순서가 뒤집히면 patent_id가 SetNull된 뒤에 기록돼 어느 건인지 잃는다.
    expect(order).toEqual(["log", "delete"]);
    expect(events[0].data).toMatchObject({
      eventType: "PATENT_DELETED",
      patentId: 1,
    });
    expect(events[0].data.metadata).toMatchObject({
      applicationNumber: "10-2026-0000001",
    });
  });
});

describe("auditedFieldNames - 임포트 요약", () => {
  it("감사 대상 컬럼만 남긴다", () => {
    // 임포트가 tx.patent.update에 넘기는 data에는 파생 컬럼과 편집 불가 컬럼이 섞여 있다.
    // 요약에는 사람이 아는 필드만 담아야 "무엇이 바뀌었나"가 읽힌다.
    // (note는 상세 모달의 '설명'이 되면서 감사 대상으로 옮겨 갔다 — 여기서는 여전히
    //  편집 불가인 inventors로 제외를 확인한다.)
    const names = auditedFieldNames([
      "applicant",
      "refOrigin",
      "refYear",
      "inventors",
      "legalStatusId",
      "todoDueDate",
      "존재하지않는컬럼",
    ]);

    expect(names).toEqual(["applicant", "legalStatusId"]);
  });

  it("값이 아니라 이름만 담는다(만 단위 행 폭발을 막는 이유)", () => {
    expect(auditedFieldNames(["koreanTitle"])).toEqual(["koreanTitle"]);
  });
});

describe("설명(note) - 서식 있는 긴 글", () => {
  const base = patentRow() as unknown as AuditablePatent;

  it("태그가 아니라 사람이 읽는 요약으로 남는다", () => {
    // 원문을 그대로 넣으면 피드의 `A → B` 한 칸에 <p>·<strong>이 통째로 들어온다.
    const changes = diffAuditableFields(
      base,
      patentRow({ note: "<p>심사관 <strong>인터뷰</strong> 결과 반영</p>" }) as unknown as AuditablePatent,
    );

    expect(changes).toEqual([
      {
        field: "note",
        label: "설명",
        beforeValue: null,
        afterValue: "심사관 인터뷰 결과 반영",
      },
    ]);
  });

  it("긴 글은 잘라서 남긴다", () => {
    const long = `<p>${"가".repeat(200)}</p>`;
    const [change] = diffAuditableFields(
      base,
      patentRow({ note: long }) as unknown as AuditablePatent,
    );

    expect(change.afterValue).toBe(`${"가".repeat(60)}…`);
  });

  it("글자가 없고 이미지만 있어도 '내용 있음'이다", () => {
    // 붙여 넣은 스크린샷 한 장짜리 설명이 '없음'으로 읽히면 안 된다.
    const [change] = diffAuditableFields(
      base,
      patentRow({ note: '<p><img src="data:image/png;base64,AAAA"></p>' }) as unknown as AuditablePatent,
    );

    expect(change.afterValue).toBe("[이미지]");
  });

  it("편집기가 남긴 빈 껍데기는 컬럼을 비운다", async () => {
    // Quill은 내용을 지워도 빈 문자열이 아니라 `<p><br></p>`를 남긴다. 그대로 저장하면
    // '없음'이어야 할 값이 '내용 있음'으로 남아 다음 저장 때 헛된 이력이 생긴다.
    const before = patentRow({ note: "<p>지울 설명</p>" });
    const after = patentRow({ note: null });
    const { rows, written } = await runUpdate(before, after, { note: "<p><br></p>" });

    expect(written.note).toBeNull();
    expect(rows).toEqual([
      expect.objectContaining({
        field: "note",
        beforeValue: "지울 설명",
        afterValue: null,
      }),
    ]);
  });
});
