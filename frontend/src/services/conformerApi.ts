type RuntimeWindow = Window & {
  _env_?: {
    VITE_API_URL?: string;
  };
};

export type ConformerResponse = {
  generation_method?: string;
  energy?: number;
  conformer: string;
  format: 'sdf';
};

export type GenerateConformerRequest = {
  smiles: string;
  generation_methods?: string[];
  max_attempts?: number;
  num_confs?: number;
  optimization_method?: string;
  max_iters?: number;
  return_format?: 'sdf';
  random_seed?: number;
};

export class ConformerApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ConformerApiError';
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

export const conformerApi = {
  async generate3dConformer(request: GenerateConformerRequest, signal?: AbortSignal): Promise<ConformerResponse> {
    const response = await fetch(buildApiUrl('/3d-conformer'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generation_methods: ['ETKDGv3'],
        max_attempts: 1000,
        num_confs: 3,
        optimization_method: 'MMFF94s',
        max_iters: 1000,
        return_format: 'sdf',
        random_seed: 0,
        ...request,
      }),
      signal,
    });

    if (!response.ok) {
      throw new ConformerApiError(await getErrorMessage(response), response.status);
    }

    const data = await response.json() as ConformerResponse;
    if (!data?.conformer || data.format !== 'sdf') {
      throw new ConformerApiError('Invalid conformer response.');
    }

    return data;
  },
};
