import { DEFAULT_API_BASE_PATH } from '../config/basePath';
import { notifyIfAuthRequired } from './authApi';

type RuntimeWindow = Window & { _env_?: { VITE_API_URL?: string } };
const apiBase = () => {
  const runtime = typeof window === 'undefined'
    ? undefined
    : (window as RuntimeWindow)._env_?.VITE_API_URL;
  const value = runtime || import.meta.env.VITE_API_URL || DEFAULT_API_BASE_PATH;
  return value.includes('${') ? DEFAULT_API_BASE_PATH : value.replace(/\/$/, '');
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${apiBase()}${path}`, {
    credentials: 'include',
    ...init,
    headers: init?.body instanceof FormData
      ? init.headers
      : { 'Content-Type': 'application/json', ...init?.headers },
  });
  notifyIfAuthRequired(response);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.code || `API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
};

export interface AdminPatentRow {
  publication_number: string;
  owner_id?: number | null;
  request_member_id?: number | null;
  date_created?: string | null;
  date_updated?: string | null;
  publication_date?: string | null;
  status?: string;
  canonicalStatus:
    | 'REQUESTED'
    | 'ANALYZING'
    | 'BIOACTIVITY_FAILED'
    | 'NO_COMPOUND'
    | 'COMPLETED'
    | 'MODIFIED_COMPLETED'
    | 'ERROR'
    | 'UNKNOWN';
  applicant?: string | null;
  target: string[];
  quality?: number | null;
  request_date?: string | null;
  complete_date?: string | null;
  comment?: string | null;
  requester: { id: string; name: string; email: string; memberId: number } | null;
  requesterUnknown?: boolean;
}

export interface PatentTargetRequest {
  id: string;
  requestedTargetName: string;
  keywords: string[];
  requesterMemberId: number;
  requester: { name: string; email: string };
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ActivePatentTarget {
  target_name?: string;
  keyword?: string[];
  email?: string | null;
  date_created?: string | null;
  date_updated?: string | null;
}

export const patentAnalysisAdminApi = {
  listPatents: (params: Record<string, string | number | boolean | undefined>) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') search.set(key, String(value));
    });
    return request<{ items: AdminPatentRow[]; totalCount: number }>(
      `/admin/patent-analysis/patents?${search}`,
    );
  },
  modifyPatent: (publicationNumber: string, body: Record<string, unknown>) =>
    request(`/admin/patent-analysis/patents/${encodeURIComponent(publicationNumber)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  uploadBioactivity: (publicationNumber: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request(`/admin/patent-analysis/patents/${encodeURIComponent(publicationNumber)}/bioactivity`, {
      method: 'POST',
      body: form,
    });
  },
  listPendingTargets: () =>
    request<PatentTargetRequest[]>('/admin/patent-analysis/targets?status=PENDING'),
  listActiveTargets: () =>
    request<ActivePatentTarget[]>('/admin/patent-analysis/targets?status=ACTIVE'),
  approveTarget: (id: string, body: { targetName: string; keywords: string[] }) =>
    request(`/admin/patent-analysis/targets/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  rejectTarget: (id: string) =>
    request(`/admin/patent-analysis/targets/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  modifyActiveTarget: (originalName: string, body: { targetName: string; keywords: string[] }) =>
    request(`/admin/patent-analysis/targets/active/${encodeURIComponent(originalName)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteActiveTarget: (targetName: string) =>
    request(`/admin/patent-analysis/targets/active/${encodeURIComponent(targetName)}/delete`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};
