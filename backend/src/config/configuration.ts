const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseCsv = (value: string | undefined): string[] => {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseNumber(process.env.PORT, 3000),
  corsOrigins: parseCsv(process.env.CORS_ORIGINS),
  patentAnalysis: {
    helperApiUrl:
      process.env.PATENT_ANALYSIS_HELPER_API_URL ??
      'http://172.16.1.210:10130',
    uploadApiUrl:
      process.env.PATENT_ANALYSIS_UPLOAD_API_URL ??
      'http://172.16.1.210:8000',
    insightApiUrl:
      process.env.PATENT_INSIGHT_API_URL ??
      'http://172.16.1.210:8000',
    ownerId: process.env.PATENT_ANALYSIS_OWNER_ID ?? '171',
    compoundSearchPatentLookupLimit: parseNumber(
      process.env.PATENT_ANALYSIS_COMPOUND_SEARCH_PATENT_LOOKUP_LIMIT,
      20,
    ),
  },
  conformer: {
    apiUrl: process.env.CONFORMER_API_URL ?? 'http://172.16.1.203:8000',
    timeoutMs: parseNumber(process.env.CONFORMER_API_TIMEOUT_MS, 120000),
  },
  compoundApi: {
    apiUrl: process.env.COMPOUND_API_URL ?? 'http://172.16.1.32:10050',
    authToken: process.env.COMPOUND_API_AUTH_TOKEN ?? '',
    timeoutMs: parseNumber(process.env.COMPOUND_API_TIMEOUT_MS, 30000),
  },
  threeDPsa: {
    apiUrl: process.env.THREE_D_PSA_API_URL ?? 'http://172.16.1.130:20010',
    submitTimeoutMs: parseNumber(process.env.THREE_D_PSA_SUBMIT_TIMEOUT_MS, 10000),
    callbackSecret: process.env.THREE_D_PSA_CALLBACK_SECRET ?? '',
    callbackMaxBodyMb: parseNumber(process.env.THREE_D_PSA_CALLBACK_MAX_BODY_MB, 25),
  },
  vprop: {
    apiUrl: process.env.VPROP_API_URL ?? 'http://172.16.1.207:8100',
    timeoutMs: parseNumber(process.env.VPROP_API_TIMEOUT_MS, 25000),
    maxResponseBytes: parseNumber(process.env.VPROP_MAX_RESPONSE_BYTES, 5242880),
  },
  auth: {
    groupwareOrigin: process.env.GROUPWARE_ORIGIN ?? 'https://voronoi.app',
    sessionExpiresInSeconds: parseNumber(process.env.AUTH_SESSION_EXPIRES_IN_SECONDS, 21600),
    sessionUpdateAgeSeconds: parseNumber(process.env.AUTH_SESSION_UPDATE_AGE_SECONDS, 1800),
    revalidateIntervalSeconds: parseNumber(
      process.env.GROUPWARE_REVALIDATE_INTERVAL_SECONDS,
      600,
    ),
  },
  httpTimeoutMs: parseNumber(process.env.HTTP_TIMEOUT_MS, 30000),
});
