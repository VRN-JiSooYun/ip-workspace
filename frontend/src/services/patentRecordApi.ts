import { DEFAULT_API_BASE_PATH } from '../config/basePath';
import type { PatentSearchItem } from './patentSearchApi';
import { AUTH_REQUIRED_EVENT, notifyIfAuthRequired } from './authApi';

type RuntimeWindow = Window & { _env_?: { VITE_API_URL?: string } };

export type PatentCountry = { id: number; country: string };
export type PatentAttorney = { attorneyNumber: number; attorneyName: string | null };
export type PatentLegalStatus = { id: number; status: string };
export type PatentExamStatus = { id: number; status: string };
export type PatentTargetCode = { id: number; target: string };
export type PatentApplicantCode = { id: number; applicant: string };
export type PatentInventorCode = { id: number; inventor: string };

export type PatentRecord = {
  id: number;
  countryId: number;
  /** IP팀 내부관리번호 원문. ref* 는 파싱 결과이며 규칙 외 값이면 모두 null이다. */
  internalRef: string | null;
  refOrigin: string | null;
  refYear: number | null;
  refType: string | null;
  refSerial: number | null;
  refCountry: string | null;
  koreanTitle: string | null;
  englishTitle: string | null;
  applicationNumber: string;
  applicationDate: string | null;
  applicant: string | null;
  /** 등록된 발명자 개인들과의 연결. ordinal 순서로 내려온다. */
  inventorLinks: Array<{
    inventorId: number;
    ordinal: number;
    inventor: PatentInventorCode;
  }>;
  attorneyNumber: number | null;
  registrationNumber: string | null;
  registrationDate: string | null;
  publicationNumber: string | null;
  publicationDate: string | null;
  intApplicationNumber: string | null;
  intApplicationDate: string | null;
  intPublicationNumber: string | null;
  intPublicationDate: string | null;
  parentApplicationNumber: string | null;
  legalStatusId: number | null;
  examStatusId: number | null;
  exam: boolean | null;
  examDate: string | null;
  target: string | null;
  country: PatentCountry;
  attorney: PatentAttorney | null;
  legalStatus: PatentLegalStatus | null;
  examStatus: PatentExamStatus | null;
  /** 이 특허에 딸린 문서 건수. 목록 조회에서만 채워진다(단건 조회에는 없다). */
  documentCount?: number;

  /**
   * 상세 모달의 '설명'. WYSIWYG 편집기가 만든 HTML 조각이 들어 있다(옛 행과 CSV
   * 임포트로 들어온 값은 태그 없는 평문일 수 있다 — 그리는 쪽이 둘 다 받아 준다).
   * 여기서만 유일하게 PATCH로 편집할 수 있는 자유 서술 컬럼이고, 옛 '상태 메모'
   * (status_note)도 여기로 합쳐졌다.
   */
  note?: string | null;

  // ---- 읽기 전용 컬럼 ----------------------------------------------------
  // DB에도 있고 응답에도 이미 실려 온다(Prisma가 scalar를 전부 돌려준다). 타입에만
  // 없어서 화면이 못 쓰고 있었다. 갱신 DTO에 없으므로 **편집은 불가**하고,
  // CSV 임포트로만 채워진다.
  expectedExpiryDate?: string | null;
  /** 분할/계속 등 원출원과의 관계. */
  relationType?: string | null;
  licenseAgreement?: string | null;
  rightsChange?: string | null;
  /** 지분약정(지분율 변경) 기존 출원인. */
  shareAgreement?: string | null;
  todoDueDate?: string | null;

  /**
   * 이 행이 만들어진 시각. 감사 로그 마이그레이션(20260826100000) 이전에 만들어진 행은
   * 마이그레이션 시점이 들어 있다 — 실제 등록 시점이 아니다.
   */
  createdAt?: string;
  updatedAt?: string;
};

