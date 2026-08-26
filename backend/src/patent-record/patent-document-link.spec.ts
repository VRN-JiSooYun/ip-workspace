/**
 * OA DB 문서 연결의 판단 규칙 검증.
 *
 * 두 가지가 사실과 어긋나면 화면이 거짓말을 한다. (1) **찾을 수 있는 모양인가** — 미국
 * 출원번호로 조회를 보내 놓고 "문서가 없습니다"라고 말하면, 있는데 못 찾은 것처럼 읽힌다.
 * (2) **무엇을 이어 붙일 것인가** — PDF가 없는 통지서를 담으면 문서 건수만 늘고 뷰어에서는
 * 열리지 않는다.
 */
import {
  checkLinkable,
  groupOaDocumentRows,
  normalizeApplicationNumber,
  type OaDocumentRow,
} from "./patent-document-link";

/** OA DB 조인 한 줄. 지정하지 않은 값은 문서가 붙어 있는 통지서 하나로 채운다. */
const row = (overrides: Partial<OaDocumentRow> = {}): OaDocumentRow => ({
  admin_id: 1,
  action: "의견제출통지서",
  action_date: new Date("2025-09-09T00:00:00.000Z"),
  action_number: "952025086991174",
  oa_id: 10,
  oa_content: "통지서 본문",
  oa_document_path: "http://files/oa/1020227002845_의견제출통지서_20250909.pdf",
  response_id: null,
  response_type: null,
  response_content: null,
  response_document_path: null,
  ...overrides,
});

describe("checkLinkable", () => {
  it("구분자를 걷어내고 13자리면 이어 붙일 수 있다", () => {
    // 운영 시트 표기는 `10-2022-0001748`, OA DB는 `1020220001748`이다.
    expect(checkLinkable("10-2022-0001748")).toEqual({
      linkable: true,
      normalized: "1020220001748",
    });
  });

  it("KR이 아닌 출원번호는 조회를 보내지 않는다", () => {
    // OA DB는 20,786건이 전부 country=1에 13자리다. 미국 건은 찾을 것이 애초에 없다.
    expect(checkLinkable("19/585,479")).toEqual({
      linkable: false,
      reason: "NOT_KR_APPLICATION_NUMBER",
      normalized: "19585479",
    });
    expect(checkLinkable("PCT/KR2022/000172").linkable).toBe(false);
  });

  it("자리수만 본다 — 하이픈이 있든 없든 같은 값이다", () => {
    expect(normalizeApplicationNumber("10-2022-0001748")).toBe(
      normalizeApplicationNumber("1020220001748"),
    );
  });
});

describe("groupOaDocumentRows", () => {
  it("평평한 조인을 처분 → 통지서 → 제출 서류로 되돌린다", () => {
    const grouped = groupOaDocumentRows([
      row({ response_id: 100, response_type: 1, response_document_path: "http://files/의견서.pdf" }),
      row({ response_id: 101, response_type: 2, response_document_path: "http://files/보정서.pdf" }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].actionNumber).toBe("952025086991174");
    expect(grouped[0].officeActions).toHaveLength(1);
    expect(grouped[0].officeActions[0].responses.map((item) => item.type)).toEqual([1, 2]);
  });

  it("같은 처분의 통지서 여러 건을 한 처분 아래 모은다", () => {
    const grouped = groupOaDocumentRows([
      row({ oa_id: 10 }),
      row({ oa_id: 11, oa_document_path: "http://files/두번째.pdf" }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].officeActions).toHaveLength(2);
  });

  it("PDF가 없는 통지서는 버린다", () => {
    // 본문만 복사해 두면 '문서 N건'이 늘어나는데 눌러도 열리는 것이 없다.
    expect(groupOaDocumentRows([row({ oa_document_path: null })])).toEqual([]);
  });

  it("통지서에 PDF가 없어도 제출 서류에 있으면 통지서째 가져온다", () => {
    // 제출 서류는 통지서에 매달려야 자리를 잡는다. 부모를 버리면 자식도 못 붙인다.
    const grouped = groupOaDocumentRows([
      row({
        oa_document_path: null,
        response_id: 100,
        response_type: 1,
        response_document_path: "http://files/의견서.pdf",
      }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].officeActions[0].documentPath).toBeNull();
    expect(grouped[0].officeActions[0].responses).toHaveLength(1);
  });

  it("PDF 없는 제출 서류만 떨어져 나간다", () => {
    const grouped = groupOaDocumentRows([
      row({ response_id: 100, response_type: 1, response_document_path: null }),
      row({ response_id: 101, response_type: 2, response_document_path: "http://files/보정서.pdf" }),
    ]);

    expect(grouped[0].officeActions[0].responses.map((item) => item.type)).toEqual([2]);
  });

  it("가져올 문서가 하나도 없으면 빈 목록이다", () => {
    expect(groupOaDocumentRows([])).toEqual([]);
  });
});
