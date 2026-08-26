/**
 * 특허 관리 화면이 URL query로 받는 초기 필터.
 *
 * 대시보드 위젯이 "이 조건으로 목록 보기"를 걸 때 쓰는 계약이다. 받는 파라미터는
 * 백엔드 `PatentStageQueryDto`에 **이미 있는 것만**으로 제한한다. 화면이 URL로만 걸 수
 * 있고 UI로는 못 거는 조건이 생기면, 사용자는 그 조건을 지울 방법을 못 찾는다.
 *
 * 모르는 값·형식이 깨진 값은 조용히 버린다: 못 읽는 입력으로 화면을 못 쓰게 만들지 않는다.
 */

import type { PatentListFilterValues } from '../components/patent-management/PatentListFilters';
import {
  PATENT_QUALITY_FILTERS,
  type PatentQualityFilter,
} from '../services/patentRecordApi';

export type PatentListQuerySeed = {
  q?: string;
  targets?: string[];
  stageGroup?: string;
  filters: PatentListFilterValues;
};

/** 양의 정수만 받는다. `0`·음수·`abc`는 필터로 의미가 없어 버린다. */
const toPositiveInt = (value: string | null): number | undefined => {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

/** 컬럼별 부분 일치 조건의 key. 값이 전부 string이라 한 번에 훑는다. */
const TEXT_FILTER_KEYS = [
  'internalRef',
  'applicationNumber',
  'title',
  'applicant',
  'registrationNumber',
] as const satisfies readonly (keyof PatentListFilterValues)[];

/** YYYY-MM-DD만 받는다. 실제로 존재하는 날짜인지도 본다(2026-02-31은 버린다). */
const toDateKey = (value: string | null): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10) === trimmed ? trimmed : undefined;
};

const isQualityFilter = (value: string): value is PatentQualityFilter => (
  (PATENT_QUALITY_FILTERS as readonly string[]).includes(value)
);

export const readPatentListQueryParams = (
  params: URLSearchParams,
): PatentListQuerySeed => {
  const filters: PatentListFilterValues = {};

  const countryId = toPositiveInt(params.get('countryId'));
  if (countryId !== undefined) filters.countryId = countryId;

  const legalStatusId = toPositiveInt(params.get('legalStatusId'));
  if (legalStatusId !== undefined) filters.legalStatusId = legalStatusId;

  const examStatusId = toPositiveInt(params.get('examStatusId'));
  if (examStatusId !== undefined) filters.examStatusId = examStatusId;

  const stageCode = params.get('stageCode')?.trim();
  if (stageCode) filters.stageCode = stageCode;

  const attorneyNumber = toPositiveInt(params.get('attorneyNumber'));
  if (attorneyNumber !== undefined) filters.attorneyNumber = attorneyNumber;

  // 컬럼별 부분 일치 조건. 상세 검색의 입력과 같은 값이다.
  for (const key of TEXT_FILTER_KEYS) {
    const value = params.get(key)?.trim();
    if (value) filters[key] = value;
  }

  // 출원일 기간. 날짜 형식이 아니면 버린다(잘못된 날짜로 0건을 보여 주는 것보다 낫다).
  const applicationDateFrom = toDateKey(params.get('applicationDateFrom'));
  if (applicationDateFrom) filters.applicationDateFrom = applicationDateFrom;
  const applicationDateTo = toDateKey(params.get('applicationDateTo'));
  if (applicationDateTo) filters.applicationDateTo = applicationDateTo;

  // 문서 유무는 3-상태다. 'true'/'false' 둘만 받고 나머지는 조건 없음으로 둔다.
  const hasDocuments = params.get('hasDocuments');
  if (hasDocuments === 'true') filters.hasDocuments = true;
  else if (hasDocuments === 'false') filters.hasDocuments = false;

  const quality = params.get('quality')?.trim();
  if (quality && isQualityFilter(quality)) filters.quality = quality;

  const q = params.get('q')?.trim();
  const stageGroup = params.get('stageGroup')?.trim();
  const targets = params
    .getAll('targets')
    .map((target) => target.trim())
    .filter((target) => target.length > 0);

  return {
    ...(q ? { q } : {}),
    ...(targets.length > 0 ? { targets } : {}),
    ...(stageGroup ? { stageGroup } : {}),
    filters,
  };
};

/**
 * 위 파서가 읽는 것과 같은 모양을 URL query로 되돌린다. 대시보드가 딥링크를 만들 때 쓴다.
 * 두 함수가 한 파일에 있어야 한쪽만 바뀌는 일이 없다.
 */
export const buildPatentListQuery = (seed: {
  q?: string;
  targets?: string[];
  stageGroup?: string;
  stageCode?: string;
  countryId?: number;
  legalStatusId?: number;
  examStatusId?: number;
  attorneyNumber?: number;
  internalRef?: string;
  applicationNumber?: string;
  title?: string;
  applicant?: string;
  registrationNumber?: string;
  applicationDateFrom?: string;
  applicationDateTo?: string;
  hasDocuments?: boolean;
  quality?: PatentQualityFilter;
}): string => {
  const params = new URLSearchParams();
  if (seed.q) params.set('q', seed.q);
  seed.targets?.forEach((target) => params.append('targets', target));
  if (seed.stageGroup) params.set('stageGroup', seed.stageGroup);
  if (seed.stageCode) params.set('stageCode', seed.stageCode);
  if (seed.countryId !== undefined) params.set('countryId', String(seed.countryId));
  if (seed.legalStatusId !== undefined) {
    params.set('legalStatusId', String(seed.legalStatusId));
  }
  if (seed.examStatusId !== undefined) {
    params.set('examStatusId', String(seed.examStatusId));
  }
  if (seed.attorneyNumber !== undefined) {
    params.set('attorneyNumber', String(seed.attorneyNumber));
  }
  TEXT_FILTER_KEYS.forEach((key) => {
    const value = seed[key];
    if (value) params.set(key, value);
  });
  if (seed.applicationDateFrom) params.set('applicationDateFrom', seed.applicationDateFrom);
  if (seed.applicationDateTo) params.set('applicationDateTo', seed.applicationDateTo);
  if (seed.hasDocuments !== undefined) {
    params.set('hasDocuments', String(seed.hasDocuments));
  }
  if (seed.quality) params.set('quality', seed.quality);

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
};
