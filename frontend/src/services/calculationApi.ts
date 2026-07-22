import { notifyIfAuthRequired } from './authApi';

type RuntimeWindow = Window & { _env_?: { VITE_API_URL?: string } };

export type QuantumJobType = 'PSA' | 'ESOL';
export type QuantumJobStatus = 'SUBMITTING' | 'QUEUED' | 'COMPLETED' | 'FAILED';

export type QuantumCalculationJob = {
  id: string;
  compoundDraftKey: string;
  jobType: QuantumJobType;
  smiles: string;
  status: QuantumJobStatus;
  resultData: { value?: unknown } | null;
  errorMessage: string | null;
  requestedAt: string;
  completedAt: string | null;
};

type QuantumCalculationJobsResponse = { jobs: QuantumCalculationJob[] };

const getApiBaseUrl = () => {
  const runtimeValue = typeof window !== 'undefined'
    ? (window as RuntimeWindow)._env_?.VITE_API_URL
    : undefined;
  const value = runtimeValue || import.meta.env.VITE_API_URL || '/api';
  return value.includes('${') ? '/api' : value.replace(/\/$/, '');
};

const buildApiUrl = (path: string) =>
  new URL(`${getApiBaseUrl()}${path}`, window.location.origin).toString();

const parseError = async (response: Response) => {
  const body = await response.json().catch(() => null);
  const message = body?.message;
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' && message.trim()
    ? message
    : `API request failed: ${response.status}`;
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(buildApiUrl(path), {
    credentials: 'include',
    ...init,
  });
  notifyIfAuthRequired(response);
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<T>;
};

export const calculationApi = {
  createQuantumJobs(input: {
    compoundDraftKey: string;
    smiles: string;
    jobTypes: QuantumJobType[];
  }) {
    return request<QuantumCalculationJobsResponse>('/calculations/3d-psa/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  },

  getQuantumJob(jobId: string) {
    return request<QuantumCalculationJob>(
      `/calculations/3d-psa/jobs/${encodeURIComponent(jobId)}`,
    );
  },
};
