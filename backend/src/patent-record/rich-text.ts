/**
 * 서식 있는 긴 글(`patent.note` — 화면의 '설명')을 다루는 규칙.
 *
 * 화면의 WYSIWYG 편집기가 HTML 조각을 보낸다. 서버가 그것을 **그대로 저장**하는 대신
 * 두 가지만 한다.
 *
 *  1. 비어 있는지 판정한다 — 편집기는 내용을 지워도 빈 문자열이 아니라 `<p><br></p>`
 *     같은 껍데기를 남긴다. 그대로 두면 '없음'이어야 할 값이 '내용 있음'으로 저장되고,
 *     다음 저장에서 껍데기끼리 비교돼 사람이 보기엔 아무것도 안 바뀐 활동 행이 남는다.
 *  2. 활동 피드에 쓸 한 줄 요약을 만든다 — 원문을 before/after에 넣으면 피드 한 칸에
 *     문단이 통째로, 그것도 태그째 밀려 들어온다.
 *
 * Prisma를 import하지 않는 순수 모듈이다(patent-audit-fields.ts와 같은 이유).
 * **신뢰 경계가 아니다** — 어떤 태그를 허용할지 거르는 일은 화면이 저장 전과 표시 전에
 * 각각 한다. 여기서 태그를 지우는 것은 오직 사람이 읽을 문자열을 뽑기 위해서다.
 */

/** 요약 한 줄의 최대 길이. 활동 피드 한 칸에 들어가는 정도다. */
const SUMMARY_LIMIT = 60;

/** 편집기가 흔히 남기는 엔티티만. 표시용이라 전부 풀 필요는 없다. */
const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/** HTML 조각에서 사람이 읽는 문자열만. 이미지는 자리를 남긴다(글자가 없어도 내용이다). */
export const richTextToPlain = (value: string | null | undefined): string => {
  if (!value) return "";
  return value
    .replace(/<img\b[^>]*>/gi, " [이미지] ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * 저장할 값으로 다듬는다. 글자도 이미지도 없으면 컬럼을 비운다(null).
 * `undefined`는 "이 요청이 건드리지 않는 필드"라는 뜻이라 그대로 통과시킨다.
 */
export const normalizeRichText = (
  value: string | null | undefined,
): string | null | undefined => {
  if (value === undefined || value === null) return value;
  return richTextToPlain(value).length > 0 ? value : null;
};

/** 활동 피드에 쓸 한 줄. 길면 잘라 낸다. */
export const summarizeRichText = (
  value: string | null | undefined,
  limit: number = SUMMARY_LIMIT,
): string | null => {
  const plain = richTextToPlain(value);
  if (plain.length === 0) return null;
  return plain.length > limit ? `${plain.slice(0, limit)}…` : plain;
};

/**
 * 평문 한 덩이 → 문단 HTML.
 *
 * 줄바꿈이 문단 경계다 — 시트에서 한 칸에 여러 줄을 적는 방식이 그것이다. 감싸지 않고
 * 그대로 두면 `<`가 든 메모가 화면에서 태그로 읽히고 줄바꿈은 사라진다.
 *
 * 20260826120000 마이그레이션의 SQL과 **같은 결과**를 내야 한다. 한쪽만 고치면 옮겨 온
 * 옛 값과 새로 임포트한 값의 생김새가 달라진다.
 */
export const plainTextToRichText = (text: string): string => text
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .split(/\r\n?|\n/)
  .map((line) => `<p>${line}</p>`)
  .join("");

/**
 * 시트의 '기타'와 'Status 설명'을 설명(note) 하나로 합친다.
 *
 * 두 열은 원래 note·status_note로 따로 들어갔는데, 화면이 자유 서술을 '설명' 한 자리로
 * 합치면서 갈 곳이 하나가 됐다(20260826120000 마이그레이션이 기존 행을 옮겼다).
 *
 * **여기서는 둘을 이어 붙인다.** 기존 행을 옮길 때는 status_note가 note를 덮어썼지만,
 * 그건 한 번 보고 내린 판단이고 임포트는 매번 새 시트를 받는다 — 한쪽을 버리는 규칙을
 * 상시로 두면 임포트할 때마다 '기타' 열이 조용히 사라진다.
 */
export const mergeSheetNotes = (
  ...values: (string | null | undefined)[]
): string | null => {
  const parts = values
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0)
    .map(plainTextToRichText);
  return parts.length > 0 ? parts.join("") : null;
};
