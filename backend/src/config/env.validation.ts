type EnvConfig = Record<string, string | undefined>;

const ensureUrl = (name: string, value: string | undefined): void => {
  if (!value) return;
  try {
    new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
};

const ensureNumber = (name: string, value: string | undefined): void => {
  if (!value) return;
  if (!Number.isFinite(Number(value))) {
    throw new Error(`${name} must be a number`);
  }
};

const ensureAbsolutePath = (name: string, value: string | undefined): void => {
  if (value !== undefined && !value.startsWith("/")) {
    throw new Error(`${name} must be an absolute path`);
  }
};

export const validateEnv = (config: EnvConfig): EnvConfig => {
  ensureNumber("PORT", config.PORT);
  ensureNumber("HTTP_TIMEOUT_MS", config.HTTP_TIMEOUT_MS);
  ensureNumber("CONFORMER_API_TIMEOUT_MS", config.CONFORMER_API_TIMEOUT_MS);
  ensureNumber(
    "PATENT_SEARCH_API_TIMEOUT_MS",
    config.PATENT_SEARCH_API_TIMEOUT_MS,
  );
  ensureNumber("OA_DATABASE_PORT", config.OA_DATABASE_PORT);
  ensureNumber(
    "OA_DATABASE_CONNECTION_TIMEOUT_MS",
    config.OA_DATABASE_CONNECTION_TIMEOUT_MS,
  );
  ensureNumber(
    "OA_DATABASE_STATEMENT_TIMEOUT_MS",
    config.OA_DATABASE_STATEMENT_TIMEOUT_MS,
  );
  ensureNumber(
    "OA_DATABASE_LOOKUP_CACHE_TTL_MS",
    config.OA_DATABASE_LOOKUP_CACHE_TTL_MS,
  );
  ensureNumber("COMPOUND_API_TIMEOUT_MS", config.COMPOUND_API_TIMEOUT_MS);
  ensureNumber(
    "GROUPWARE_LOGIN_CHECK_TIMEOUT_MS",
    config.GROUPWARE_LOGIN_CHECK_TIMEOUT_MS,
  );
  ensureNumber(
    "AUTH_SESSION_EXPIRES_IN_SECONDS",
    config.AUTH_SESSION_EXPIRES_IN_SECONDS,
  );
  ensureNumber(
    "AUTH_SESSION_UPDATE_AGE_SECONDS",
    config.AUTH_SESSION_UPDATE_AGE_SECONDS,
  );
  ensureNumber(
    "GROUPWARE_REVALIDATE_INTERVAL_SECONDS",
    config.GROUPWARE_REVALIDATE_INTERVAL_SECONDS,
  );
  ensureUrl(
    "PATENT_ANALYSIS_HELPER_API_URL",
    config.PATENT_ANALYSIS_HELPER_API_URL,
  );
  ensureUrl(
    "PATENT_ANALYSIS_UPLOAD_API_URL",
    config.PATENT_ANALYSIS_UPLOAD_API_URL,
  );
  ensureUrl("PATENT_INSIGHT_API_URL", config.PATENT_INSIGHT_API_URL);
  ensureUrl("PATENT_SEARCH_API_URL", config.PATENT_SEARCH_API_URL);
  // 문서 PDF를 중계하는 프록시 주소. 없으면 상류 주소를 그대로 쓴다.
  ensureUrl("PATENT_DOCUMENT_BASE_URL", config.PATENT_DOCUMENT_BASE_URL);
  ensureUrl("SEAWEEDFS_FILER_URL", config.SEAWEEDFS_FILER_URL);
  ensureUrl("SEAWEEDFS_PUBLIC_URL", config.SEAWEEDFS_PUBLIC_URL);
  ensureUrl("CONFORMER_API_URL", config.CONFORMER_API_URL);
  ensureUrl("COMPOUND_API_URL", config.COMPOUND_API_URL);
  ensureUrl("BETTER_AUTH_URL", config.BETTER_AUTH_URL);
  ensureUrl("GROUPWARE_ORIGIN", config.GROUPWARE_ORIGIN);
  ensureUrl("GROUPWARE_LOGIN_CHECK_URL", config.GROUPWARE_LOGIN_CHECK_URL);
  ensureNumber(
    "GOOGLE_CALENDAR_API_TIMEOUT_MS",
    config.GOOGLE_CALENDAR_API_TIMEOUT_MS,
  );
  ensureNumber("HOLIDAY_CACHE_TTL_MS", config.HOLIDAY_CACHE_TTL_MS);
  ensureAbsolutePath(
    "NOTIFICATION_RECIPIENT_IMPORT_ROOT",
    config.NOTIFICATION_RECIPIENT_IMPORT_ROOT,
  );
  ensureAbsolutePath(
    "GOOGLE_CALENDAR_SA_FILE",
    config.GOOGLE_CALENDAR_SA_FILE,
  );
  return config;
};