/** 문서 연결 한 번의 결과. 화면이 이대로 사람 말로 옮긴다. */
export type PatentDocumentLinkResult = {
  /** OA DB에서 이 특허를 찾았는가. */
  matched: boolean;
  /**
   * 못 찾았으면 그 이유.
   * - `NOT_KR_APPLICATION_NUMBER`: 조회를 보내지도 않았다. OA DB는 KR 13자리뿐이다.
   * - `NOT_FOUND_UPSTREAM`: 찾아봤지만 그 출원번호가 상류에 없다.
   * - `NO_DOCUMENTS`: 특허는 있는데 PDF가 붙은 문서가 없다.
   */
  reason?: 'NOT_KR_APPLICATION_NUMBER' | 'NOT_FOUND_UPSTREAM' | 'NO_DOCUMENTS';
  /** 숫자만 남긴 출원번호. 왜 안 맞았는지 사람이 짚어 볼 수 있게 함께 온다. */
  normalizedApplicationNumber: string;
  created: { admins: number; officeActions: number; responses: number };
  /** 이미 있어서 건너뛴 통지서 수. */
  skipped: number;
  patentDocumentLinked: boolean;
  /** 연결 후의 문서 건수. 목록 배지와 같은 기준이다. */
  documentCount: number;
};

export type PatentRecordListResult = {
  items: PatentRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type PatentRecordLookups = {
  countries: PatentCountry[];
  attorneys: PatentAttorney[];
  legalStatuses: PatentLegalStatus[];
  examStatuses: PatentExamStatus[];
  targets: PatentTargetCode[];
  applicants: PatentApplicantCode[];
  inventors: PatentInventorCode[];
};

/**
 * 데이터 품질 조건. 대시보드 품질 카드에서 목록으로 넘어갈 때 쓴다.
 * 백엔드 `patent-quality.ts`의 표와 key가 일치해야 한다(서버가 값을 검증한다).
 */
export const PATENT_QUALITY_FILTERS = [
  'unmappedStatus',
  'refParseFailed',
  'missingApplicationDate',
  'missingExpectedExpiry',
  'noTodo',
] as const;

export type PatentQualityFilter = typeof PATENT_QUALITY_FILTERS[number];

export type PatentRecordListQuery = {
  q?: string;
  targets?: string[];
  countryId?: number;
  countryText?: string;
  legalStatusId?: number;
  legalStatusText?: string;
  examStatusId?: number;
  examStatusText?: string;
  /** 진행 단계 대분류. UNMAPPED_STAGE_GROUP은 단계에 연결되지 않은 건이다. */
  stageGroup?: string;
  /** 세부 진행 단계(patent_stage.code). 대분류보다 좁다. */
  stageCode?: string;
  quality?: PatentQualityFilter;
  sort?: 'applicationDateDesc' | 'applicationDateAsc' | 'applicationNumberAsc' | 'idDesc';
  page?: number;
  pageSize?: number;
};

/**
 * 추가 시 필수는 countryId·applicationNumber 두 개뿐이다.
 * ref* 는 서버가 internalRef를 파싱해 채우는 파생값이라 보내지 않는다.
 * (백엔드 ValidationPipe가 forbidNonWhitelisted라 보내면 400이 된다.)
 */
export type CreatePatentRecordInput = {
  countryId: number;
  applicationNumber: string;
  inventorIds?: number[];
} & Partial<
  Omit<
    PatentRecord,
    | 'id'
    | 'countryId'
    | 'applicationNumber'
    | 'country'
    | 'attorney'
    | 'legalStatus'
    | 'examStatus'
    | 'inventorLinks'
    | 'refOrigin'
    | 'refYear'
    | 'refType'
    | 'refSerial'
    | 'refCountry'
  >
>;

export type UpdatePatentRecordInput = Partial<CreatePatentRecordInput>;

export type PatentNoteImageUpload = {
  fileName: string;
  mimeType: string;
  byteSize: number;
  /** 현재 환경의 API base URL을 적용한, img가 실제 요청할 URL. */
  url: string;
  /** 환경·배포 prefix와 무관하게 note HTML에 저장할 canonical 경로. */
  storageUrl: string;
};

const PATENT_NOTE_IMAGE_ERROR_MESSAGES: Record<string, string> = {
  PATENT_NOTE_IMAGE_FILE_REQUIRED: '업로드할 이미지가 없습니다.',
  PATENT_NOTE_IMAGE_TYPE_NOT_ALLOWED: 'PNG, JPG, GIF, WEBP 이미지만 사용할 수 있습니다.',
  PATENT_NOTE_IMAGE_EMPTY: '빈 이미지 파일은 업로드할 수 없습니다.',
  PATENT_NOTE_IMAGE_TOO_LARGE: '이미지는 파일당 10MB까지 업로드할 수 있습니다.',
  PATENT_NOTE_IMAGE_INVALID_CONTENT: '이미지 파일의 형식이 올바르지 않습니다.',
  SEAWEEDFS_IMAGE_UPLOAD_FAILED: '이미지 저장소에 업로드하지 못했습니다.',
  SEAWEEDFS_IMAGE_UPLOAD_RESULT_INVALID: '이미지 저장 결과를 확인하지 못했습니다.',
};

/** 서버가 문서 주소를 돌릴 때 쓰는 경로. 백엔드 common/document-url과 같아야 한다. */
const DOCUMENT_PROXY_PATH = '/patent-documents';

const getApiBaseUrl = () => {
  const runtimeValue = typeof window !== 'undefined'
    ? (window as RuntimeWindow)._env_?.VITE_API_URL
    : undefined;
  const value = runtimeValue || import.meta.env.VITE_API_URL || DEFAULT_API_BASE_PATH;
  return value.includes('${') ? DEFAULT_API_BASE_PATH : value.replace(/\/$/, '');
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
        : `PATENT_RECORD_API_${response.status}`;
    if (response.status === 403) {
      window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
    }
    throw new Error(message);
  }
  return body as T;
};

