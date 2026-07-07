type RuntimeWindow = Window & {
  _env_?: {
    VITE_API_URL?: string;
  };
};

export type CompoundSearchResult = {
  compound_code: string;
};

export type CompoundPermissionResult = {
  compound_code: string;
  smiles: string;
};

export type GetCompoundsResponse = {
  compounds: CompoundPermissionResult[];
};

export type CompoundSarDataRow = Record<string, string | number | null>;

export type GroupedCompoundSarData = {
  compound_code: string;
  rows: CompoundSarDataRow[];
};

export type GetCompoundSarDataResponse = {
  rows: CompoundSarDataRow[];
  groups: GroupedCompoundSarData[];
};

type RequestOptions = {
  signal?: AbortSignal;
};

export class CompoundApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'CompoundApiError';
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

const buildApiUrl = (path: string) =>
  new URL(`${getApiBaseUrl()}${path}`, window.location.origin).toString();

const getErrorMessage = async (response: Response) => {
  try {
    const body = await response.json();
    const message = body?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string' && message.trim()) return message;
  } catch {
    // Use the status fallback below.
  }

  return `API request failed: ${response.status}`;
};

const postJson = async <T>(
  path: string,
  body: Record<string, unknown>,
  options?: RequestOptions,
): Promise<T> => {
  const response = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new CompoundApiError(await getErrorMessage(response), response.status);
  }

  return response.json() as Promise<T>;
};

export const compoundApi = {
  searchCompounds(loginToken: string, query: string, options?: RequestOptions) {
    return postJson<CompoundSearchResult[]>('/compound-api/search-compounds', {
      login_token: loginToken,
      query,
    }, options);
  },

  getCompounds(loginToken: string, compounds: string[], options?: RequestOptions) {
    return postJson<GetCompoundsResponse>('/compound-api/get-compounds', {
      login_token: loginToken,
      compounds,
      type: 'smiles',
    }, options);
  },

  getCompoundSarData(loginToken: string, compounds: string[], options?: RequestOptions) {
    return postJson<GetCompoundSarDataResponse>('/compound-api/get-compound-sar-data', {
      login_token: loginToken,
      compounds,
    }, options);
  },
};
