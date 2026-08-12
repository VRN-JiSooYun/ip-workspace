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
  patentSearch: {
    apiUrl: process.env.PATENT_SEARCH_API_URL ?? "http://172.16.1.210:10000",
    // OA 본문이 건당 10KB를 넘어 size가 커지면 응답도 커진다. 기본 30s로는 빠듯하다.
    timeoutMs: parseNumber(process.env.PATENT_SEARCH_API_TIMEOUT_MS, 60000),
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
  notificationRecipient: {
    importRoot:
      process.env.NOTIFICATION_RECIPIENT_IMPORT_ROOT ??
      "/app/imports/notification-recipients",
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
