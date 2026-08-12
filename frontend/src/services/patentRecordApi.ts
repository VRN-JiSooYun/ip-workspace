import { AUTH_REQUIRED_EVENT, notifyIfAuthRequired } from './authApi';

type RuntimeWindow = Window & { _env_?: { VITE_API_URL?: string } };

export type PatentCountry = { id: number; country: string };
export type PatentAttorney = { attorneyNumber: number; attorneyName: string | null };
export type PatentLegalStatus = { id: number; status: string };
export type PatentExamStatus = { id: number; status: string };
export type PatentTargetCode = { id: number; target: string };

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
};

export type PatentRecordListQuery = {
  q?: string;
  targets?: string[];
  countryId?: number;
  legalStatusId?: number;
  examStatusId?: number;
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
    | 'refOrigin'
    | 'refYear'
    | 'refType'
    | 'refSerial'
    | 'refCountry'
  >
>;

export type UpdatePatentRecordInput = Partial<CreatePatentRecordInput>;

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
        : `PATENT_RECORD_API_${response.status}`;
    if (response.status === 403) {
      window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
    }
    throw new Error(message);
  }
  return body as T;
};

const toQueryString = (
  query: PatentRecordListQuery | PatentScheduleQuery,
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

  create(input: CreatePatentRecordInput): Promise<PatentRecord> {
    return request<PatentRecord>('/patent-records', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  update(id: number, input: UpdatePatentRecordInput): Promise<PatentRecord> {
    return request<PatentRecord>(`/patent-records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  remove(id: number): Promise<{ id: number }> {
    return request<{ id: number }>(`/patent-records/${id}`, { method: 'DELETE' });
  },
};
