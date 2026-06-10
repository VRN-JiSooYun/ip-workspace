type RuntimeWindow = Window & {
  _env_?: {
    VITE_COMPOUND_SEARCH_API_URL?: string;
  };
};

export type CompoundSearchEngine = 'advanced' | 'fast';
export type CompoundSearchInputType = 'smiles' | 'molblock';
export type CompoundSearchType = 'identical' | 'substructure';
export type CompoundSearchSortOrder = 'asc' | 'desc';

export type CompoundSearchRequest = {
  engine: CompoundSearchEngine;
  input_type: CompoundSearchInputType;
  search_type: CompoundSearchType;
  query: string;
  page: number;
  size: number;
  sort_field?: string | null;
  sort_order?: CompoundSearchSortOrder;
};

export type CompoundSearchSource = {
  compound_source_id?: number | string;
  count?: number | string | null;
  source_link?: string | string[] | null;
  vora_link?: string | string[] | null;
  source_id?: number | string;
  source_name?: string | null;
  source_type?: string | null;
};

export type CompoundSearchItem = {
  id?: number | string;
  compound_id?: number | string;
  canonical_smiles?: string | null;
  molecular_weight?: number | string | null;
  log_p?: number | string | null;
  tpsa?: number | string | null;
  heavy_atom_count?: number | string | null;
  num_h_bond_acceptors?: number | string | null;
  num_h_bond_donors?: number | string | null;
  num_rotatable_bonds?: number | string | null;
  common_name?: string | null;
  cas_number?: string | null;
  synonyms?: string | string[] | null;
  max_phase?: number | string | null;
  source_list?: CompoundSearchSource[] | null;
  sources?: CompoundSearchSource[] | null;
  _id?: string;
  _score?: number;
  [key: string]: unknown;
};

export type CompoundSearchResponse = {
  engine: CompoundSearchEngine;
  input_type: CompoundSearchInputType;
  search_type: CompoundSearchType;
  page: number;
  size: number;
  total_count: number;
  items: CompoundSearchItem[];
};

export type CompoundPatentItem = {
  publication_number?: string | null;
  patent_office?: string | null;
  ocr_pdf_path?: string | null;
  title?: string | null;
  abstract?: string | null;
  applicant?: string | null;
  target?: string | null;
  publication_date?: string | null;
  filling_date?: string | null;
  filling_language?: string | null;
  num_embodiment?: number | string | null;
  key_scaffold_img?: string | null;
  patent_type?: string | null;
  genus_markush_img?: string | null;
  compound_id?: number | string | null;
  fav?: string | null;
  source_type?: string | null;
  [key: string]: unknown;
};

export type CompoundPatentListResponse = {
  canonical_smiles: string;
  total_count: number;
  items: CompoundPatentItem[];
};

export class CompoundSearchApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'CompoundSearchApiError';
    this.status = status;
  }
}

const getCompoundSearchApiBaseUrl = () => {
  const runtimeValue = typeof window !== 'undefined'
    ? (window as RuntimeWindow)._env_?.VITE_COMPOUND_SEARCH_API_URL
    : undefined;
  const value = runtimeValue || import.meta.env.VITE_COMPOUND_SEARCH_API_URL || '/compound-search-api';

  if (value.includes('${')) {
    return '/compound-search-api';
  }
  return value.replace(/\/$/, '');
};

const buildCompoundSearchApiUrl = (path: string) =>
  new URL(`${getCompoundSearchApiBaseUrl()}${path}`, window.location.origin).toString();

const getErrorMessage = async (response: Response) => {
  try {
    const body = await response.json();
    const detail = body?.detail;
    const message = body?.message;
    if (Array.isArray(detail)) return detail.map(item => item?.msg ?? String(item)).join(', ');
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string' && message.trim()) return message;
  } catch {
    // Use HTTP status fallback.
  }
  return `Compound search API request failed: ${response.status}`;
};

export const compoundSearchApi = {
  async search(request: CompoundSearchRequest, signal?: AbortSignal): Promise<CompoundSearchResponse> {
    const response = await fetch(buildCompoundSearchApiUrl('/search'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok) {
      throw new CompoundSearchApiError(await getErrorMessage(response), response.status);
    }

    return response.json() as Promise<CompoundSearchResponse>;
  },

  async getPatents(canonicalSmiles: string, signal?: AbortSignal): Promise<CompoundPatentListResponse> {
    const url = new URL(buildCompoundSearchApiUrl('/patents'));
    url.searchParams.set('canonical_smiles', canonicalSmiles);

    const response = await fetch(url.toString(), { signal });

    if (!response.ok) {
      throw new CompoundSearchApiError(await getErrorMessage(response), response.status);
    }

    return response.json() as Promise<CompoundPatentListResponse>;
  },
};
