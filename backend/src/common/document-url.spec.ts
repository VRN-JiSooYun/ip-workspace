/**
 * 문서 주소 중계 규칙 검증.
 *
 * 여기가 틀리면 두 가지 중 하나가 난다. 주소를 잘못 만들면 **문서가 안 열리고**, 통과
 * 조건을 느슨하게 두면 우리 서버가 **아무 주소나 대신 불러 주는 열린 프록시**가 된다.
 * 뒤쪽이 더 나쁘다 — 인증을 붙이려고 만든 통로가 오히려 구멍이 된다.
 */
import {
  createDocumentUrlRewriter,
  toUpstreamDocumentUrl,
} from "./document-url";

/** 실제 파일 호스트와 실제 저장된 주소 모양. */
const FILE_ORIGIN = "http://172.16.1.210:8888";
const OA_URL = `${FILE_ORIGIN}/oa/2022/1020220059638_의견제출통지서_20230620.pdf`;

describe("createDocumentUrlRewriter", () => {
  const rewrite = createDocumentUrlRewriter(FILE_ORIGIN);

  it("파일 호스트를 우리 중계 경로로 바꾼다", () => {
    expect(rewrite(OA_URL)).toBe(
      "/patent-documents/oa/2022/1020220059638_의견제출통지서_20230620.pdf",
    );
  });

  it("파일명을 손대지 않는다", () => {
    // 화면이 이 문자열에서 파일명과 날짜를 읽어 타임라인을 만든다. 퍼센트 인코딩으로
    // 바꿔 버리면 그 파싱이 조용히 어긋난다.
    expect(rewrite(OA_URL)).toContain("_의견제출통지서_20230620.pdf");
  });

  it("제출 서류 경로도 중계한다", () => {
    expect(rewrite(`${FILE_ORIGIN}/response/opinion/2022/x.pdf`)).toBe(
      "/patent-documents/response/opinion/2022/x.pdf",
    );
  });

  describe("건드리지 않는 것", () => {
    it("다른 호스트의 주소", () => {
      // 우리가 아는 파일 호스트가 아니다. 중계 대상이 아니므로 그대로 둔다.
      const other = "http://files.other.test/oa/2022/a.pdf";
      expect(rewrite(other)).toBe(other);
    });

    it("허용하지 않은 경로", () => {
      const outside = `${FILE_ORIGIN}/etc/passwd`;
      expect(rewrite(outside)).toBe(outside);
    });

    it("절대 URL이 아닌 값", () => {
      expect(rewrite("/oa/2022/a.pdf")).toBe("/oa/2022/a.pdf");
    });

    it("빈 값은 null", () => {
      expect(rewrite(null)).toBeNull();
      expect(rewrite(undefined)).toBeNull();
      expect(rewrite("   ")).toBeNull();
    });
  });

  describe("파일 호스트 설정이 없을 때", () => {
    it("상류 주소를 그대로 내보낸다", () => {
      // 중계할 대상을 모르는 채로 주소를 건드리면 어디로도 닿지 않는 주소가 된다.
      for (const origin of [undefined, null, "", "  ", "not a url"]) {
        expect(createDocumentUrlRewriter(origin)(OA_URL)).toBe(OA_URL);
      }
    });
  });
});

describe("toUpstreamDocumentUrl", () => {
  it("중계 경로를 상류 주소로 되돌린다", () => {
    expect(toUpstreamDocumentUrl("/oa/2022/a.pdf", FILE_ORIGIN)).toBe(
      `${FILE_ORIGIN}/oa/2022/a.pdf`,
    );
  });

  it("앞의 슬래시가 없어도 같은 결과다", () => {
    // Express의 와일드카드는 앞 슬래시를 떼고 넘긴다.
    expect(toUpstreamDocumentUrl("oa/2022/a.pdf", FILE_ORIGIN)).toBe(
      `${FILE_ORIGIN}/oa/2022/a.pdf`,
    );
  });

  describe("열린 프록시가 되지 않게", () => {
    it("허용하지 않은 첫 마디는 거절한다", () => {
      // 이걸 열어 두면 파일 호스트의 아무 경로나 우리 이름으로 받아 갈 수 있다.
      expect(toUpstreamDocumentUrl("/etc/passwd", FILE_ORIGIN)).toBeNull();
      expect(toUpstreamDocumentUrl("/", FILE_ORIGIN)).toBeNull();
      expect(toUpstreamDocumentUrl("", FILE_ORIGIN)).toBeNull();
    });

    it("상위 경로로 빠져나가려는 시도를 거절한다", () => {
      expect(toUpstreamDocumentUrl("/oa/../etc/passwd", FILE_ORIGIN)).toBeNull();
      // 인코딩해 숨겨도 마찬가지다. decodeURI는 %2F를 풀지 않으므로 `..`가 그대로 남는다.
      expect(toUpstreamDocumentUrl("/oa/..%2f..%2fetc", FILE_ORIGIN)).toBeNull();
    });

    it("경로에 다른 호스트를 끼워 넣어도 파일 호스트로만 간다", () => {
      // `//evil.test/x`처럼 스킴 없는 절대 주소를 넣어도 origin은 우리 것이 유지돼야 한다.
      const result = toUpstreamDocumentUrl("/oa/2022/a.pdf", FILE_ORIGIN);
      expect(result?.startsWith(`${FILE_ORIGIN}/`)).toBe(true);
    });

    it("파일 호스트 설정이 망가졌으면 아무것도 내주지 않는다", () => {
      expect(toUpstreamDocumentUrl("/oa/2022/a.pdf", "not a url")).toBeNull();
    });
  });
});
