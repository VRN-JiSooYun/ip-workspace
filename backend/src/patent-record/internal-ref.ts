/**
 * IP팀 내부관리번호 파싱.
 *
 *   A 25 0 001        A250001     당사 기초출원
 *   A 25 P 001        A25P001     우선권주장
 *   A 25 W 001        A25W001     PCT
 *   L 18 Y 001        L18Y001     License-in
 *   F 25 W 001 US     F25W001US   미국 진입
 *   │  │  │  │   └─ 국가 2자 (선택)
 *   │  │  │  └───── 일련번호 3자
 *   │  │  └──────── 유형 1자
 *   │  └─────────── 연도 2자
 *   └────────────── 출처 1자
 *
 * 1단계에서는 규칙을 강제하지 않는다. 파싱에 실패해도 원문은 그대로 저장하고
 * 구성요소만 비워 둔다. 실데이터를 모은 뒤 규칙을 확정하기 위한 의도적 선택이다.
 * (`L18Y001`의 `Y`처럼 아직 정의되지 않은 값이 이미 존재한다.)
 */

export type InternalRefParts = {
  refOrigin: string;
  refYear: number;
  refType: string;
  refSerial: number;
  refCountry: string | null;
};

const PATTERN = /^([A-Z])(\d{2})([A-Z0-9])(\d{3})([A-Z]{2})?$/;

/** 대소문자·공백 차이로 같은 번호가 둘로 갈리지 않도록 정규화한다. */
export const normalizeInternalRef = (value: string): string =>
  value.trim().toUpperCase();

/**
 * 2자리 연도를 4자리로 편다. 특허 관리 대상이 20xx년대라 2000을 더한다.
 * 2100년대가 되면 이 기준을 다시 정해야 한다.
 */
const expandYear = (twoDigits: string): number => 2000 + Number(twoDigits);

export const parseInternalRef = (
  value: string | null | undefined,
): InternalRefParts | null => {
  if (!value) return null;
  const match = PATTERN.exec(normalizeInternalRef(value));
  if (!match) return null;

  const [, origin, year, type, serial, country] = match;
  return {
    refOrigin: origin,
    refYear: expandYear(year),
    refType: type,
    refSerial: Number(serial),
    refCountry: country ?? null,
  };
};

/** 빈 구성요소. 원문만 있고 규칙에 맞지 않을 때 쓴다. */
export const EMPTY_REF_PARTS = {
  refOrigin: null,
  refYear: null,
  refType: null,
  refSerial: null,
  refCountry: null,
} as const;

/**
 * 저장 직전에 쓸 값 묶음. `internalRef`가 비면 전부 null,
 * 값이 있으면 원문(정규화)과 파싱 결과를 함께 돌려준다.
 */
export const buildInternalRefColumns = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) return { internalRef: null, ...EMPTY_REF_PARTS };
  const normalized = normalizeInternalRef(trimmed);
  const parts = parseInternalRef(normalized);
  return { internalRef: normalized, ...(parts ?? EMPTY_REF_PARTS) };
};
