type EnvConfig = Record<string, string | undefined>;

const ensureUrl = (name: string, value: string | undefined): void => {
  if (!value) return;
  try {
    new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
};

const ensureHttpUrl = (name: string, value: string | undefined): void => {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
  } catch {
    throw new Error(`${name} must be an HTTP(S) URL`);
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

const ensureOneOf = (
  name: string,
  value: string | undefined,
  expected: readonly string[],
): void => {
  if (value !== undefined && !expected.includes(value)) {
    throw new Error(`${name} must be one of: ${expected.join(', ')}`);
  }
};

const ensureAbsolutePathPrefix = (
  name: string,
  value: string | undefined,
): void => {
  if (value !== undefined && (!value.startsWith('/') || !value.endsWith('/'))) {
    throw new Error(`${name} must start and end with /`);
  }
};

const ensureAbsolutePath = (
  name: string,
  value: string | undefined,
): void => {
  if (value !== undefined && !value.startsWith('/')) {
    throw new Error(`${name} must be an absolute path`);
  }
};

const ensureEmailDomains = (
  name: string,
  value: string | undefined,
): void => {
  if (value === undefined) return;
  const domains = value
    .split(',')
    .map((domain) => domain.trim())
    .filter(Boolean);
  const domainPattern =
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
  if (
    domains.length === 0
    || domains.some((domain) => !domainPattern.test(domain))
  ) {
    throw new Error(`${name} must be a comma-separated list of email domains`);
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
  ensureNumber('CONFERENCE_MEDIA_REQUEST_TIMEOUT_MS', config.CONFERENCE_MEDIA_REQUEST_TIMEOUT_MS);
  ensureNumber('CONFERENCE_MEDIA_PROBE_SAMPLE_LIMIT', config.CONFERENCE_MEDIA_PROBE_SAMPLE_LIMIT);
  ensureNumber('CONFERENCE_IMPORT_POLL_INTERVAL_MS', config.CONFERENCE_IMPORT_POLL_INTERVAL_MS);
  ensureNumber('CONFERENCE_IMPORT_MAX_ISSUES_PER_RUN', config.CONFERENCE_IMPORT_MAX_ISSUES_PER_RUN);
  ensureNumber('CONFERENCE_IMPORT_CHUNK_SIZE', config.CONFERENCE_IMPORT_CHUNK_SIZE);
  ensureNumber('GMAIL_OUTBOX_POLL_INTERVAL_MS', config.GMAIL_OUTBOX_POLL_INTERVAL_MS);
  ensureNumber('GMAIL_OUTBOX_LEASE_DURATION_MS', config.GMAIL_OUTBOX_LEASE_DURATION_MS);
  ensureNumber('GMAIL_OUTBOX_MAX_ATTEMPTS', config.GMAIL_OUTBOX_MAX_ATTEMPTS);
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
  ensureUrl('CONFERENCE_LEGACY_MEDIA_BASE_URL', config.CONFERENCE_LEGACY_MEDIA_BASE_URL);
  ensureUrl('BETTER_AUTH_URL', config.BETTER_AUTH_URL);
  ensureUrl('GROUPWARE_ORIGIN', config.GROUPWARE_ORIGIN);
  ensureUrl('GROUPWARE_LOGIN_CHECK_URL', config.GROUPWARE_LOGIN_CHECK_URL);
  ensureHttpUrl('PUBLIC_APP_BASE_URL', config.PUBLIC_APP_BASE_URL);
  ensureOneOf(
    'CONFERENCE_MEDIA_REDIRECT_MODE',
    config.CONFERENCE_MEDIA_REDIRECT_MODE,
    ['DIRECT', 'GATEWAY'],
  );
  ensureAbsolutePathPrefix(
    'CONFERENCE_LEGACY_MEDIA_PATH_PREFIX',
    config.CONFERENCE_LEGACY_MEDIA_PATH_PREFIX,
  );
  if (
    config.CONFERENCE_IMPORT_ROOT !== undefined
    && !config.CONFERENCE_IMPORT_ROOT.startsWith('/')
  ) {
    throw new Error('CONFERENCE_IMPORT_ROOT must be an absolute path');
  }
  ensureAbsolutePath(
    'NOTIFICATION_RECIPIENT_SOURCE_FILE',
    config.NOTIFICATION_RECIPIENT_SOURCE_FILE,
  );
  ensureAbsolutePath('GMAIL_OAUTH_TOKEN_FILE', config.GMAIL_OAUTH_TOKEN_FILE);
  ensureEmailDomains(
    'GMAIL_ALLOWED_RECIPIENT_DOMAINS',
    config.GMAIL_ALLOWED_RECIPIENT_DOMAINS,
  );
  return config;
};
