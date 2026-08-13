import { DEFAULT_API_BASE_PATH } from '../config/basePath';
type RuntimeWindow = Window & { _env_?: { VITE_API_URL?: string } };

export type AuthSession = {
  user: {
    id: string;
    email: string;
    name: string;
    team?: string | null;
    fullname?: string | null;
    role?: string;
    status?: string;
  };
  session: { id: string; expiresAt: string };
};

export const AUTH_REQUIRED_EVENT = 'ip:auth-required';

export const notifyIfAuthRequired = (response: Response): void => {
  if (response.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
  }
};

const getApiBaseUrl = () => {
  const runtimeValue = typeof window !== 'undefined'
    ? (window as RuntimeWindow)._env_?.VITE_API_URL
    : undefined;
  const value = runtimeValue || import.meta.env.VITE_API_URL || DEFAULT_API_BASE_PATH;
  return value.includes('${') ? DEFAULT_API_BASE_PATH : value.replace(/\/$/, '');
};

const authUrl = (path: string) =>
  new URL(`${getApiBaseUrl()}/auth${path}`, window.location.origin).toString();

let sessionRequest: Promise<AuthSession | null> | null = null;

export const authApi = {
  async getSession(): Promise<AuthSession | null> {
    if (!sessionRequest) {
      sessionRequest = fetch(authUrl('/groupware/session'), { credentials: 'include' })
        .then(async (response) => {
          if (response.status === 401 || response.status === 403) return null;
          if (!response.ok) throw new Error(`SESSION_CHECK_${response.status}`);
          return response.json() as Promise<AuthSession | null>;
        })
        .finally(() => {
          sessionRequest = null;
        });
    }
    return sessionRequest;
  },

  async exchange(loginToken: string, expectedEmail?: string): Promise<AuthSession> {
    const response = await fetch(authUrl('/groupware/exchange'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginToken, ...(expectedEmail ? { expectedEmail } : {}) }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (body?.code === 'AUTH_EMAIL_CONFLICT' && typeof body?.message === 'string') {
        throw new Error(`AUTH_EMAIL_CONFLICT (requestId: ${body.message})`);
      }
      throw new Error(body?.code || body?.message || `AUTH_EXCHANGE_${response.status}`);
    }
    return response.json() as Promise<AuthSession>;
  },
};
