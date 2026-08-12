import { AUTH_REQUIRED_EVENT, notifyIfAuthRequired } from './authApi';

type RuntimeWindow = Window & { _env_?: { VITE_API_URL?: string } };

/**
 * 기간 조건을 걸 수 있는 날짜 column.
 * registrationDate는 외부 DB column이 text라 비교가 불가능해 제외되어 있다.
 */
export const PATENT_SEARCH_DATE_FIELDS = [
  'applicationDate',
  'publicationDate',
  'intApplicationDate',
  'intPublicationDate',
  'examDate',
] as const;

export type PatentSearchDateField = (typeof PATENT_SEARCH_DATE_FIELDS)[number];

export const PATENT_SEARCH_DATE_FIELD_LABELS: Record<PatentSearchDateField, string> = {
  applicationDate: '출원일',
  publicationDate: '공개일',
  intApplicationDate: '국제출원일',
  intPublicationDate: '국제공개일',
  examDate: '심사청구일',
};

/** officeAction 의견제출통지서 / opinion 의견서 / amendment 보정서 */
export const PATENT_SEARCH_KEYWORD_TARGETS = [
  'officeAction',
  'opinion',
  'amendment',
] as const;

export type PatentSearchKeywordTarget = (typeof PATENT_SEARCH_KEYWORD_TARGETS)[number];

export const PATENT_SEARCH_KEYWORD_TARGET_LABELS: Record<PatentSearchKeywordTarget, string> = {
  officeAction: '의견제출통지서',
  opinion: '의견서',
  amendment: '보정서',
};

export type PatentSearchKeywordOperator = 'AND' | 'OR' | 'NOT';

export type PatentSearchDateRange = {
  field: PatentSearchDateField;
  /** ISO 8601. `YYYY-MM-DD`로 보내면 된다. */
  from?: string;
  to?: string;
};

export type PatentSearchIpc = {
  section?: string;
  classCode?: string;
  subclass?: string;
  mainGroup?: string;
  subgroup?: string;
};

export type PatentSearchStatute = {
  /** 법종류 명칭("특허법"). lawType과 함께 주면 이쪽이 쓰인다. */
  lawTypeText?: string;
  lawType?: number;
  article?: number;
  paragraph?: number;
  subParagraph?: number;
};

/**
 * 문서 전문 키워드 조건.
 *
 * 항목 하나에 target 하나만 지정한다. 여러 문서를 함께 조건에 넣으려면 항목을 여러 개
 * 보내며, 항목 간에는 AND로 묶인다. (외부 API가 target 2개 이상을 처리하지 못한다.)
 */
export type PatentSearchKeyword = {
  query: string;
  target: PatentSearchKeywordTarget;
  /** 생략하면 AND. */
  operator?: PatentSearchKeywordOperator;
};

export type PatentSearchFilters = {
  /** `legal_status.status` 원문. 예: ['등록', '공개'] */
  legalStatusText?: string[];
  examStatusText?: string[];
  /** 심사청구 여부. */
  examRequested?: boolean;
  attorneyNames?: string[];
  examinerNames?: string[];
  hasOpinion?: boolean;
  hasAmendment?: boolean;
  ipc?: PatentSearchIpc[];
  statutes?: PatentSearchStatute[];
  dateRanges?: PatentSearchDateRange[];
};

export type PatentSearchQuery = {
  page?: number;
  /** 최대 100. OA 본문이 커서 그 이상은 서버가 거부한다. */
  size?: number;
  /** false면 본문을 받지 않고 contentLength만 받는다. 목록 화면에 권장. */
  includeContent?: boolean;
  /**
   * true면 각 결과에 `patent` 상세(출원일자·공개번호·등록번호 등)가 붙는다.
   * 검색 응답에 없는 column이라 서버가 출원번호별로 한 번 더 조회한다.
   */
  includePatentDetail?: boolean;
  filters?: PatentSearchFilters;
  keywords?: PatentSearchKeyword[];
};

export type PatentSearchExaminer = {
  id: number | null;
  office: string | null;
  bureau: string | null;
  department: string | null;
  name: string | null;
};

export type PatentSearchResponseKind = 'OPINION' | 'AMENDMENT';

/** OA에 대해 제출된 의견서/보정서. */
export type PatentSearchSubmission = {
  id: number | null;
  typeCode: number | null;
  kind: PatentSearchResponseKind | null;
  /** includeContent=false면 null. */
  content: string | null;
  contentLength: number;
  documentPath: string | null;
};

