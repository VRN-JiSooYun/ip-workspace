export type PatentAnalysisHelperResult<T = unknown> = {
  result_code?: string;
  result?: T;
};

export type PatentListResult = {
  partial_rows?: unknown[];
  total_count?: number;
  total_rows?: number;
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
  total_rows?: number;
  modified_partial_rows?: unknown[];
  modified_total_rows?: number;
  [key: string]: unknown;
};

export type PatentAnalysisFormValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export type PatentAnalysisFormPayload = Record<string, PatentAnalysisFormValue>;
