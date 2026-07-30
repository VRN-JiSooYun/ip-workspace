export type PatentAnalysisHelperResult<T = unknown> = {
  result_code?: string;
  result?: T;
};

export type PatentAnalysisLegacyResult<T = unknown> = [
  success: boolean,
  completed: boolean,
  result: T,
];

export type PatentAnalysisHelperResponse<T = unknown> =
  | PatentAnalysisHelperResult<T>
  | PatentAnalysisLegacyResult<T>;

export type PatentListResult = {
  partial_rows?: unknown[];
  data?: unknown[];
  total_count?: number | { total?: number | string }[];
  total_rows?: number | unknown[];
  [key: string]: unknown;
};

export type PatentDetailResult = {
  data?: Record<string, unknown>[];
  patent_compound?: unknown[];
  modified_patent_compound?: unknown[];
  tables?: unknown;
  [key: string]: unknown;
};

export type EmbodimentListResult = {
  partial_rows?: unknown[];
  total_rows?: number | unknown[];
  modified_partial_rows?: unknown[];
  modified_total_rows?: number | unknown[];
  [key: string]: unknown;
};

export type CompoundSearchResult = {
  identical?: unknown[];
  substructure?: unknown[];
  similarity?: unknown[];
  pattern?: unknown[];
  bm?: unknown[];
  csk?: unknown[];
  total_count?: number | string | { total?: number | string }[];
  total_rows?: number | string | unknown[];
  [key: string]: unknown;
};

export type PatentAnalysisFormValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export type PatentAnalysisFormPayload = Record<string, PatentAnalysisFormValue>;
