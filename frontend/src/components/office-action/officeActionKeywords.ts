import {
  PATENT_SEARCH_KEYWORD_OPERATOR_LABELS,
  PATENT_SEARCH_KEYWORD_TARGET_LABELS,
  type PatentSearchKeyword,
  type PatentSearchKeywordTarget,
  type PatentSearchUsableKeywordOperator,
} from '../../services/patentSearchApi';

/** 검색바에서 조합하는 문서 본문 키워드 조건 한 줄. */
export type OfficeActionKeywordCondition = {
  query: string;
  target: PatentSearchKeywordTarget;
  operator: PatentSearchUsableKeywordOperator;
};

export type OfficeActionKeywordConditionGroups = {
  includeGroups: OfficeActionKeywordCondition[][];
  excludes: OfficeActionKeywordCondition[];
};

/** `AND · 의견서에 "진보성" 포함`. 화면 라벨이자 중복 판정 key다. */
export const officeActionKeywordLabel = (
  condition: OfficeActionKeywordCondition,
): string =>
  `${condition.operator} · ${PATENT_SEARCH_KEYWORD_TARGET_LABELS[condition.target]}에 `
  + `"${condition.query}" `
  + PATENT_SEARCH_KEYWORD_OPERATOR_LABELS[condition.operator];

/** 태그 본문. 결합 연산자는 태그 사이에 별도로 표시한다. */
export const officeActionKeywordDescription = (
  condition: OfficeActionKeywordCondition,
): string =>
  `${PATENT_SEARCH_KEYWORD_TARGET_LABELS[condition.target]}에 `
  + `"${condition.query}" `
  + PATENT_SEARCH_KEYWORD_OPERATOR_LABELS[condition.operator];

const uniqueKeywordConditions = (
  conditions: OfficeActionKeywordCondition[],
): OfficeActionKeywordCondition[] => {
  const seen = new Set<string>();
  return conditions.filter((condition) => {
    const key = officeActionKeywordLabel(condition);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** OR로 이어진 INCLUDE는 같은 그룹, AND는 다음 그룹, NOT은 전역 EXCLUDE다. */
export const groupOfficeActionKeywordConditions = (
  conditions: OfficeActionKeywordCondition[],
): OfficeActionKeywordConditionGroups => {
  const includeGroups: OfficeActionKeywordCondition[][] = [];
  const excludes: OfficeActionKeywordCondition[] = [];

  uniqueKeywordConditions(conditions).forEach((condition) => {
    if (condition.operator === 'NOT') {
      excludes.push(condition);
      return;
    }
    if (condition.operator === 'OR' && includeGroups.length > 0) {
      includeGroups[includeGroups.length - 1].push(condition);
      return;
    }
    includeGroups.push([condition]);
  });

  return { includeGroups, excludes };
};

/**
 * 화면 조건을 matches API keyword 배열로 바꾼다.
 *
 * NOT은 전역 제외라 INCLUDE 뒤로 배치한다. 첫 INCLUDE의 관계는 AND로 정규화하며, 포함 조건
 * 없이 제외 조건만 있으면 서버가 거부하기 전에 빈 배열을 주어 화면에서 안내한다.
 */
export const toPatentSearchKeywords = (
  conditions: OfficeActionKeywordCondition[],
): PatentSearchKeyword[] => {
  const unique = uniqueKeywordConditions(conditions);
  const includes = unique.filter((condition) => condition.operator !== 'NOT');
  if (!includes.length) return [];

  return [
    ...includes.map((condition, index) => ({
      ...condition,
      // 첫 INCLUDE는 앞 조건이 없어 OR가 될 수 없다. 삭제 후 남은 조건도 명시적으로 정규화한다.
      operator: index === 0 ? 'AND' as const : condition.operator,
    })),
    ...unique.filter((condition) => condition.operator === 'NOT'),
  ];
};
