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

export type CompoundSearchResponse = {
  items: Record<string, any>[];
  totalCount: number;
  raw: Record<string, any>;
};

export type CompoundPatentListResponse = {
  compoundId: string;
  items: Record<string, any>[];
  totalCount: number;
  raw: Record<string, any>;
};

type RequestOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

export class ApiRequestError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

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

const buildApiUrl = (path: string, params?: Record<string, string | number | boolean | undefined>) => {
  const url = new URL(`${getApiBaseUrl()}${path}`, window.location.origin);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
};

const getErrorMessage = async (response: Response) => {
  try {
    const body = await response.json();
    const message = body?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string' && message.trim()) return message;
  } catch {
    // Ignore malformed error bodies and use the HTTP status fallback.
  }
  return `API request failed: ${response.status}`;
};

const requestJson = async <T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  options?: RequestOptions,
): Promise<T> => {
  const url = buildApiUrl(path, params);
  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs;
  const timeoutId = timeoutMs
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : undefined;

  const abortOnExternalSignal = () => controller.abort();
  if (options?.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', abortOnExternalSignal, { once: true });
    }
  }

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new ApiRequestError(await getErrorMessage(response), response.status);
    }
    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiRequestError('API request timed out');
    }
    throw error;
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
    options?.signal?.removeEventListener('abort', abortOnExternalSignal);
  }
};

const requestJsonBody = async <T>(
  path: string,
  method: 'POST',
  body?: Record<string, unknown>,
  options?: RequestOptions,
): Promise<T> => {
  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs;
  const timeoutId = timeoutMs
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : undefined;

  const abortOnExternalSignal = () => controller.abort();
  if (options?.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', abortOnExternalSignal, { once: true });
    }
  }

  try {
    const response = await fetch(buildApiUrl(path), {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ApiRequestError(await getErrorMessage(response), response.status);
    }
    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiRequestError('API request timed out');
    }
    throw error;
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
    options?.signal?.removeEventListener('abort', abortOnExternalSignal);
  }
};

const normalizePatentNumber = (value: unknown, fallback: string) => {
  const raw = String(value ?? fallback);
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
};

