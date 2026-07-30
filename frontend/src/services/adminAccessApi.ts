import { AUTH_REQUIRED_EVENT, notifyIfAuthRequired } from './authApi';

type RuntimeWindow = Window & { _env_?: { VITE_API_URL?: string } };

export type AdminUserRole = 'USER' | 'ADMIN';
export type WorkspaceAdminRole =
  | 'SUPER_ADMIN'
  | 'CONFERENCE_ADMIN'
  | 'PATENT_ANALYSIS_ADMIN';
export type AdminUserStatus = 'ACTIVE' | 'INACTIVE';

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  team: string | null;
  fullname: string | null;
  role: AdminUserRole;
  adminRoles: WorkspaceAdminRole[];
  status: AdminUserStatus;
  createdAt: string;
  updatedAt: string;
};

export type UpdateAdminUserAccess = {
  adminRoles: WorkspaceAdminRole[];
  status: AdminUserStatus;
  reason: string;
};

export type WorkspaceModuleCode =
  | 'CONFERENCE'
  | 'PATENT_ANALYSIS'
  | 'SAR_TABLE'
  | 'DESIGN'
  | 'SYNTHESIS';

export type TeamModuleAccess = {
  canRead: boolean;
  canWrite: boolean;
  canManage: boolean;
};

export type TeamAccessItem = {
  id: string;
  name: string;
  memberCount: number;
  modules: Record<WorkspaceModuleCode, TeamModuleAccess>;
};

export type TeamAccessList = {
  organization: { id: string; name: string } | null;
  teams: TeamAccessItem[];
};

export class AdminAccessApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminAccessApiError';
    this.status = status;
  }
}

const getApiBaseUrl = () => {
  const runtimeValue = typeof window !== 'undefined'
    ? (window as RuntimeWindow)._env_?.VITE_API_URL
    : undefined;
  const value = runtimeValue || import.meta.env.VITE_API_URL || '/api';
  return value.includes('${') ? '/api' : value.replace(/\/$/, '');
};

const buildApiUrl = (path: string) =>
  new URL(`${getApiBaseUrl()}${path}`, window.location.origin).toString();

const parseResponse = async <T>(response: Response): Promise<T> => {
  notifyIfAuthRequired(response);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof body?.message === 'string'
      ? body.message
      : `ADMIN_API_${response.status}`;
    if (response.status === 403 && message === 'FRESH_SESSION_REQUIRED') {
      window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
    }
    throw new AdminAccessApiError(message, response.status);
  }
  return body as T;
};

export const adminAccessApi = {
  async listUsers(): Promise<AdminUser[]> {
    const response = await fetch(buildApiUrl('/admin/users'), {
      credentials: 'include',
    });
    return parseResponse<AdminUser[]>(response);
  },

  async updateUserAccess(
    userId: string,
    data: UpdateAdminUserAccess,
  ): Promise<AdminUser> {
    const response = await fetch(buildApiUrl(`/admin/users/${encodeURIComponent(userId)}/access`), {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return parseResponse<AdminUser>(response);
  },

  async listTeamAccess(): Promise<TeamAccessList> {
    const response = await fetch(buildApiUrl('/admin/access/teams'), {
      credentials: 'include',
    });
    return parseResponse<TeamAccessList>(response);
  },

  async reconcileTeamAccess(): Promise<TeamAccessList> {
    const response = await fetch(buildApiUrl('/admin/access/teams/reconcile'), {
      method: 'POST',
      credentials: 'include',
    });
    return parseResponse<TeamAccessList>(response);
  },

  async updateTeamModules(
    teamId: string,
    modules: Record<WorkspaceModuleCode, TeamModuleAccess>,
  ): Promise<Pick<TeamAccessItem, 'id' | 'name' | 'modules'>> {
    const response = await fetch(
      buildApiUrl(`/admin/access/teams/${encodeURIComponent(teamId)}/modules`),
      {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules }),
      },
    );
    return parseResponse<Pick<TeamAccessItem, 'id' | 'name' | 'modules'>>(response);
  },
};
