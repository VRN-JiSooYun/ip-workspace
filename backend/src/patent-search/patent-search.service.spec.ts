import type { ConfigService } from "@nestjs/config";
import {
  PATENT_SEARCH_DATE_FIELDS,
  PatentSearchDto,
} from "./dto/patent-search.dto";
import { PatentSearchService } from "./patent-search.service";
import {
  UpstreamSearchRequest,
  UpstreamSearchRow,
} from "./patent-search.types";

const dto = (overrides: Partial<PatentSearchDto> = {}): PatentSearchDto =>
  Object.assign(new PatentSearchDto(), overrides);

const clientWith = (rows: UpstreamSearchRow[] = [], total = rows.length) => {
  const search = jest.fn().mockResolvedValue({
    total,
    page: 1,
    size: 20,
    data: rows,
  });
  const findPatentByApplicationNumber = jest.fn().mockResolvedValue(null);
  return {
    client: { search, findPatentByApplicationNumber } as never,
    search,
    findPatentByApplicationNumber,
  };
};

const sentBody = (search: jest.Mock): UpstreamSearchRequest =>
  (search.mock.calls as UpstreamSearchRequest[][])[0][0];

const row = (
  overrides: Partial<UpstreamSearchRow> = {},
): UpstreamSearchRow => ({
  office_action_id: 11850,
  relevance_score: null,
  admin_id: 108229,
  office_action_content: "발송번호: 9-5-2023-097003752",
  office_action_document_path: "http://example.test/oa.pdf",
  admin_id_ref: 108229,
  action_date: "2023-10-26T00:00:00",
  action: "의견제출통지서",
  action_number: "952023097003752",
  patent_id: 11977,
  application_number: "1020210141668",
  korean_title: "항암제를 포함한 미토콘드리아",
  english_title: "MITOCHONDRIA",
  applicant: "주식회사 파이안바이오테크놀로지",
  legal_status: 1,
  exam_status: 4,
  exam: true,
  examiners: [],
  responses: [],
  legal_statutes: [],
  ...overrides,
});

/**
 * 서비스 하나. 설정은 PATENT_DOCUMENT_BASE_URL 하나만 보므로 가짜 ConfigService로 그것만 준다.
 * 값을 주지 않으면 문서 주소를 그대로 내보내는(프록시 없는) 사내 환경이다.
 */
const makeService = (client: never, baseUrl: string | null = null) =>
  new PatentSearchService(client, {
    get: (key: string, fallback: unknown) =>
      (key === "documents.baseUrl" ? baseUrl : fallback),
  } as unknown as ConfigService);