const toQueryString = (
  query: PatentRecordListQuery | PatentScheduleQuery | PatentStageQuery,
): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, String(item)));
      continue;
    }
    params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
};

/**
 * 관리 특허의 문서. 의견제출통지서 화면과 같은 뷰어를 쓰므로 항목 모양도 같다
 * (`PatentSearchItem`). 통지서 하나가 항목 하나이고, 의견서·보정서는 그 안의
 * `submissions`로 들어간다.
 */
export type PatentDocumentsResult = {
  patentId: number;
  items: PatentSearchItem[];
};

export type PatentTargetSummary = {
  target: string;
  count: number;
};

export type PatentScheduleEventType =
  | 'APPLICATION'
  | 'REGISTRATION'
  | 'PUBLICATION'
  | 'INT_APPLICATION'
  | 'INT_PUBLICATION'
  | 'EXAM'
  | 'TODO'
  | 'EXPECTED_EXPIRY';

export type PatentScheduleEvent = {
  patentId: number;
  todoId?: number;
  internalRef: string | null;
  applicationNumber: string;
  title: string | null;
  country: string;
  target: string | null;
  type: PatentScheduleEventType;
  label: string;
  date: string;
};

export type PatentTodoItem = {
  todoId: number;
  patentId: number;
  internalRef: string | null;
  applicationNumber: string;
  patentTitle: string | null;
  title: string;
  description: string | null;
  country: string;
  target: string | null;
  dueDate: string;
};