export type PatentSearchRejection = {
  rejectionId: number | null;
  claim: string | null;
  lawType: number | null;
  article: number | null;
  paragraph: number | null;
  subParagraph: number | null;
};

/** 검색 응답에 없어 서버가 `includePatentDetail`로 따로 채우는 부분. */
export type PatentSearchPatentDetail = {
  applicationDate: string | null;
  registrationNumber: string | null;
  registrationDate: string | null;
  publicationNumber: string | null;
  publicationDate: string | null;
  intApplicationNumber: string | null;
  intApplicationDate: string | null;
  intPublicationNumber: string | null;
  intPublicationDate: string | null;
  parentApplicationNumber: string | null;
  examDate: string | null;
  countryId: number | null;
  attorneyNumber: number | null;
};

/** 결과 1건은 특허가 아니라 OA(의견제출통지서) 1건이다. */
export type PatentSearchItem = {
  officeActionId: number | null;
  adminId: number | null;
  /** OA 본문. includeContent=false면 null. */
  content: string | null;
  contentLength: number;
  documentPath: string | null;
  actionDate: string | null;
  action: string | null;
  actionNumber: string | null;
  patentId: number | null;
  applicationNumber: string | null;
  koreanTitle: string | null;
  englishTitle: string | null;
  applicant: string | null;
  /** `legal_status.id`. */
  legalStatusId: number | null;
  /** 서버가 외부 코드 테이블 값으로 옮긴 명칭. 모르는 코드면 null. */
  legalStatus: string | null;
  /** `exam_status.id`. 외부 코드 테이블이 비어 있어 명칭으로 옮길 수 없다. */
  examStatusId: number | null;
  exam: boolean | null;
  examiners: PatentSearchExaminer[];
  submissions: PatentSearchSubmission[];
  rejections: PatentSearchRejection[];
  /** `includePatentDetail: true`로 요청했을 때만 채워진다. 조회 실패 시 null. */
  patent: PatentSearchPatentDetail | null;
};

export type PatentSearchResult = {
  total: number;
  page: number;
  size: number;
  items: PatentSearchItem[];
};

const getApiBaseUrl = () => {
  const runtimeValue = typeof window !== 'undefined'
    ? (window as RuntimeWindow)._env_?.VITE_API_URL
    : undefined;
  const value = runtimeValue || import.meta.env.VITE_API_URL || '/api';
  return value.includes('${') ? '/api' : value.replace(/\/$/, '');
};

const url = (path: string) => new URL(
  `${getApiBaseUrl()}${path}`,
  window.location.origin,
).toString();

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url(path), {
    ...options,
    credentials: 'include',
    headers: options?.body
      ? { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
      : options?.headers,
  });
  notifyIfAuthRequired(response);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const rawMessage = (body as { message?: unknown } | null)?.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join(', ')
      : typeof rawMessage === 'string'
        ? rawMessage
        : `PATENT_SEARCH_API_${response.status}`;
    if (response.status === 403) {
      window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
    }
    // 외부 API 원문 오류는 detail에 들어온다. 붙여 두면 원인 파악이 쉬워진다.
    const detail = (body as { detail?: unknown } | null)?.detail;
    throw new Error(
      typeof detail === 'string' && detail.trim()
        ? `${message}: ${detail}`
        : message,
    );
  }
  return body as T;
};

/** 값이 비어 있는 key는 서버 ValidationPipe(forbidNonWhitelisted)에 걸리지 않도록 정리해 보낸다. */
const compact = <T extends object>(source: T): Partial<T> => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    result[key] = value;
  }
  return result as Partial<T>;
};

export const patentSearchApi = {
  /**
   * OA·의견서·보정서 전문 검색.
   * 조건을 아무것도 넘기지 않으면 전체를 최신순으로 조회한다.
   */
  search(query: PatentSearchQuery = {}): Promise<PatentSearchResult> {
    const filters = query.filters ? compact(query.filters) : undefined;
    const body = compact({
      page: query.page,
      size: query.size,
      includeContent: query.includeContent,
      includePatentDetail: query.includePatentDetail,
      filters: filters && Object.keys(filters).length > 0 ? filters : undefined,
      keywords: query.keywords,
    });
    return request<PatentSearchResult>('/patent-search', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};
