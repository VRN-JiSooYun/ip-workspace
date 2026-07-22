import { readFileSync } from 'node:fs';

export type VersionedSecret = { version: number; value: string };

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readSecretSource = (): string => {
  const filePath = process.env.BETTER_AUTH_SECRETS_FILE?.trim();
  if (filePath) return readFileSync(filePath, 'utf8').trim();
  return process.env.BETTER_AUTH_SECRETS?.trim() ?? '';
};

export const authRuntimeConfig = {
  baseUrl: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  trustedOrigins: (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? 'http://localhost:5174')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  groupwareOrigin: process.env.GROUPWARE_ORIGIN ?? 'https://voronoi.app',
  groupwareLoginCheckUrl:
    process.env.GROUPWARE_LOGIN_CHECK_URL ?? 'http://172.16.1.32:10050/login_check',
  compoundApiAuthToken: process.env.COMPOUND_API_AUTH_TOKEN?.trim() || '',
  groupwareTimeoutMs: parseNumber(process.env.GROUPWARE_LOGIN_CHECK_TIMEOUT_MS, 10000),
  sessionExpiresIn: parseNumber(process.env.AUTH_SESSION_EXPIRES_IN_SECONDS, 21600),
  sessionUpdateAge: parseNumber(process.env.AUTH_SESSION_UPDATE_AGE_SECONDS, 1800),
  revalidateIntervalSeconds: parseNumber(
    process.env.GROUPWARE_REVALIDATE_INTERVAL_SECONDS,
    600,
  ),
  bootstrapAdminEmails: new Set(
    (process.env.AUTH_BOOTSTRAP_ADMIN_EMAILS ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  ),
};

export const loadVersionedSecrets = (): VersionedSecret[] => {
  const source = readSecretSource();
  const secrets = source.split(',').filter(Boolean).map((entry) => {
    const separator = entry.indexOf(':');
    const version = Number(entry.slice(0, separator));
    const value = entry.slice(separator + 1);
    if (separator < 1 || !Number.isInteger(version) || version < 1 || value.length < 32) {
      throw new Error('BETTER_AUTH_SECRETS must use version:secret entries with 32+ byte secrets');
    }
    return { version, value };
  });

  if (secrets.length === 0) throw new Error('BETTER_AUTH_SECRETS is required');
  if (new Set(secrets.map(({ version }) => version)).size !== secrets.length) {
    throw new Error('BETTER_AUTH_SECRETS contains duplicate versions');
  }
  return secrets;
};
