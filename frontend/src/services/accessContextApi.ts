import { notifyIfAuthRequired } from './authApi';

type RuntimeWindow = Window & { _env_?: { VITE_API_URL?: string } };

export type WorkspacePermission =
  | 'userAccess.manage'
  | 'conference.read'
  | 'conference.manage'
  | 'conference.comment.moderate'
  | 'patentAnalysis.read'
  | 'patentAnalysis.manage'
  | 'sarTable.read'
  | 'sarTable.write'
  | 'sarTable.manage'
  | 'design.read'
  | 'design.write'
  | 'design.manage'
  | 'synthesis.read'
  | 'synthesis.write'
  | 'synthesis.manage';

type ModuleCapability = {
  read: boolean;
  write: boolean;
  manage: boolean;
};

export type WorkspaceAccessContext = {
  userId: string;
  globalRoles: string[];
  organization: { id: string; name: string } | null;
  teams: Array<{ id: string; name: string }>;
  permissions: WorkspacePermission[];
  modules: {
    conference: ModuleCapability;
    patentAnalysis: ModuleCapability;
    sarTable: ModuleCapability;
    design: ModuleCapability;
    synthesis: ModuleCapability;
  };
};

const getApiBaseUrl = () => {
  const runtimeValue = typeof window !== 'undefined'
    ? (window as RuntimeWindow)._env_?.VITE_API_URL
    : undefined;
  const value = runtimeValue || import.meta.env.VITE_API_URL || '/api';
  return value.includes('${') ? '/api' : value.replace(/\/$/, '');
};

export const accessContextApi = {
  async get(): Promise<WorkspaceAccessContext> {
    const response = await fetch(
      new URL(`${getApiBaseUrl()}/access-context`, window.location.origin).toString(),
      { credentials: 'include' },
    );
    notifyIfAuthRequired(response);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(
        typeof body?.message === 'string'
          ? body.message
          : `ACCESS_CONTEXT_${response.status}`,
      );
    }
    return response.json() as Promise<WorkspaceAccessContext>;
  },
};
