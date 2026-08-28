import type {
  PatentSearchIndexIpc,
  PatentSearchIndexItem,
  PatentSearchRejection,
} from '../../services/patentSearchApi';
import type {
  IpcCondition,
  OfficeActionFilterState,
  StatuteCondition,
} from './OfficeActionAdvancedFilters';

const normalized = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';

const matchesOneText = (actual: string | null | undefined, expected: string[]) => {
  if (!expected.length) return true;
  const candidate = normalized(actual);
  return expected.some((value) => candidate.includes(normalized(value)));
};

const matchesStatute = (actual: PatentSearchRejection, expected: StatuteCondition) => {
  const lawType = expected.lawTypeText === '특허법'
    ? 1
    : expected.lawTypeText === '특허법 시행령' ? 2 : 3;
  return actual.lawType === lawType
    && (expected.article === undefined || actual.article === expected.article)
    && (expected.paragraph === undefined || actual.paragraph === expected.paragraph)
    && (expected.subParagraph === undefined || actual.subParagraph === expected.subParagraph);
};

const matchesIpc = (actual: PatentSearchIndexIpc, expected: IpcCondition) => (
  (!expected.section || normalized(actual.section) === normalized(expected.section))
  && (!expected.classCode || normalized(actual.classCode) === normalized(expected.classCode))
  && (!expected.subclass || normalized(actual.subclass) === normalized(expected.subclass))
  && (!expected.mainGroup || normalized(actual.mainGroup) === normalized(expected.mainGroup))
  && (!expected.subgroup || normalized(actual.subgroup) === normalized(expected.subgroup))
);

const dateValue = (item: PatentSearchIndexItem, field: OfficeActionFilterState['dateField']) => {
  const value = item.patent?.[field];
  return typeof value === 'string' ? value.slice(0, 10) : '';
};

const matchesJoinedConditions = <Expected, Actual>(
  expected: Expected[],
  actual: Actual[],
  operatorOf: (expectedItem: Expected) => 'OR' | 'AND',
  matches: (actualItem: Actual, expectedItem: Expected) => boolean,
) => {
  if (expected.length === 0) return true;
  // 일반적인 Boolean 우선순위: 연속된 AND 묶음을 먼저 계산하고 OR로 묶음들을 합친다.
  let currentAndGroup = actual.some((actualItem) => matches(actualItem, expected[0]));
  let result = false;
  for (const expectedItem of expected.slice(1)) {
    const matched = actual.some((actualItem) => matches(actualItem, expectedItem));
    if (operatorOf(expectedItem) === 'AND') {
      currentAndGroup = currentAndGroup && matched;
    } else {
      result = result || currentAndGroup;
      currentAndGroup = matched;
    }
  }
  return result || currentAndGroup;
};

/** 전체 인덱스 또는 마지막 키워드 검색 기준 목록에 상세 필터를 적용한다. */
export const filterOfficeActionIndex = (
  items: PatentSearchIndexItem[],
  filters: OfficeActionFilterState,
): PatentSearchIndexItem[] => items.filter((item) => {
  const hasOpinion = item.submissions.some((submission) => submission.kind === 'OPINION');
  const hasAmendment = item.submissions.some((submission) => submission.kind === 'AMENDMENT');
  if (filters.hasOpinion !== undefined && hasOpinion !== filters.hasOpinion) return false;
  if (filters.hasAmendment !== undefined && hasAmendment !== filters.hasAmendment) return false;
  if (filters.examRequested !== undefined && item.exam !== filters.examRequested) return false;

  if (
    filters.examinerNames.length
    && !filters.examinerNames.some((name) =>
      item.examiners.some((examiner) => matchesOneText(examiner.name, [name])))
  ) return false;

  if (!matchesOneText(item.filterIndex.attorneyName, filters.attorneyNames)) return false;
  if (
    filters.legalStatusText.length
    && !filters.legalStatusText.includes(item.legalStatus ?? '')
  ) return false;
  if (
    filters.examStatusText.length
    && !filters.examStatusText.includes(item.filterIndex.examStatus ?? '')
  ) return false;

  if (
    filters.statutes.length
    && !matchesJoinedConditions(
      filters.statutes,
      item.rejections,
      (condition) => condition.operator ?? 'OR',
      matchesStatute,
    )
  ) return false;
  if (
    filters.ipc.length
    && !matchesJoinedConditions(
      filters.ipc,
      item.filterIndex.ipcs,
      (condition) => condition.operator ?? 'OR',
      matchesIpc,
    )
  ) return false;

  if (filters.dateFrom || filters.dateTo) {
    const value = dateValue(item, filters.dateField);
    if (!value) return false;
    if (filters.dateFrom && value < filters.dateFrom) return false;
    if (filters.dateTo && value > filters.dateTo) return false;
  }
  return true;
});
