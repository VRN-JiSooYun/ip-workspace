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

const ensureExactValue = (
  name: string,
  value: string | undefined,
  expected: string,
): void => {
  if (value !== undefined && value !== expected) {
    throw new Error(`${name} must be ${expected}`);
  }
};

export const validateEnv = (config: EnvConfig): EnvConfig => {
  ensureNumber('PORT', config.PORT);
  ensureNumber('HTTP_TIMEOUT_MS', config.HTTP_TIMEOUT_MS);
  ensureNumber('CONFORMER_API_TIMEOUT_MS', config.CONFORMER_API_TIMEOUT_MS);
  ensureNumber('COMPOUND_API_TIMEOUT_MS', config.COMPOUND_API_TIMEOUT_MS);
  ensureNumber('THREE_D_PSA_SUBMIT_TIMEOUT_MS', config.THREE_D_PSA_SUBMIT_TIMEOUT_MS);
  ensureNumber('THREE_D_PSA_CALLBACK_MAX_BODY_MB', config.THREE_D_PSA_CALLBACK_MAX_BODY_MB);
  ensureNumber('VPROP_API_TIMEOUT_MS', config.VPROP_API_TIMEOUT_MS);
  ensureNumber('VPROP_MAX_RESPONSE_BYTES', config.VPROP_MAX_RESPONSE_BYTES);
  ensureNumber('GROUPWARE_LOGIN_CHECK_TIMEOUT_MS', config.GROUPWARE_LOGIN_CHECK_TIMEOUT_MS);
  ensureNumber('AUTH_SESSION_EXPIRES_IN_SECONDS', config.AUTH_SESSION_EXPIRES_IN_SECONDS);
  ensureNumber('AUTH_SESSION_UPDATE_AGE_SECONDS', config.AUTH_SESSION_UPDATE_AGE_SECONDS);
  ensureNumber('GROUPWARE_REVALIDATE_INTERVAL_SECONDS', config.GROUPWARE_REVALIDATE_INTERVAL_SECONDS);
  ensureExactValue(
    'THREE_D_PSA_UNIQUE_KEY_PREFIX',
    config.THREE_D_PSA_UNIQUE_KEY_PREFIX,
    'workspace-',
  );
  ensureUrl('PATENT_ANALYSIS_HELPER_API_URL', config.PATENT_ANALYSIS_HELPER_API_URL);
  ensureUrl('PATENT_ANALYSIS_UPLOAD_API_URL', config.PATENT_ANALYSIS_UPLOAD_API_URL);
  ensureUrl('PATENT_INSIGHT_API_URL', config.PATENT_INSIGHT_API_URL);
  ensureUrl('CONFORMER_API_URL', config.CONFORMER_API_URL);
  ensureUrl('COMPOUND_API_URL', config.COMPOUND_API_URL);
  ensureUrl('THREE_D_PSA_API_URL', config.THREE_D_PSA_API_URL);
  ensureUrl('THREE_D_PSA_CALLBACK_URL', config.THREE_D_PSA_CALLBACK_URL);
  ensureUrl('VPROP_API_URL', config.VPROP_API_URL);
  ensureUrl('BETTER_AUTH_URL', config.BETTER_AUTH_URL);
  ensureUrl('GROUPWARE_ORIGIN', config.GROUPWARE_ORIGIN);
  ensureUrl('GROUPWARE_LOGIN_CHECK_URL', config.GROUPWARE_LOGIN_CHECK_URL);
  return config;
};