export type PatentTodo = {
  id: number;
  patentId: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatePatentTodoInput = {
  patentId: number;
  title: string;
  description?: string | null;
  dueDate?: string | null;
};

export type UpdatePatentTodoInput = Partial<
  Omit<CreatePatentTodoInput, 'patentId'> & { completed: boolean }
>;

/** 단계에 연결되지 않은 건을 가리키는 예약 값(백엔드 UNMAPPED_STAGE_GROUP과 같다). */
export const UNMAPPED_STAGE_GROUP = 'UNMAPPED';

/**
 * 목록·집계가 공유하는 조회 조건. 백엔드 PatentStageQueryDto와 1:1이다.
 * 여기에 항목을 더하려면 그 DTO에도 같이 넣어야 한다.
 */
export type PatentStageQuery = {
  /** 관리번호·출원번호·명칭·출원인·발명자를 한 번에 훑는 바로가기 검색(OR). */
  q?: string;
  targets?: string[];
  countryId?: number;
  countryText?: string;
  legalStatusId?: number;
  legalStatusText?: string;
  examStatusId?: number;
  examStatusText?: string;
  stageGroup?: string;
  stageCode?: string;
  quality?: PatentQualityFilter;

  // ---- 컬럼별 조건. 목록 표의 각 열에 대응하고 서로 AND로 걸린다. ----
  /** 내부관리번호 부분 일치. */
  internalRef?: string;
  /** 출원번호 부분 일치. */
  applicationNumber?: string;
  /** 명칭 부분 일치. 국문·영문 어느 쪽이든 걸리면 통과한다. */
  title?: string;
  /** 출원인 부분 일치. */
  applicant?: string;
  /** 등록번호 부분 일치. */
  registrationNumber?: string;
  /** 대리인(attorney.attorneyNumber). */
  attorneyNumber?: number;
  /** 출원일 시작(YYYY-MM-DD, 포함). */
  applicationDateFrom?: string;
  /** 출원일 끝(YYYY-MM-DD, 포함). */
  applicationDateTo?: string;
  /** 문서 유무. true면 있는 것, false면 없는 것만. */
  hasDocuments?: boolean;
};

export type PatentStageItem = {
  code: string;
  label: string;
  description: string | null;
  /** 이 단계가 의미를 갖는 국가/제도. null은 공통이다. */
  scope: string | null;
  active: boolean;
  count: number;
};

export type PatentStageGroupItem = {
  code: string;
  label: string;
  ordinal: number;
  count: number;
  stages: PatentStageItem[];
};

export type PatentStageSummary = {
  total: number;
  groups: PatentStageGroupItem[];
  /** 매핑되지 않은 legal_status. 조용히 버리지 않고 함께 보여 준다. */
  unmapped: {
    groupCode: string;
    count: number;
    statuses: { legalStatusId: number | null; status: string | null; count: number }[];
  };
};

export type PatentScheduleResult = {
  year: number;
  month: number;
  events: PatentScheduleEvent[];
  todos: PatentTodoItem[];
  todoTotal: number;
};

export type PatentScheduleQuery = {
  year: number;
  month: number;
  targets?: string[];
};

/**
 * 대시보드 기한 보드 항목.
 *
 * 마감으로 세는 것은 미완료 To-do의 마감일과 특허의 예상 만료일 둘뿐이다. 출원일·공개일·
 * 등록일은 이미 일어난 사실이라 여기 들어오지 않는다(캘린더의 `PatentScheduleEvent`와
 * 다른 점이다).
 */
export type PatentDeadlineType = 'TODO' | 'EXPECTED_EXPIRY';

export type PatentDeadlineItem = {
  patentId: number;
  /** TODO가 아니면 null. */
  todoId: number | null;
  internalRef: string | null;
  applicationNumber: string;
  patentTitle: string | null;
  /** TODO일 때만 채워진다. 무엇 때문의 마감인지. */
  todoTitle: string | null;
  country: string;
  target: string | null;
  type: PatentDeadlineType;
  label: string;
  /** YYYY-MM-DD. 표시 직전에 formatDisplayDate로 바꾼다. */
  date: string;
};

/**
 * 오늘 기준 마감 버킷별 건수. 서로 겹치지 않는다(한 건이 한 버킷에만 들어간다).
 *   overdue  … 오늘보다 이전
 *   today    … 오늘
 *   within7  … 내일부터 7일 뒤까지
 *   within30 … 8일 뒤부터 30일 뒤까지
 */
export type PatentDeadlineCounts = {
  overdue: number;
  today: number;
  within7: number;
  within30: number;
};

export type PatentDeadlineResult = {
  from: string;
  to: string;
  items: PatentDeadlineItem[];
  /** limit으로 잘렸을 때의 전체 건수. items.length와 다르면 화면이 그 사실을 알려야 한다. */
  total: number;
  counts: PatentDeadlineCounts;
};

export type PatentDeadlineQuery = {
  /** YYYY-MM-DD. 포함. */
  from: string;
  /** YYYY-MM-DD. 포함. */
  to: string;
  targets?: string[];
  limit?: number;
};

/** 대시보드 KPI + 데이터 품질 집계. 목록·진행 현황과 같은 필터를 받는다. */
export type PatentSummary = {
  total: number;
  deadlines: PatentDeadlineCounts;
  expiringWithinYear: number;
  /** 등록 결정을 받고 설정등록료 납부를 남긴 건(stageCode = ALLOWANCE). */
  awaitingRegistration: number;
  quality: Record<PatentQualityFilter, number>;
};

/** 관리 특허 변경 이력 한 줄. 백엔드 PatentAuditEntry와 1:1이다. */
export type PatentAuditEntry = {
  id: string;
  eventType:
    | 'PATENT_CREATED'
    | 'PATENT_FIELD_CHANGED'
    | 'PATENT_IMPORTED'
    | 'PATENT_DELETED'
    /** OA DB에서 문서를 찾아 이어 붙였다. */
    | 'PATENT_DOCUMENTS_LINKED';
  /** 바뀐 컬럼. PATENT_FIELD_CHANGED에만 있다. */
  field: string | null;
  /** 화면에 쓸 필드 이름. 서버가 옮겨 준다(코드 표를 프런트가 알 필요 없다). */
  fieldLabel: string | null;
  /** 코드 id가 아니라 사람이 읽는 값이다('출원' → '등록'). */
  beforeValue: string | null;
  afterValue: string | null;
  /** 같은 값을 가진 행들은 한 요청에서 나왔다. 화면이 한 덩이로 그린다. */
  requestId: string | null;
  metadata: unknown;
  createdAt: string;
  actor: { id: string; name: string | null } | null;
};

export type PatentAuditLogResult = {
  items: PatentAuditEntry[];
  /** null이면 더 없다. */
  nextCursor: string | null;
};

export type PatentImportIssue = {
  rowNumber: number | null;
  severity: 'ERROR' | 'WARNING';
  errorCode: string;
  message: string;
  applicationNumber: string | null;
};

export type PatentImportResult = {
  mode: 'DRY_RUN' | 'APPLY';
  duplicateMode: 'SKIP' | 'UPDATE';
  sourceCount: number;
  insertCount: number;
  updateCount: number;
  skipCount: number;
  errorCount: number;
  ignoredHeaders: string[];
  newCodes: {
    countries: string[];
    legalStatuses: string[];
    examStatuses: string[];
    targets: string[];
    applicants: string[];
    inventors: string[];
  };
  issues: PatentImportIssue[];
};

export const patentImportApi = {
  async run(
    file: File,
    mode: 'DRY_RUN' | 'APPLY',
    duplicateMode: 'SKIP' | 'UPDATE',
  ): Promise<PatentImportResult> {
    const form = new FormData();
    form.append('file', file);
    form.append('mode', mode);
    form.append('duplicateMode', duplicateMode);
    // FormData는 Content-Type을 브라우저가 boundary와 함께 정해야 한다.
    const response = await fetch(url('/patent-records/import'), {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    notifyIfAuthRequired(response);
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const rawMessage = (body as { message?: unknown } | null)?.message;
      const message = Array.isArray(rawMessage)
        ? rawMessage.join(', ')
        : typeof rawMessage === 'string'
          ? rawMessage
          : `PATENT_IMPORT_${response.status}`;
      throw new Error(message);
    }
    return body as PatentImportResult;
  },

  templateUrl(): string {
    return url('/patent-records/import/template');
  },
};

/** 특허 코드 테이블. 백엔드의 PATENT_CODE_TYPES와 값이 일치해야 한다. */
export const PATENT_CODE_TYPES = [
  'countries',
  'attorneys',
  'legal-statuses',
  'exam-statuses',
  'targets',
  'applicants',
  'inventors',
] as const;

export type PatentCodeType = (typeof PATENT_CODE_TYPES)[number];

export type PatentCodeItem = {
  id: number;
  value: string;
  /** 이 코드를 참조하는 특허 수. 0보다 크면 삭제할 수 없다. */
  usageCount: number;
};

export type PatentCodeBody = {
  value: string;
  /** attorney는 PK를 직접 지정한다. 생성 시에만 쓴다. */
  id?: number;
};

export const patentCodeApi = {
  list(type: PatentCodeType): Promise<PatentCodeItem[]> {
    return request<PatentCodeItem[]>(`/patent-codes/${type}`);
  },

  create(type: PatentCodeType, body: PatentCodeBody): Promise<PatentCodeItem> {
    return request<PatentCodeItem>(`/patent-codes/${type}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  update(type: PatentCodeType, id: number, body: PatentCodeBody): Promise<PatentCodeItem> {
    return request<PatentCodeItem>(`/patent-codes/${type}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  remove(type: PatentCodeType, id: number): Promise<{ id: number }> {
    return request<{ id: number }>(`/patent-codes/${type}/${id}`, {
      method: 'DELETE',
    });
  },
};

export const patentTodoApi = {
  list(patentId: number): Promise<PatentTodo[]> {
    return request<PatentTodo[]>(`/patent-todos?patentId=${patentId}`);
  },

  create(input: CreatePatentTodoInput): Promise<PatentTodo> {
    return request<PatentTodo>('/patent-todos', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  update(id: number, input: UpdatePatentTodoInput): Promise<PatentTodo> {
    return request<PatentTodo>(`/patent-todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  remove(id: number): Promise<{ id: number }> {
    return request<{ id: number }>(`/patent-todos/${id}`, {
      method: 'DELETE',
    });
  },
};

export const patentRecordApi = {
  list(query: PatentRecordListQuery = {}): Promise<PatentRecordListResult> {
    return request<PatentRecordListResult>(`/patent-records${toQueryString(query)}`);
  },

  async exportCsv(query: PatentRecordListQuery = {}): Promise<Blob> {
    const response = await fetch(
      url(`/patent-records/export${toQueryString(query)}`),
      { credentials: 'include' },
    );
    notifyIfAuthRequired(response);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const rawMessage = (body as { message?: unknown } | null)?.message;
      const message = Array.isArray(rawMessage)
        ? rawMessage.join(', ')
        : typeof rawMessage === 'string'
          ? rawMessage
          : `PATENT_EXPORT_${response.status}`;
      if (response.status === 403) window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
      throw new Error(message);
    }
    return response.blob();
  },

  documents(patentId: number): Promise<PatentDocumentsResult> {
    return request<PatentDocumentsResult>(`/patent-records/${patentId}/documents`);
  },

  lookups(): Promise<PatentRecordLookups> {
    return request<PatentRecordLookups>('/patent-records/lookups');
  },

  targets(): Promise<PatentTargetSummary[]> {
    return request<PatentTargetSummary[]>('/patent-records/targets');
  },

  schedule(query: PatentScheduleQuery): Promise<PatentScheduleResult> {
    return request<PatentScheduleResult>(
      `/patent-records/schedule${toQueryString(query)}`,
    );
  },

  stages(query: PatentStageQuery = {}): Promise<PatentStageSummary> {
    return request<PatentStageSummary>(
      `/patent-records/stages${toQueryString(query)}`,
    );
  },

  /** 기한 보드용 마감 목록. 월 단위인 schedule과 달리 임의 구간을 받는다. */
  deadlines(query: PatentDeadlineQuery): Promise<PatentDeadlineResult> {
    return request<PatentDeadlineResult>(
      `/patent-records/deadlines${toQueryString(query)}`,
    );
  },

  summary(query: PatentStageQuery = {}): Promise<PatentSummary> {
    return request<PatentSummary>(
      `/patent-records/summary${toQueryString(query)}`,
    );
  },

  create(input: CreatePatentRecordInput): Promise<PatentRecord> {
    return request<PatentRecord>('/patent-records', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * 부분 갱신. 바뀐 필드 하나만 담아 보내면 그것만 갱신되고, 감사 로그도 그 필드만 남는다.
   *
   * requestId를 함께 보내면 서버가 그 값으로 로그 행들을 묶는다(한 번에 여러 필드를
   * 보냈을 때 화면이 한 덩이로 그릴 수 있다).
   */
  update(
    id: number,
    input: UpdatePatentRecordInput,
    requestId?: string,
  ): Promise<PatentRecord> {
    return request<PatentRecord>(`/patent-records/${id}`, {
      method: 'PATCH',
      headers: requestId ? { 'x-request-id': requestId } : undefined,
      body: JSON.stringify(input),
    });
  },

  async uploadNoteImage(id: number, file: File): Promise<PatentNoteImageUpload> {
    const form = new FormData();
    form.append('file', file);
    const response = await fetch(url(`/patent-records/${id}/note-images`), {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    notifyIfAuthRequired(response);
    const body = await response.json().catch(() => null) as (
      Omit<PatentNoteImageUpload, 'url' | 'storageUrl'> & { url: string; message?: unknown }
    ) | null;
    if (!response.ok || !body) {
      const rawMessage = body?.message;
      const code = Array.isArray(rawMessage) ? String(rawMessage[0] ?? '') : String(rawMessage ?? '');
      const message = PATENT_NOTE_IMAGE_ERROR_MESSAGES[code] ?? (Array.isArray(rawMessage)
        ? rawMessage.join(', ')
        : typeof rawMessage === 'string'
          ? rawMessage
          : `PATENT_NOTE_IMAGE_UPLOAD_${response.status}`);
      throw new Error(message);
    }
    return {
      ...body,
      // 업로드 요청에 성공한 것과 같은 API base를 써야 조회도 반드시 같은 Backend로 간다.
      url: url(body.url),
      storageUrl: `/api${body.url}`,
    };
  },

  /**
   * 문서 PDF 주소를 브라우저가 쓸 수 있는 절대 주소로.
   *
   * 서버는 중계 경로를 **API 기준 상대 경로**로 준다(`/patent-documents/oa/…`) — 브라우저가
   * 자기를 어떤 주소로 부르는지 서버는 모르기 때문이다(앞단 nginx의 `/ip-workspace/` prefix).
   * 다른 API 호출과 같은 규칙으로 앞을 붙여 완성한다.
   *
   * 중계 대상이 아닌 값(설정이 없어 상류 주소가 그대로 온 경우, 옛 표본 주소)은 그대로 둔다.
   */
  documentDisplayUrl(documentPath: string): string {
    return documentPath.startsWith(DOCUMENT_PROXY_PATH)
      ? url(documentPath)
      : documentPath;
  },

  noteImageDisplayUrl(storedUrl: string): string {
    const marker = '/patent-records/';
    const markerIndex = storedUrl.indexOf(marker);
    if (markerIndex < 0) return storedUrl;
    return url(storedUrl.slice(markerIndex));
  },

  async removeNoteImage(id: number, imageUrl: string): Promise<void> {
    const pathname = new URL(imageUrl, window.location.origin).pathname;
    const fileName = decodeURIComponent(pathname.split('/').filter(Boolean).at(-1) ?? '');
    if (!fileName) return;
    await request<{ fileName: string }>(
      `/patent-records/${id}/note-images/${encodeURIComponent(fileName)}`,
      { method: 'DELETE' },
    );
  },

  /**
   * OA DB에서 이 특허의 문서를 찾아 이어 붙인다.
   *
   * 출원번호(숫자만)로 상류 특허를 찾고 PDF가 붙은 통지서·제출 서류를 우리 쪽에 담는다.
   * 여러 번 눌러도 같은 문서는 다시 만들지 않는다(created가 0으로 온다).
   */
  linkDocuments(id: number): Promise<PatentDocumentLinkResult> {
    return request<PatentDocumentLinkResult>(
      `/patent-records/${id}/documents/link`,
      { method: 'POST' },
    );
  },

  /** 이 특허의 활동 피드(변경 이력). 최신순. */
  auditLogs(
    id: number,
    query: { limit?: number; cursor?: string } = {},
  ): Promise<PatentAuditLogResult> {
    return request<PatentAuditLogResult>(
      `/patent-records/${id}/audit-logs${toQueryString(query as PatentStageQuery)}`,
    );
  },

  remove(id: number): Promise<{ id: number }> {
    return request<{ id: number }>(`/patent-records/${id}`, { method: 'DELETE' });
  },
};
