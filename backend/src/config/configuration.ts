const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseCsv = (value: string | undefined): string[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

export default () => ({
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseNumber(process.env.PORT, 3000),
  corsOrigins: parseCsv(process.env.CORS_ORIGINS),
  patentAnalysis: {
    helperApiUrl:
      process.env.PATENT_ANALYSIS_HELPER_API_URL ?? "http://172.16.1.210:10130",
    uploadApiUrl:
      process.env.PATENT_ANALYSIS_UPLOAD_API_URL ?? "http://172.16.1.210:8000",
    insightApiUrl:
      process.env.PATENT_INSIGHT_API_URL ?? "http://172.16.1.210:8000",
    ownerId: process.env.PATENT_ANALYSIS_OWNER_ID ?? "171",
    compoundSearchPatentLookupLimit: parseNumber(
      process.env.PATENT_ANALYSIS_COMPOUND_SEARCH_PATENT_LOOKUP_LIMIT,
      20,
    ),
  },
  conformer: {
    apiUrl: process.env.CONFORMER_API_URL ?? "http://172.16.1.203:8000",
    timeoutMs: parseNumber(process.env.CONFORMER_API_TIMEOUT_MS, 120000),
  },
  compoundApi: {
    apiUrl: process.env.COMPOUND_API_URL ?? "http://172.16.1.32:10050",
    authToken: process.env.COMPOUND_API_AUTH_TOKEN ?? "",
    timeoutMs: parseNumber(process.env.COMPOUND_API_TIMEOUT_MS, 30000),
  },
  conferenceMedia: {
    legacyBaseUrl:
      process.env.CONFERENCE_LEGACY_MEDIA_BASE_URL ?? "https://voronoi.app",
    legacyPathPrefix:
      process.env.CONFERENCE_LEGACY_MEDIA_PATH_PREFIX ?? "/media/conference/",
    redirectMode: process.env.CONFERENCE_MEDIA_REDIRECT_MODE ?? "DIRECT",
    requestTimeoutMs: parseNumber(
      process.env.CONFERENCE_MEDIA_REQUEST_TIMEOUT_MS,
      30000,
    ),
    probeSampleLimit: parseNumber(
      process.env.CONFERENCE_MEDIA_PROBE_SAMPLE_LIMIT,
      20,
    ),
  },
  conferenceImport: {
    root: process.env.CONFERENCE_IMPORT_ROOT ?? "/app/imports/conference",
    pollIntervalMs: parseNumber(
      process.env.CONFERENCE_IMPORT_POLL_INTERVAL_MS,
      5000,
    ),
    maxIssuesPerRun: parseNumber(
      process.env.CONFERENCE_IMPORT_MAX_ISSUES_PER_RUN,
      1000,
    ),
    chunkSize: parseNumber(process.env.CONFERENCE_IMPORT_CHUNK_SIZE, 50),
  },
  notificationRecipient: {
    importRoot:
      process.env.NOTIFICATION_RECIPIENT_IMPORT_ROOT ??
      "/app/imports/notification-recipients",
  },
  gmail: {
    oauthTokenFile:
      process.env.GMAIL_OAUTH_TOKEN_FILE ?? "/run/secrets/gmail/token.json",
    fromEmail: process.env.GMAIL_FROM_EMAIL?.trim() || "vgw@voronoi.io",
    allowedRecipientDomains: parseCsv(
      process.env.GMAIL_ALLOWED_RECIPIENT_DOMAINS ?? "voronoi.io",
    ).map((domain) => domain.toLowerCase()),
    publicAppBaseUrl:
      process.env.PUBLIC_APP_BASE_URL ?? "http://localhost:5174",
    pollIntervalMs: parseNumber(
      process.env.GMAIL_OUTBOX_POLL_INTERVAL_MS,
      5000,
    ),
    leaseDurationMs: parseNumber(
      process.env.GMAIL_OUTBOX_LEASE_DURATION_MS,
      60000,
    ),
    maxAttempts: parseNumber(process.env.GMAIL_OUTBOX_MAX_ATTEMPTS, 5),
  },
  auth: {
    groupwareOrigin: process.env.GROUPWARE_ORIGIN ?? "https://voronoi.app",
    sessionExpiresInSeconds: parseNumber(
      process.env.AUTH_SESSION_EXPIRES_IN_SECONDS,
      21600,
    ),
    sessionUpdateAgeSeconds: parseNumber(
      process.env.AUTH_SESSION_UPDATE_AGE_SECONDS,
      1800,
    ),
    revalidateIntervalSeconds: parseNumber(
      process.env.GROUPWARE_REVALIDATE_INTERVAL_SECONDS,
      600,
    ),
  },
  httpTimeoutMs: parseNumber(process.env.HTTP_TIMEOUT_MS, 30000),
});
