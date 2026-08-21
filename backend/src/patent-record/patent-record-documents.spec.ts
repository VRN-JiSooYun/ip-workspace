import {
  countDocumentsByPatent,
  toPatentDocumentItems,
  type AdminWithDocuments,
  type PatentForDocuments,
} from "./patent-record-documents";

const patent: PatentForDocuments = {
  id: 7,
  applicationNumber: "10-2026-0000010",
  koreanTitle: "치환된 헤테로아릴 화합물",
  englishTitle: "Substituted heteroaryl compounds",
  applicant: "보로노이",
  legalStatusId: 2,
  legalStatus: { status: "공개" },
  examStatusId: 3,
  examStatus: { status: "심사청구" },
  exam: true,
};

type OfficeAction = AdminWithDocuments["officeActions"][number];

const officeAction = (overrides: Partial<OfficeAction> = {}): OfficeAction => ({
  id: 10,
  content: "통지서 본문",
  documentPath: "https://example.invalid/oa.pdf",
  responses: [],
  oaExaminers: [],
  rejections: [],
  ...overrides,
});

const admin = (overrides: Partial<AdminWithDocuments> = {}): AdminWithDocuments => ({
  id: 1,
  action: "의견제출통지서",
  actionDate: new Date("2025-04-14T00:00:00.000Z"),
  actionNumber: "SEED-1-1",
  officeActions: [officeAction()],
  ...overrides,
});

describe("toPatentDocumentItems", () => {
  it("통지서 하나를 뷰어 항목 하나로 옮기고 특허 정보를 채운다", () => {
    const [item] = toPatentDocumentItems(patent, [admin()]);

    expect(item).toMatchObject({
      officeActionId: 10,
      adminId: 1,
      content: "통지서 본문",
      contentLength: 6,
      documentPath: "https://example.invalid/oa.pdf",
      actionDate: "2025-04-14T00:00:00.000Z",
      action: "의견제출통지서",
      actionNumber: "SEED-1-1",
      patentId: 7,
      applicationNumber: "10-2026-0000010",
      koreanTitle: "치환된 헤테로아릴 화합물",
      applicant: "보로노이",
      legalStatusId: 2,
      legalStatus: "공개",
      examStatusId: 3,
      exam: true,
      patent: null,
    });
  });

  it("의견서·보정서는 항목을 늘리지 않고 submissions로 들어간다", () => {
    const items = toPatentDocumentItems(patent, [
      admin({
        officeActions: [
          officeAction({
            responses: [
              { id: 20, type: 1, content: "의견", documentPath: null },
              { id: 21, type: 2, content: "보정", documentPath: "https://example.invalid/a.pdf" },
            ],
          }),
        ],
      }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].submissions).toEqual([
      { id: 20, typeCode: 1, kind: "OPINION", content: "의견", contentLength: 2, documentPath: null },
      {
        id: 21,
        typeCode: 2,
        kind: "AMENDMENT",
        content: "보정",
        contentLength: 2,
        documentPath: "https://example.invalid/a.pdf",
      },
    ]);
  });

  it("모르는 type 코드는 버리지 않고 kind만 null로 둔다", () => {
    const [item] = toPatentDocumentItems(patent, [
      admin({
        officeActions: [
          officeAction({
            responses: [
              { id: 22, type: 99, content: null, documentPath: null },
              { id: 23, type: null, content: null, documentPath: null },
            ],
          }),
        ],
      }),
    ]);

    expect(item.submissions.map((s) => [s.typeCode, s.kind])).toEqual([
      [99, null],
      [null, null],
    ]);
  });

  it("심사관과 거절이유를 조문 단위까지 옮긴다", () => {
    const [item] = toPatentDocumentItems(patent, [
      admin({
        officeActions: [
          officeAction({
            oaExaminers: [
              {
                examiner: {
                  id: 5,
                  office: "특허청",
                  bureau: "화학생명기술심사국",
                  department: "약품화학심사과",
                  name: "홍길동",
                },
              },
            ],
            rejections: [
              {
                id: 30,
                claim: "1-5",
                statute: { lawType: 1, article: 29, paragraph: 2, subParagraph: null },
              },
            ],
          }),
        ],
      }),
    ]);

    expect(item.examiners).toEqual([
      {
        id: 5,
        office: "특허청",
        bureau: "화학생명기술심사국",
        department: "약품화학심사과",
        name: "홍길동",
      },
    ]);
    expect(item.rejections).toEqual([
      { rejectionId: 30, claim: "1-5", lawType: 1, article: 29, paragraph: 2, subParagraph: null },
    ]);
  });

  it("statute가 연결되지 않은 거절이유도 버리지 않는다", () => {
    const [item] = toPatentDocumentItems(patent, [
      admin({
        officeActions: [
          officeAction({ rejections: [{ id: 31, claim: "3", statute: null }] }),
        ],
      }),
    ]);

    expect(item.rejections).toEqual([
      { rejectionId: 31, claim: "3", lawType: null, article: null, paragraph: null, subParagraph: null },
    ]);
  });

  it("admin이 여러 건이면 통지서마다 항목이 하나씩 생긴다", () => {
    const items = toPatentDocumentItems(patent, [
      admin({ id: 1, officeActions: [officeAction({ id: 10 }), officeAction({ id: 11 })] }),
      admin({ id: 2, officeActions: [officeAction({ id: 12 })] }),
    ]);

    expect(items.map((item) => [item.adminId, item.officeActionId])).toEqual([
      [1, 10],
      [1, 11],
      [2, 12],
    ]);
  });

  it("문서가 없으면 빈 목록이다", () => {
    expect(toPatentDocumentItems(patent, [])).toEqual([]);
    expect(toPatentDocumentItems(patent, [admin({ officeActions: [] })])).toEqual([]);
  });

  it("actionDate가 없으면 null로 넘긴다", () => {
    const [item] = toPatentDocumentItems(patent, [admin({ actionDate: null })]);

    expect(item.actionDate).toBeNull();
  });
});

describe("countDocumentsByPatent", () => {
  it("통지서 수로 세고 특허별로 합산한다", () => {
    const counts = countDocumentsByPatent([
      { patentId: 1, _count: { officeActions: 2 } },
      { patentId: 1, _count: { officeActions: 1 } },
      { patentId: 2, _count: { officeActions: 0 } },
    ]);

    expect(counts.get(1)).toBe(3);
    expect(counts.get(2)).toBe(0);
    expect(counts.get(3)).toBeUndefined();
  });

  it("배지 숫자가 뷰어 항목 수와 같다", () => {
    const admins = [
      admin({ id: 1, officeActions: [officeAction({ id: 10 }), officeAction({ id: 11 })] }),
      admin({ id: 2, officeActions: [officeAction({ id: 12 })] }),
    ];
    const counted = countDocumentsByPatent(
      admins.map((row) => ({
        patentId: patent.id,
        _count: { officeActions: row.officeActions.length },
      })),
    );

    expect(counted.get(patent.id)).toBe(toPatentDocumentItems(patent, admins).length);
  });
});
