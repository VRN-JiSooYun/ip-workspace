import { authRuntimeConfig } from './auth-config';

type LoginCheckResponse = { loginCheck?: unknown; id?: unknown };

export type GroupwareLoginCheckResult =
  | { loginCheck: false }
  | { loginCheck: true; email: string };

export const checkGroupwareToken = async (
  loginToken: string,
): Promise<GroupwareLoginCheckResult> => {
  const response = await fetch(authRuntimeConfig.groupwareLoginCheckUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authRuntimeConfig.compoundApiAuthToken
        ? { Authorization: `Bearer ${authRuntimeConfig.compoundApiAuthToken}` }
        : {}),
    },
    body: JSON.stringify({ login_token: loginToken }),
    signal: AbortSignal.timeout(authRuntimeConfig.groupwareTimeoutMs),
  });
  if (!response.ok) throw new Error(`GROUPWARE_LOGIN_CHECK_${response.status}`);

  const result = (await response.json()) as LoginCheckResponse;
  if (result.loginCheck === false) return { loginCheck: false };
  if (result.loginCheck !== true) {
    throw new Error('GROUPWARE_LOGIN_CHECK_INVALID_RESPONSE');
  }
  if (typeof result.id !== 'string' || !result.id.trim()) {
    throw new Error('GROUPWARE_ID_INVALID');
  }

  const email = result.id.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('GROUPWARE_ID_INVALID');
  }
  return { loginCheck: true, email };
};

export const validateGroupwareToken = async (loginToken: string): Promise<string> => {
  const result = await checkGroupwareToken(loginToken);
  if (!result.loginCheck) throw new Error('GROUPWARE_LOGIN_INVALID');
  return result.email;
};
