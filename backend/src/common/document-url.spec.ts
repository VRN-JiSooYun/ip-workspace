/**
 * 문서 URL 치환 검증.
 *
 * 이 규칙이 틀어지면 화면에서 PDF가 열리지 않는다 — 사무실 밖에서는 사내망 주소에 닿지
 * 않고, 잘못 옮기면 프록시가 모르는 경로를 부른다. 그래서 **경로는 그대로 두고 origin만
 * 바꾼다**는 것과, **설정이 없거나 이상하면 원본을 그대로 둔다**는 것을 못 박아 둔다.
 */
import { createDocumentUrlRewriter } from "./document-url";

/** OA DB가 실제로 주는 모양. */
const OA_URL = "http://172.16.1.210:8888/oa/2022/1020220059638_의견제출통지서_20230620.pdf";

describe("createDocumentUrlRewriter", () => {
  describe("PATENT_DOCUMENT_BASE_URL이 없을 때", () => {
    it("상류 주소를 그대로 내보낸다", () => {
      // 사내에서는 그 호스트에 바로 닿는다. 프록시가 필요 없다.
      for (const baseUrl of [undefined, null, "", "   "]) {
        expect(createDocumentUrlRewriter(baseUrl)(OA_URL)).toBe(OA_URL);
      }
    });

    it("형식이 틀린 PATENT_DOCUMENT_BASE_URL도 원본을 살린다", () => {
      // 설정 하나가 잘못됐다고 문서 목록 자체를 못 쓰게 만들지 않는다.
      expect(createDocumentUrlRewriter("not a url")(OA_URL)).toBe(OA_URL);
    });
  });

  describe("PATENT_DOCUMENT_BASE_URL이 있을 때", () => {
    const rewrite = createDocumentUrlRewriter("https://ip.example.com");

    it("origin만 바꾸고 경로는 그대로 둔다", () => {
      expect(rewrite(OA_URL)).toBe(
        "https://ip.example.com/oa/2022/1020220059638_의견제출통지서_20230620.pdf",
      );
    });

    it("쿼리와 프래그먼트를 잃지 않는다", () => {
      expect(rewrite("http://172.16.1.210:8888/a/b.pdf?v=2#page=3")).toBe(
        "https://ip.example.com/a/b.pdf?v=2#page=3",
      );
    });

    it("끝의 슬래시는 경로를 겹치지 않게 한다", () => {
      expect(createDocumentUrlRewriter("https://ip.example.com/")(OA_URL)).toBe(
        rewrite(OA_URL),
      );
    });

    it("PATENT_DOCUMENT_BASE_URL에 경로가 있으면 앞에 붙인다", () => {
      // Nginx가 하위 경로로 중계하는 경우다(`location /files/`).
      expect(
        createDocumentUrlRewriter("https://ip.example.com/files")(
          "http://172.16.1.210:8888/oa/2022/a.pdf",
        ),
      ).toBe("https://ip.example.com/files/oa/2022/a.pdf");
    });

    it("호스트가 달라도 같은 규칙으로 옮긴다", () => {
      // 문서가 다른 파일 서버로 옮겨가도 프록시 뒤로 들어가는 것은 마찬가지다.
      expect(rewrite("http://172.16.1.183:8888/oa/x.pdf")).toBe(
        "https://ip.example.com/oa/x.pdf",
      );
    });

    it("빈 값은 null로 둔다", () => {
      expect(rewrite(null)).toBeNull();
      expect(rewrite(undefined)).toBeNull();
      expect(rewrite("")).toBeNull();
    });

    it("절대 URL이 아니면 건드리지 않는다", () => {
      // 무엇을 바꿔야 할지 알 수 없다. 상대 경로는 이미 우리 origin 기준이다.
      expect(rewrite("/oa/2022/a.pdf")).toBe("/oa/2022/a.pdf");
    });

    it("http(s)가 아닌 주소는 옮기지 않는다", () => {
      // data:·file:은 프록시로 중계할 수 있는 것이 아니다.
      expect(rewrite("data:application/pdf;base64,AAAA")).toBe(
        "data:application/pdf;base64,AAAA",
      );
    });
  });
});
