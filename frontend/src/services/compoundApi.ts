import { notifyIfAuthRequired } from './authApi';

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

export type CompoundCalculateData = {
  heavy_atom_count: number;
  fsp3: number;
  num_rotatable_bonds: number;
  log_s: number;
  cns_mpo_score: number;
  log_p: number;
  log_d: number;
  molecular_weight: number;
  topological_polar_surface_area: number;
  num_h_bond_donors: number;
  pka: number;
  exact_mass: number;
  chemical_formula: string;
  composition: Record<string, string>;
  num_h_bond_acceptors: number;
  num_h_bond_donors_site: number;
  num_h_bond_acceptors_site: number;
  num_rule_of_5_violations: number;
};

export type GetCompoundCalculateResponse = {
  result: boolean;
  data: CompoundCalculateData;
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
    credentials: 'include',
  });
  notifyIfAuthRequired(response);

  if (!response.ok) {
    throw new CompoundApiError(await getErrorMessage(response), response.status);
  }

  return response.json() as Promise<T>;
};

export const compoundApi = {
  searchCompounds(query: string, options?: RequestOptions) {
    return postJson<CompoundSearchResult[]>('/compound-api/search-compounds', {
      query,
    }, options);
  },

  getCompounds(compounds: string[], options?: RequestOptions) {
    return postJson<GetCompoundsResponse>('/compound-api/get-compounds', {
      compounds,
      type: 'smiles',
    }, options);
  },

  getCompoundSarData(compounds: string[], options?: RequestOptions) {
    return postJson<GetCompoundSarDataResponse>('/compound-api/get-compound-sar-data', {
      compounds,
    }, options);
  },

  getCompoundCalculate(smiles: string, options?: RequestOptions) {
    return postJson<GetCompoundCalculateResponse>('/compound-api/get-compound-calculate', {
      smiles,
    }, options);
  },
};
