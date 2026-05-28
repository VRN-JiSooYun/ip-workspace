import { Patent } from '../mocks/patents';

type RuntimeWindow = Window & {
  _env_?: {
    VITE_API_URL?: string;
  };
};

export type PatentListResponse = {
  items: Record<string, any>[];
  totalCount: number;
  raw: Record<string, any>;
};

export type PatentDetailResponse = {
  publicationNumber: string;
  metadata: Record<string, any> | null;
  compounds: Record<string, any>[];
  modifiedCompounds: Record<string, any>[];
  tables: unknown;
  raw: Record<string, any>;
};

export type EmbodimentListResponse = {
  items: Record<string, any>[];
  totalCount: number;
  modifiedItems: Record<string, any>[];
  modifiedTotalCount: number;
  raw: Record<string, any>;
};

const getApiBaseUrl = () => {
  const runtimeValue = typeof window !== 'undefined'
    ? (window as RuntimeWindow)._env_?.VITE_API_URL
    : undefined;
  const value = runtimeValue || import.meta.env.VITE_API_URL || '/api';

  if (value.includes('${')) {
    return '/api';
  }
  return value.replace(/\/$/, '');
};

const requestJson = async <T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> => {
  const url = new URL(`${getApiBaseUrl()}${path}`, window.location.origin);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    url.searchParams.set(key, String(value));
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
};

const normalizePatentNumber = (value: unknown, fallback: string) => {
  const raw = String(value ?? fallback);
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
};

const getFirstString = (row: Record<string, any>, keys: string[], fallback = '') => {
  for (const key of keys) {
    const value = row[key];
    if (Array.isArray(value) && value.length > 0) {
      return String(value[0]);
    }
    if (value !== undefined && value !== null && value !== '') {
      return String(value);
    }
  }
  return fallback;
};

const mapStatus = (value: string): Patent['status'] => {
  const normalized = value.toLowerCase();
  if (normalized.includes('analy') || value.includes('분석중')) return 'Analyzing';
  if (normalized.includes('pending') || normalized.includes('wait') || value.includes('대기')) return 'Pending';
  return 'Completed';
};

export const mapPatentListItem = (row: Record<string, any>, index: number): Patent => {
  const publicationNumber = normalizePatentNumber(
    row.publication_number ?? row.publicationNumber ?? row.patent_number,
    `PATENT${index + 1}`,
  );
  const title = getFirstString(
    row,
    ['title', 'patent_title', 'invention_title', 'name'],
    publicationNumber,
  );
  const target = getFirstString(row, ['target', 'protein_target', 'target_name'], '-');
  const status = getFirstString(row, ['status', 'analysis_status'], 'Completed');

  return {
    id: publicationNumber,
    patentNumber: publicationNumber,
    title,
    applicant: getFirstString(row, ['applicant', 'assignee', 'applicants'], '-'),
    publicationDate: getFirstString(row, ['publication_date', 'publicationDate', 'pub_date'], '-'),
    target,
    status: mapStatus(status),
    isFavorite: Boolean(row.is_favorite ?? row.favorite ?? false),
    keyCompoundSmiles: getFirstString(row, ['ai_key_compound', 'key_compound_smiles', 'smiles'], ''),
    abstract: getFirstString(row, ['abstract'], ''),
  };
};

export const patentAnalysisApi = {
  getMyPatents: (params?: { page?: number; pageSize?: number; ownerId?: string }) =>
    requestJson<PatentListResponse>('/patents/my', params),
  getPatentDetail: (publicationNumber: string, params?: { ownerId?: string }) =>
    requestJson<PatentDetailResponse>(`/patents/${publicationNumber}`, params),
  getEmbodiments: (
    publicationNumber: string,
    params?: { page?: number; pageSize?: number; ownerId?: string },
  ) => requestJson<EmbodimentListResponse>(`/patents/${publicationNumber}/embodiments`, params),
};
