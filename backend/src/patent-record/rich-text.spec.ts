/**
 * 설명(note)에 들어가는 서식 있는 글의 규칙 검증.
 *
 * 두 가지를 지킨다. (1) 저장 전에 빈 값을 가려내는가 — 편집기가 남기는 껍데기가 '내용
 * 있음'으로 저장되면 헛된 이력이 생긴다. (2) **평문을 감싸는 방식이 마이그레이션 SQL과
 * 같은가** — 20260826120000이 옛 status_note를 옮길 때 쓴 규칙과 임포트가 시트 값을
 * 넣을 때 쓰는 규칙이 어긋나면, 같은 문장이 행마다 다른 모양으로 남는다.
 */
import {
  mergeSheetNotes,
  normalizeRichText,
  plainTextToRichText,
  richTextToPlain,
  summarizeRichText,
} from "./rich-text";

describe("plainTextToRichText", () => {
  it("줄바꿈이 문단 경계다", () => {
    // 시트는 한 칸에 여러 줄을 적는다. 그대로 넣으면 화면에서 한 줄로 붙어 버린다.
    expect(plainTextToRichText("OA 발행\n2025-05-09")).toBe(
      "<p>OA 발행</p><p>2025-05-09</p>",
    );
  });

  it("시트에서 온 \\r\\n도 같은 결과를 낸다", () => {
    expect(plainTextToRichText("첫 줄\r\n둘째 줄")).toBe(
      plainTextToRichText("첫 줄\n둘째 줄"),
    );
  });

  it("꺾쇠와 &는 글자로 남는다(태그로 읽히지 않는다)", () => {
    expect(plainTextToRichText("<b>주의</b> & 확인")).toBe(
      "<p>&lt;b&gt;주의&lt;/b&gt; &amp; 확인</p>",
    );
  });
});

describe("mergeSheetNotes", () => {
  it("'기타'와 'Status 설명'을 이어 붙인다", () => {
    // 한쪽을 버리면 임포트할 때마다 시트의 한 열이 조용히 사라진다.
    expect(mergeSheetNotes("원출원에서 삭제된 청구항", "OA 발행")).toBe(
      "<p>원출원에서 삭제된 청구항</p><p>OA 발행</p>",
    );
  });

  it("한쪽만 있으면 그것만 넣는다", () => {
    expect(mergeSheetNotes(null, "OA 발행")).toBe("<p>OA 발행</p>");
    expect(mergeSheetNotes("  ", "OA 발행")).toBe("<p>OA 발행</p>");
  });

  it("둘 다 비면 컬럼을 비운다", () => {
    expect(mergeSheetNotes(undefined, "   ")).toBeNull();
  });
});

describe("normalizeRichText", () => {
  it("편집기가 남긴 빈 껍데기는 null이다", () => {
    expect(normalizeRichText("<p><br></p>")).toBeNull();
  });

  it("글자가 없어도 이미지가 있으면 내용이다", () => {
    expect(normalizeRichText('<p><img src="/files/a.png"></p>')).not.toBeNull();
  });

  it("undefined는 '이 요청이 건드리지 않는 필드'라 그대로 통과한다", () => {
    expect(normalizeRichText(undefined)).toBeUndefined();
  });
});

describe("richTextToPlain / summarizeRichText", () => {
  it("태그를 벗기고 이미지는 자리를 남긴다", () => {
    expect(richTextToPlain('<p>결과</p><p><img src="/a.png"></p>')).toBe(
      "결과 [이미지]",
    );
  });

  it("긴 글은 잘라서 요약한다", () => {
    expect(summarizeRichText(`<p>${"가".repeat(100)}</p>`)).toBe(
      `${"가".repeat(60)}…`,
    );
  });
});
