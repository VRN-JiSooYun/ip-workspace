import { readFileSync } from "node:fs";

export type VersionedSecret = { version: number; value: string };

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readSecretSource = (): string => {
  const filePath = process.env.BETTER_AUTH_SECRETS_FILE?.trim();
  if (filePath) return readFileSync(filePath, "utf8").trim();
  return process.env.BETTER_AUTH_SECRETS?.trim() ?? "";
};

// 앞단 nginx가 붙이는 앱 prefix. 서버는 브라우저가 자기를 어떤 주소로 부르는지 모르므로
// GET /api/auth/login이 로그인 뒤 돌려보낼 주소를 만들려면 따로 알아야 한다.
// 프런트의 BASE_PATH(docker-compose)와 같은 값이며, 항상 `/`로 시작하고 끝난다.
// 프런트와 마찬가지로 prefix 없이 서빙하면 `/`다.
const normalizeBasePath = (value: string | undefined): string => {
  const trimmed = (value ?? "").trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}/` : "/";
};

export const authRuntimeConfig = {
  baseUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  appBasePath: normalizeBasePath(process.env.APP_BASE_PATH),
  trustedOrigins: (
    process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "http://localhost:5174"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  groupwareOrigin: process.env.GROUPWARE_ORIGIN ?? "https://voronoi.app",
  groupwareLoginCheckUrl:
    process.env.GROUPWARE_LOGIN_CHECK_URL ??
    "http://172.16.1.32:10050/login_check",
  compoundApiAuthToken: process.env.COMPOUND_API_AUTH_TOKEN?.trim() || "",
  groupwareTimeoutMs: parseNumber(
    process.env.GROUPWARE_LOGIN_CHECK_TIMEOUT_MS,
    10000,
  ),
  sessionExpiresIn: parseNumber(
    process.env.AUTH_SESSION_EXPIRES_IN_SECONDS,
    21600,
  ),
  sessionUpdateAge: parseNumber(
    process.env.AUTH_SESSION_UPDATE_AGE_SECONDS,
    1800,
  ),
  revalidateIntervalSeconds: parseNumber(
    process.env.GROUPWARE_REVALIDATE_INTERVAL_SECONDS,
    600,
  ),
  bootstrapAdminEmails: new Set(
    (process.env.AUTH_BOOTSTRAP_ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  ),
};

export const loadVersionedSecrets = (): VersionedSecret[] => {
  const source = readSecretSource();
  const secrets = source
    .split(",")
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf(":");
      const version = Number(entry.slice(0, separator));
      const value = entry.slice(separator + 1);
      if (
        separator < 1 ||
        !Number.isInteger(version) ||
        version < 1 ||
        value.length < 32
      ) {
        throw new Error(
          "BETTER_AUTH_SECRETS must use version:secret entries with 32+ byte secrets",
        );
      }
      return { version, value };
    });

  if (secrets.length === 0) throw new Error("BETTER_AUTH_SECRETS is required");
  if (new Set(secrets.map(({ version }) => version)).size !== secrets.length) {
    throw new Error("BETTER_AUTH_SECRETS contains duplicate versions");
  }
  return secrets;
};
