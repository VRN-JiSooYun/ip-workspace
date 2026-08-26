export type LegalStatusTagColor = 'blue' | 'red' | 'orange' | 'default' | 'gold';

/**
 * 법적상태 Chip의 공통 색상 규칙.
 *
 * 외부 OA DB와 로컬 특허 DB에는 `소멸 (포기)`, `등록 (File closing)`처럼 설명이 붙은
 * 값도 있으므로 완전 일치가 아닌 핵심어 포함 여부로 분류한다.
 */
export const getLegalStatusTagColor = (
  status: string | null | undefined,
): LegalStatusTagColor => {
  const normalized = status?.trim() ?? '';

  if (normalized.includes('공개')) return 'blue';
  if (normalized.includes('거절')) return 'red';
  if (normalized.includes('등록')) return 'orange';
  if (normalized.includes('취하') || normalized.includes('포기')) return 'default';
  return 'gold';
};
