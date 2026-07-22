import {
  mockPatentInsightStatistics,
  PatentInsightApplicantItem,
  PatentInsightCountItem,
  PatentInsightHeatmapItem,
  PatentInsightStatistics,
  PatentInsightTimePoint,
} from '../mocks/patentInsight';
import { notifyIfAuthRequired } from './authApi';

export type PatentInsightStatisticsRequest = {
  applicant?: string;
  fromDate?: string;
  toDate?: string;
  topNApplicant?: number;
  topNTarget?: number;
};

type RawPatentInsightResponse = {
  data?: Record<string, unknown>;
};

type RuntimeWindow = Window & {
  _env_?: {
    VITE_API_URL?: string;
  };
};

const getApiBaseUrl = () => {
  const runtimeValue = typeof window !== 'undefined'
    ? (window as RuntimeWindow)._env_?.VITE_API_URL
    : undefined;
  const value = runtimeValue || import.meta.env.VITE_API_URL || '/api';

  if (value.includes('${')) {
    return '/api';
  }
  return value.replace(/\/$/, '');
};

const buildApiUrl = (path: string) =>
  new URL(`${getApiBaseUrl()}${path}`, window.location.origin).toString();

const toNumber = (value: unknown, fallback = 0) => {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
};

const getName = (row: Record<string, unknown>, keys: string[], fallback: string) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== '') return String(value);
  }
  return fallback;
};

const normalizeCountItems = (
  value: unknown,
  nameKeys: string[],
  fallbackPrefix: string,
): PatentInsightCountItem[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      return {
        name: getName(row, nameKeys, `${fallbackPrefix} ${index + 1}`),
        count: toNumber(row.count ?? row.counts ?? row.total),
      };
    })
    .filter((item): item is PatentInsightCountItem => Boolean(item));
};

const normalizeApplicantItems = (value: unknown): PatentInsightApplicantItem[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      return {
        applicant: getName(row, ['applicant', 'name', 'company'], `Applicant ${index + 1}`),
        count: toNumber(row.count ?? row.counts ?? row.total),
      };
    })
    .filter((item): item is PatentInsightApplicantItem => Boolean(item));
};

const normalizeTimePoints = (value: unknown): PatentInsightTimePoint[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      return {
        year: toNumber(row.year ?? row.publication_year),
        count: toNumber(row.count ?? row.counts ?? row.total),
      };
    })
    .filter((item): item is PatentInsightTimePoint => Boolean(item && item.year > 0));
};

const normalizeHeatmapItems = (value: unknown): PatentInsightHeatmapItem[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index): PatentInsightHeatmapItem | null => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const target = getName(row, ['target', 'target_name', 'Target'], `Target ${index + 1}`);
      const year = toNumber(row.year ?? row.publication_year ?? row.date_year, 0);
      return {
        target,
        year: year || 2000,
        applicant: getName(row, ['applicant', 'company'], ''),
        count: toNumber(row.count ?? row.counts ?? row.total),
      };
    })
    .filter((item): item is PatentInsightHeatmapItem => Boolean(item));
};

const normalizeStatisticsResponse = (response: RawPatentInsightResponse): PatentInsightStatistics => {
  const data = response.data ?? {};
  const countAcrossTime = normalizeTimePoints(data.count_across_time);
  const patentPerOffice = normalizeCountItems(data.patent_per_office, ['patent_office', 'office', 'name'], 'Office');
  const filingLanguageCounts = normalizeCountItems(data.filling_language_counts, ['filling_language', 'language', 'name'], 'Language');
  const patentTypeCounts = normalizeCountItems(data.patent_type_counts, ['patent_type', 'type', 'name'], 'Type');
  const patentCountByApplicant = normalizeApplicantItems(data.patent_count_by_applicant);
  const patentCountByTargetAndApplicant = normalizeHeatmapItems(data.patent_count_by_target_and_applicant);

  return {
    totalCount: toNumber(data.total_count, mockPatentInsightStatistics.totalCount),
    filteredCount: toNumber(data.filtered_count, mockPatentInsightStatistics.filteredCount),
    countAcrossTime: countAcrossTime.length > 0 ? countAcrossTime : mockPatentInsightStatistics.countAcrossTime,
    patentPerOffice: patentPerOffice.length > 0 ? patentPerOffice : mockPatentInsightStatistics.patentPerOffice,
    filingLanguageCounts: filingLanguageCounts.length > 0 ? filingLanguageCounts : mockPatentInsightStatistics.filingLanguageCounts,
    patentTypeCounts: patentTypeCounts.length > 0 ? patentTypeCounts : mockPatentInsightStatistics.patentTypeCounts,
    patentCountByApplicant: patentCountByApplicant.length > 0 ? patentCountByApplicant : mockPatentInsightStatistics.patentCountByApplicant,
    patentCountByTargetAndApplicant: patentCountByTargetAndApplicant.length > 0
      ? patentCountByTargetAndApplicant
      : mockPatentInsightStatistics.patentCountByTargetAndApplicant,
  };
};

const postJson = async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
  const response = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  notifyIfAuthRequired(response);

  if (!response.ok) {
    throw new Error(`Patent Insight API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
};

export const patentInsightApi = {
  getAllStatistics: async (params: PatentInsightStatisticsRequest): Promise<PatentInsightStatistics> => {
    const response = await postJson<RawPatentInsightResponse>('/patents/insight/statistics', {
      applicant: params.applicant || undefined,
      from_date: params.fromDate || undefined,
      to_date: params.toDate || undefined,
      top_n_applicant: params.topNApplicant,
      top_n_target: params.topNTarget,
    });

    return normalizeStatisticsResponse(response);
  },
  refreshStatistics: () => postJson<Record<string, unknown>>('/patents/insight/refresh', {}),
};