const getPublicationNumber = (row: Record<string, any>, fallback: string) => {
  const rawPublicationNumber = row.publication_number ?? row.publicationNumber ?? row.patent_number;
  const patentOfficeCode = row.patent_office_code ?? row.office_code;
  const kindCode = row.kind_code ?? row.kindCode;

  if (rawPublicationNumber && patentOfficeCode && !String(rawPublicationNumber).startsWith(String(patentOfficeCode))) {
    return normalizePatentNumber(`${patentOfficeCode}${rawPublicationNumber}${kindCode ?? ''}`, fallback);
  }
  return normalizePatentNumber(rawPublicationNumber, fallback);
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

const getFirstNumber = (row: Record<string, any>, keys: string[]): number | null => {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null || value === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const normalizeSvgText = (value: string) => {
  const trimmed = value.trim();
  if (/<svg[\s>]/i.test(trimmed)) return trimmed;

  const dataUrlMatch = trimmed.match(/^data:image\/svg\+xml(?:;charset=[^;,]+)?(;base64)?,(.*)$/i);
  if (!dataUrlMatch) return '';

  try {
    const decoded = dataUrlMatch[1]
      ? window.atob(dataUrlMatch[2])
      : decodeURIComponent(dataUrlMatch[2]);
    return /<svg[\s>]/i.test(decoded) ? decoded : '';
  } catch {
    return '';
  }
};

const getFirstSvgString = (row: Record<string, any>, keys: string[], fallback = '') => {
  for (const key of keys) {
    const value = row[key];
    const candidate = Array.isArray(value) ? value.find(item => typeof item === 'string') : value;
    if (typeof candidate === 'string' && candidate.trim()) {
      const svg = normalizeSvgText(candidate);
      if (svg) return svg;
    }
  }
  return fallback;
};

export const mapPatentListItem = (row: Record<string, any>, index: number): Patent => {
  const publicationNumber = getPublicationNumber(row, `PATENT${index + 1}`);
  const rowId = `${publicationNumber}-${index + 1}`;
  const title = getFirstString(
    row,
    ['title', 'patent_title', 'invention_title', 'name'],
    publicationNumber,
  );
  const target = getFirstString(row, ['target', 'protein_target', 'target_name'], '-');
  const status = getFirstString(row, ['status'], '');

  return {
    id: rowId,
    patentNumber: publicationNumber,
    title,
    applicant: getFirstString(row, ['applicant', 'assignee', 'applicants'], '-'),
    publicationDate: getFirstString(row, ['publication_date', 'publicationDate', 'pub_date'], '-'),
    target,
    status,
    isFavorite: Boolean(row.is_favorite ?? row.favorite ?? false),
    embodimentCount: getFirstNumber(row, [
      'num_embodiment',
      'numEmbodiment',
      'embodiment_count',
      'embodimentCount',
      'example_count',
    ]),
    keyScaffoldSvg: getFirstSvgString(row, [
      'key_scaffold_img',
      'key_scaffold_svg',
      'key_scaffold',
      'scaffold_svg',
      'scaffold_img',
      'parent_scaffold_svg',
    ]),
    aiKeyCompoundSvg: getFirstSvgString(row, [
      'ai_key_compound_img',
      'ai_key_compound_svg',
      'ai_key_compound_structure',
      'key_compound_img',
      'key_compound_svg',
      'compound_svg',
      'ai_key_compound',
    ]),
    analysisDate: getFirstString(row, [
      'date_created',
      'dateCreated',
      'analysis_date',
      'analysisDate',
      'analyzed_at',
      'analyzedAt',
      'updated_at',
      'updatedAt',
      'created_at',
      'createdAt',
    ], ''),
    keyCompoundSmiles: getFirstString(row, ['ai_key_compound', 'key_compound_smiles', 'smiles'], ''),
    abstract: getFirstString(row, ['abstract'], ''),
  };
};

export const patentAnalysisApi = {
  getMyPatents: (params?: {
    page?: number;
    pageSize?: number;
    ownerId?: string;
    filter?: string;
    order?: string;
    title?: string;
    keyword?: string;
    applicant?: string;
    publicationNumber?: string;
    target?: string;
    dateFrom?: string;
    dateTo?: string;
    favoriteOnly?: boolean;
    smiles?: string;
    type?: string;
    sim?: number;
  }) =>
    requestJson<PatentListResponse>('/patents/my', params),
  addPatentFavorite: (
    body: { ownerId?: string; publicationNumber: string },
    options?: RequestOptions,
  ) => requestJsonBody<Record<string, unknown>>('/patents/favorites', 'POST', body, options),
  removePatentFavorite: (
    body: { ownerId?: string; publicationNumber: string },
    options?: RequestOptions,
  ) => requestJsonBody<Record<string, unknown>>('/patents/favorites/remove', 'POST', body, options),
  sharePatentFavorites: (
    body: { ownerId?: string; cc: string },
    options?: RequestOptions,
  ) => requestJsonBody<Record<string, unknown>>('/patents/favorites/share', 'POST', body, options),
  searchCompounds: (params: {
    wasm?: number;
    smiles: string;
    type?: string;
    sim?: number;
    actionType?: string;
    operation?: string;
    page?: number;
    size?: number;
    orderBy?: string;
    rangeField?: string;
    rangeMin?: number;
    rangeMax?: number;
    patentPageSize?: number;
    compoundPageSize?: number;
    ownerId?: string;
  }, options?: RequestOptions) =>
    requestJson<CompoundSearchResponse>('/patents/compound-search', params, options),
  getPatentsByCompoundId: (compoundId: string, options?: RequestOptions) =>
    requestJson<CompoundPatentListResponse>(
      `/patents/compounds/${encodeURIComponent(compoundId)}/patents`,
      undefined,
      options,
    ),
  getPatentDetail: (publicationNumber: string, params?: { ownerId?: string }) =>
    requestJson<PatentDetailResponse>(`/patents/${publicationNumber}`, params),
  getPatentPdfUrl: (publicationNumber: string, params?: { ownerId?: string }) =>
    buildApiUrl(`/patents/${publicationNumber}/pdf`, params),
  getEmbodiments: (
    publicationNumber: string,
    params?: { page?: number; pageSize?: number; ownerId?: string },
  ) => requestJson<EmbodimentListResponse>(`/patents/${publicationNumber}/embodiments`, params),
};
