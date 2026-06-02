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

export const validateEnv = (config: EnvConfig): EnvConfig => {
  ensureNumber('PORT', config.PORT);
  ensureNumber('HTTP_TIMEOUT_MS', config.HTTP_TIMEOUT_MS);
  ensureUrl('PATENT_ANALYSIS_HELPER_API_URL', config.PATENT_ANALYSIS_HELPER_API_URL);
  ensureUrl('PATENT_ANALYSIS_UPLOAD_API_URL', config.PATENT_ANALYSIS_UPLOAD_API_URL);
  ensureUrl('PATENT_INSIGHT_API_URL', config.PATENT_INSIGHT_API_URL);
  return config;
};
