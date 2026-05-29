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
    ownerId: process.env.PATENT_ANALYSIS_OWNER_ID ?? '171',
    compoundSearchPatentLookupLimit: parseNumber(
      process.env.PATENT_ANALYSIS_COMPOUND_SEARCH_PATENT_LOOKUP_LIMIT,
      20,
    ),
  },
  httpTimeoutMs: parseNumber(process.env.HTTP_TIMEOUT_MS, 30000),
});
