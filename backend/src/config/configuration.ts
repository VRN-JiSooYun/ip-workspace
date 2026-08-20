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
  /**
   * 달력 공휴일 소스. 서비스 계정 JSON을 read-only로 마운트하고, 읽을 캘린더 ID를
   * CSV로 넘긴다. 사내 휴무 캘린더를 추가하려면 그 캘린더를 서비스 계정 이메일에
   * 공유하고 여기 ID만 덧붙이면 된다(코드 수정 불필요).
   */
  googleCalendar: {
    serviceAccountFile: process.env.GOOGLE_CALENDAR_SA_FILE ?? "",
    holidayCalendarIds: parseCsv(
      process.env.GOOGLE_HOLIDAY_CALENDAR_IDS ??
        "ko.south_korea#holiday@group.v.calendar.google.com",
    ),
    /**
     * Google 공휴일 캘린더는 공휴일이 아닌 기념일도 담고 description으로만 구분한다.
     * 실제 응답의 표기를 확인한 뒤 조정하라(HolidayService가 걸러낸 값을 debug 로그로 남긴다).
     */
    observanceMarkers: parseCsv(
      process.env.GOOGLE_HOLIDAY_OBSERVANCE_MARKERS ??
        "observance,관습일,기념일,절기,season",
    ),
    timeoutMs: parseNumber(process.env.GOOGLE_CALENDAR_API_TIMEOUT_MS, 15000),
    cacheTtlMs: parseNumber(
      process.env.HOLIDAY_CACHE_TTL_MS,
      12 * 60 * 60 * 1000,
    ),
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