describe("PatentSearchService", () => {
  describe("request mapping", () => {
    it("omits filters and keywords when no condition is given", async () => {
      const { client, search } = clientWith();
      await makeService(client).search(dto());

      expect(sentBody(search)).toEqual({ page: 1, size: 20 });
    });

    it("renames filters to the upstream snake_case contract", async () => {
      const { client, search } = clientWith();
      await makeService(client).search(
        dto({
          filters: {
            legalStatusText: ["등록"],
            examStatusText: ["심사중"],
            examRequested: true,
            attorneyNames: ["홍길동"],
            examinerNames: ["김심사"],
            hasOpinion: true,
            hasAmendment: false,
          },
        }),
      );

      expect(sentBody(search).filters).toEqual({
        legal_status_text: ["등록"],
        exam_status_text: ["심사중"],
        exam_requested: true,
        attorney_names: ["홍길동"],
        examiner_names: ["김심사"],
        has_opinion: true,
        has_amendment: false,
      });
    });

    it("sends date ranges with the from/to aliases the upstream model expects", async () => {
      const { client, search } = clientWith();
      await makeService(client).search(
        dto({
          filters: {
            dateRanges: [
              {
                field: "intApplicationDate",
                from: "2023-01-01",
                to: "2023-12-31",
              },
            ],
          },
        }),
      );

      expect(sentBody(search).filters?.date_ranges).toEqual([
        { field: "int_application_date", from: "2023-01-01", to: "2023-12-31" },
      ]);
    });

    it("maps every allowed date field to its upstream column", async () => {
      const { client, search } = clientWith();
      await makeService(client).search(
        dto({
          filters: {
            dateRanges: PATENT_SEARCH_DATE_FIELDS.map((field) => ({
              field,
              from: "2020-01-01",
            })),
          },
        }),
      );

      expect(
        sentBody(search).filters?.date_ranges?.map((r) => r.field),
      ).toEqual([
        "application_date",
        "publication_date",
        "int_application_date",
        "int_publication_date",
        "exam_date",
      ]);
    });

    // registration_date는 외부 column이 text라 비교가 항상 500으로 실패한다.
    it("does not offer registrationDate as a date field", () => {
      expect(PATENT_SEARCH_DATE_FIELDS).not.toContain("registrationDate");
    });

    it("drops date ranges that carry neither bound", async () => {
      const { client, search } = clientWith();
      await makeService(client).search(
        dto({ filters: { dateRanges: [{ field: "examDate" }] } }),
      );

      expect(sentBody(search).filters).toBeUndefined();
    });

    it("maps ipc and statute filters, preferring the law type name over the code", async () => {
      const { client, search } = clientWith();
      await makeService(client).search(
        dto({
          filters: {
            ipc: [{ section: "A", classCode: "61", mainGroup: "31" }],
            statutes: [
              { lawTypeText: "특허법", lawType: 1, article: 29, paragraph: 2 },
              { lawType: 1, subParagraph: 3 },
            ],
          },
        }),
      );

      expect(sentBody(search).filters?.ipc).toEqual([
        { section: "A", class_code: "61", main_group: "31" },
      ]);
      expect(sentBody(search).filters?.statutes).toEqual([
        { law_type: "특허법", article: 29, paragraph: 2 },
        { law_type: 1, sub_paragraph: 3 },
      ]);
    });

    it("drops ipc entries that carry no component", async () => {
      const { client, search } = clientWith();
      await makeService(client).search(
        dto({ filters: { ipc: [{}] } }),
      );

      expect(sentBody(search).filters).toBeUndefined();
    });

    // 외부 API는 targets가 2개 이상이면 500으로 실패한다. 항목당 하나만 보내야 한다.
    it("wraps each keyword target in a single-element array", async () => {
      const { client, search } = clientWith();
      await makeService(client).search(
        dto({
          keywords: [
            { query: "egfr", target: "officeAction", operator: "AND" },
            { query: "egfr", target: "opinion", operator: "NOT" },
          ],
        }),
      );

      expect(sentBody(search).keywords).toEqual([
        { query: "egfr", targets: ["office_action"], operator: "AND" },
        { query: "egfr", targets: ["opinion"], operator: "NOT" },
      ]);
    });
  });

  describe("response mapping", () => {
    it("normalizes an office action row to camelCase", async () => {
      const { client } = clientWith(
        [
          row({
            examiners: [
              {
                id: 7,
                office: "지식재산처",
                bureau: "디지털융합심사국",
                department: "바이오의약심사팀",
                name: "박희연",
              },
            ],
            responses: [
              {
                id: 9369,
                type: 1,
                content: "# 의견서",
                document_path: "http://example.test/opinion.pdf",
              },
              {
                id: 9370,
                type: 2,
                content: "# 보정서",
                document_path: "http://example.test/amendment.pdf",
              },
            ],
            legal_statutes: [
              {
                rejection_id: 38516,
                claim: "청구항 전항",
                law_type: 1,
                article: 29,
                paragraph: 2,
                sub_paragraph: null,
              },
            ],
          }),
        ],
        96,
      );

      const result = await makeService(client).search(dto());

      expect(result.total).toBe(96);
      expect(result.items).toHaveLength(1);
      const [item] = result.items;
      expect(item).toMatchObject({
        officeActionId: 11850,
        adminId: 108229,
        applicationNumber: "1020210141668",
        koreanTitle: "항암제를 포함한 미토콘드리아",
        legalStatusId: 1,
        examStatusId: 4,
        exam: true,
        documentPath: "http://example.test/oa.pdf",
      });
      expect(item.examiners[0]).toMatchObject({ id: 7, name: "박희연" });
      expect(item.submissions.map((s) => s.kind)).toEqual([
        "OPINION",
        "AMENDMENT",
      ]);
      expect(item.rejections[0]).toEqual({
        rejectionId: 38516,
        claim: "청구항 전항",
        lawType: 1,
        article: 29,
        paragraph: 2,
        subParagraph: null,
      });
    });

    it("PATENT_DOCUMENT_BASE_URL이 있으면 문서 주소를 프록시 주소로 바꿔 내보낸다", async () => {
      // 사무실 밖에서는 사내망 호스트에 닿지 않는다. 경로는 그대로 두고 origin만 옮긴다.
      const { client } = clientWith([
        row({
          responses: [
            { id: 1, type: 1, content: "의견", document_path: "http://example.test/opinion.pdf" },
            { id: 2, type: 2, content: "보정", document_path: "http://example.test/amendment.pdf" },
          ],
        }),
      ]);
      const result = await makeService(client, "https://ip.example.com").search(dto());

      expect(result.items[0].documentPath).toBe("https://ip.example.com/oa.pdf");
      expect(result.items[0].submissions.map((item) => item.documentPath)).toEqual([
        "https://ip.example.com/opinion.pdf",
        "https://ip.example.com/amendment.pdf",
      ]);
    });

    it("PATENT_DOCUMENT_BASE_URL이 없으면 상류 주소를 그대로 쓴다", async () => {
      const { client } = clientWith([row()]);
      const result = await makeService(client).search(dto());

      expect(result.items[0].documentPath).toBe("http://example.test/oa.pdf");
    });

    it("leaves kind null for response type codes it does not know", async () => {
      const { client } = clientWith([
        row({
          responses: [
            { id: 1, type: 99, content: "?", document_path: null },
            { id: 2, type: null, content: "?", document_path: null },
          ],
        }),
      ]);

      const result = await makeService(client).search(dto());

      expect(result.items[0].submissions.map((s) => s.kind)).toEqual([
        null,
        null,
      ]);
      expect(result.items[0].submissions[0].typeCode).toBe(99);
    });

    it("strips bodies but keeps their length when includeContent is false", async () => {
      const { client } = clientWith([
        row({
          office_action_content: "0123456789",
          responses: [{ id: 1, type: 1, content: "abc", document_path: null }],
        }),
      ]);

      const result = await makeService(client).search(
        dto({ includeContent: false }),
      );

      const [item] = result.items;
      expect(item.content).toBeNull();
      expect(item.contentLength).toBe(10);
      expect(item.submissions[0].content).toBeNull();
      expect(item.submissions[0].contentLength).toBe(3);
    });

    it("echoes the requested page and size rather than the upstream values", async () => {
      const { client } = clientWith([], 13488);

      const result = await makeService(client).search(
        dto({ page: 7, size: 50 }),
      );

      expect(result).toMatchObject({ page: 7, size: 50, total: 13488 });
    });

    it("tolerates null collections in the upstream row", async () => {
      const { client } = clientWith([
        row({ examiners: null, responses: null, legal_statutes: null }),
      ]);

      const result = await makeService(client).search(dto());

      expect(result.items[0]).toMatchObject({
        examiners: [],
        submissions: [],
        rejections: [],
      });
    });

    it("preserves the upstream keyword relevance score", async () => {
      const { client } = clientWith([row({ relevance_score: 3.0359515666390378 })]);

      const result = await makeService(client).search(dto());

      expect(result.items[0].relevanceScore).toBe(3.0359515666390378);
    });
  });

  describe("legal status resolution", () => {
    it("resolves the upstream legal_status code to its text", async () => {
      const { client } = clientWith([
        row({ legal_status: 3 }),
        row({ legal_status: 6 }),
        row({ legal_status: 99 }),
        row({ legal_status: null }),
      ]);

      const result = await makeService(client).search(dto());

      expect(result.items.map((item) => item.legalStatus)).toEqual([
        "거절",
        "소멸 (등록료불납)",
        null,
        null,
      ]);
      // 모르는 코드여도 원본 id는 남긴다.
      expect(result.items[2].legalStatusId).toBe(99);
    });
  });

  describe("patent detail enrichment", () => {
    const detail = {
      application_date: "2021-05-25T00:00:00",
      registration_number: null,
      registration_date: null,
      publication_number: "1020230015954",
      publication_date: "2023-01-31T00:00:00",
      int_application_number: "PCT/US2021/034000",
      int_application_date: "2021-05-25T00:00:00",
      int_publication_number: "WO2021242728",
      int_publication_date: "2021-12-02T00:00:00",
      parent_application_number: null,
      exam_date: "2024-05-13T00:00:00",
      country: 1,
      attorney_number: null,
      // 응답에 함께 오지만 전달하면 안 되는 벡터.
      title_embedding: [0.1, 0.2],
    };

    it("does not call the detail endpoint unless asked", async () => {
      const { client, findPatentByApplicationNumber } = clientWith([row()]);

      const result = await makeService(client).search(dto());

      expect(findPatentByApplicationNumber).not.toHaveBeenCalled();
      expect(result.items[0].patent).toBeNull();
    });

    it("attaches the detail columns the search response omits", async () => {
      const { client, findPatentByApplicationNumber } = clientWith([row()]);
      findPatentByApplicationNumber.mockResolvedValue(detail);

      const result = await makeService(client).search(
        dto({ includePatentDetail: true }),
      );

      expect(findPatentByApplicationNumber).toHaveBeenCalledWith(
        "1020210141668",
      );
      expect(result.items[0].patent).toEqual({
        applicationDate: "2021-05-25T00:00:00",
        registrationNumber: null,
        registrationDate: null,
        publicationNumber: "1020230015954",
        publicationDate: "2023-01-31T00:00:00",
        intApplicationNumber: "PCT/US2021/034000",
        intApplicationDate: "2021-05-25T00:00:00",
        intPublicationNumber: "WO2021242728",
        intPublicationDate: "2021-12-02T00:00:00",
        parentApplicationNumber: null,
        examDate: "2024-05-13T00:00:00",
        countryId: 1,
        attorneyNumber: null,
      });
    });

    // 같은 특허에 OA가 여러 건이면 같은 출원번호가 여러 행으로 나온다.
    it("looks each application number up once and shares the result", async () => {
      const { client, findPatentByApplicationNumber } = clientWith([
        row({ office_action_id: 1, application_number: "10201" }),
        row({ office_action_id: 2, application_number: "10201" }),
        row({ office_action_id: 3, application_number: "10202" }),
      ]);
      findPatentByApplicationNumber.mockResolvedValue(detail);

      const result = await makeService(client).search(
        dto({ includePatentDetail: true }),
      );

      expect(findPatentByApplicationNumber).toHaveBeenCalledTimes(2);
      expect(result.items.every((item) => item.patent !== null)).toBe(true);
    });

    it("leaves patent null when the lookup finds nothing", async () => {
      const { client, findPatentByApplicationNumber } = clientWith([row()]);
      findPatentByApplicationNumber.mockResolvedValue(null);

      const result = await makeService(client).search(
        dto({ includePatentDetail: true }),
      );

      expect(result.items[0].patent).toBeNull();
    });
  });
});
