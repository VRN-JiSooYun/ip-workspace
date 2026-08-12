/**
 * 외부 특허 검색 API(`POST {PATENT_SEARCH_API_URL}/patents/search`)의 wire 형식.
 *
 * 이 파일의 snake_case type들은 외부 서비스 계약을 그대로 옮긴 것이라 수정하면 안 된다.
 * 프론트엔드로 나가는 camelCase 형식은 `PatentSearchService`가 변환한다.
 */

export type UpstreamDateField =
  | "application_date"
  | "registration_date"
  | "publication_date"
  | "int_application_date"
  | "int_publication_date"
  | "exam_date";

export type UpstreamKeywordTarget = "office_action" | "opinion" | "amendment";

export type UpstreamDateRangeFilter = {
  field: UpstreamDateField;
  // Pydantic 모델이 alias로 받으므로 `date_from`이 아니라 `from`/`to`여야 한다.
  from?: string;
  to?: string;
};

export type UpstreamIpcFilter = {
  section?: string;
  class_code?: string;
  subclass?: string;
  main_group?: string;
  subgroup?: string;
};

export type UpstreamStatuteFilter = {
  law_type?: number | string;
  article?: number;
  paragraph?: number;
  sub_paragraph?: number;
};

export type UpstreamKeywordFilter = {
  query: string;
  targets: UpstreamKeywordTarget[];
  operator: "AND" | "OR" | "NOT";
};

export type UpstreamSearchFilters = {
  legal_status_text?: string[];
  exam_status_text?: string[];
  exam_requested?: boolean;
  attorney_names?: string[];
  examiner_names?: string[];
  has_opinion?: boolean;
  has_amendment?: boolean;
  ipc?: UpstreamIpcFilter[];
  statutes?: UpstreamStatuteFilter[];
  date_ranges?: UpstreamDateRangeFilter[];
};

export type UpstreamSearchRequest = {
  page: number;
  size: number;
  filters?: UpstreamSearchFilters;
  keywords?: UpstreamKeywordFilter[];
};

export type UpstreamExaminer = {
  id: number | null;
  office: string | null;
  bureau: string | null;
  department: string | null;
  name: string | null;
};

/** `response` table. `type`은 1=의견서, 2=보정서. */
export type UpstreamResponse = {
  id: number | null;
  type: number | null;
  content: string | null;
  document_path: string | null;
};

/**
 * 외부 응답에서는 `legal_statutes`로 오지만 실제로는 rejection과 join된 행이다
 * (`rejection_id`, `claim`이 rejection의 column).
 */
export type UpstreamLegalStatute = {
  rejection_id: number | null;
  claim: string | null;
  law_type: number | null;
  article: number | null;
  paragraph: number | null;
  sub_paragraph: number | null;
};

/** 결과 1건은 특허가 아니라 OA(의견제출통지서) 1건이다. */
export type UpstreamSearchRow = {
  office_action_id: number | null;
  admin_id: number | null;
  office_action_content: string | null;
  office_action_document_path: string | null;
  admin_id_ref: number | null;
  action_date: string | null;
  action: string | null;
  action_number: string | null;
  patent_id: number | null;
  application_number: string | null;
  korean_title: string | null;
  english_title: string | null;
  applicant: string | null;
  legal_status: number | null;
  exam_status: number | null;
  exam: boolean | null;
  examiners: UpstreamExaminer[] | null;
  responses: UpstreamResponse[] | null;
  legal_statutes: UpstreamLegalStatute[] | null;
};

export type UpstreamSearchResponse = {
  total: number;
  page: number;
  size: number;
  data: UpstreamSearchRow[];
};

/**
 * `GET /patents/?application_number=...`의 `patent` 한 행.
 *
 * 검색 응답에는 출원일자·공개번호·등록번호 같은 column이 빠져 있어 목록 카드를 채우려면
 * 이 endpoint를 따로 불러야 한다. `title_embedding`도 같이 오지만 벡터라 전달하지 않는다.
 */
export type UpstreamPatentDetail = {
  id: number | null;
  country: number | null;
  application_number: string | null;
  application_date: string | null;
  registration_number: string | null;
  registration_date: string | null;
  publication_number: string | null;
  publication_date: string | null;
  int_application_number: string | null;
  int_application_date: string | null;
  int_publication_number: string | null;
  int_publication_date: string | null;
  parent_application_number: string | null;
  exam_date: string | null;
  attorney_number: number | null;
};
