import { notifyIfAuthRequired } from './authApi';

type RuntimeWindow = Window & {
  _env_?: {
    VITE_API_URL?: string;
  };
};

export type ConferenceAssetKind =
  | 'LOGO'
  | 'POSTER'
  | 'DOCUMENT'
  | 'VIDEO'
  | 'REFERENCE_IMAGE'
  | 'ATTACHMENT';

export interface ConferenceAsset {
  id: string;
  kind: ConferenceAssetKind;
  filename: string;
  mimeType: string | null;
  byteSize: string | null;
  sortOrder: number;
  contentUrl: string;
  downloadUrl: string | null;
}

export interface ConferenceOption {
  id: string;
  title: string;
  abbreviation: string;
  fullTitle: string | null;
  year: number;
  status: 'OPEN' | 'NOT_OPENED';
  dateStart: string | null;
  dateEnd: string | null;
}

export interface ConferenceAbstractListItem {
  id: string;
  conference: ConferenceOption;
  abstractNumber: string | null;
  title: string;
  firstAuthorName: string | null;
  firstAuthorOrganization: string | null;
  meeting: string | null;
  sessionType: string | null;
  sessionTitle: string | null;
  track: string | null;
  dateOpen: string | null;
  isFavorite: boolean;
  commentCount: number;
  assetSummary: {
    posterCount: number;
    videoCount: number;
    documentCount: number;
    referenceImageCount: number;
  };
}

export interface ConferenceUser {
  id: string | null;
  name: string;
  email: string;
}

export interface ConferenceNotificationRecipient {
  id: string;
  name: string;
  email: string;
}

export interface ConferenceComment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  sourceSystem: 'WORKSPACE' | 'LEGACY_DJANGO';
  sourceCreatedAt: string | null;
  author: ConferenceUser;
  mentionedRecipients: ConferenceNotificationRecipient[];
  directRecipientEmails?: string[];
  notificationQueuedCount?: number;
}

export interface ConferenceAbstractDetail extends Omit<
  ConferenceAbstractListItem,
  'assetSummary' | 'conference'
> {
  conference: {
    id: string;
    title: string;
    abbreviation: string;
    fullTitle: string | null;
    year: number;
  };
  sourceUrl: string | null;
  firstAuthorUrl: string | null;
  authors: unknown;
  authorOrganizations: unknown;
  organizations: unknown;
  contents: unknown;
  meetingUrl: string | null;
  sessionTypeUrl: string | null;
  sessionTitleUrl: string | null;
  trackUrl: string | null;
  subTrack: string | null;
  subTrackUrl: string | null;
  posterNumber: string | null;
  clinicalTrialRegistrationNumber: string | null;
  assets: ConferenceAsset[];
  comments: ConferenceComment[];
}

interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}

export interface ConferenceAbstractListResponse extends PaginatedResponse<ConferenceAbstractListItem> {
  facets: {
    conferences: ConferenceOption[];
    years: number[];
  };
}

export type ConferenceAbstractSearchField =
  | 'all'
  | 'conference'
  | 'title'
  | 'author'
  | 'abstractNumber';

export type ConferenceAbstractDateField = 'conferencePeriod' | 'dateOpen';

export interface ConferenceAbstractListParams {
  q?: string;
  searchField?: ConferenceAbstractSearchField;
  conferenceIds?: string;
  years?: string;
  favoriteOnly?: boolean;
  dateField?: ConferenceAbstractDateField;
  dateFrom?: string;
  dateTo?: string;
  hasPoster?: boolean;
  hasVideo?: boolean;
  hasDocument?: boolean;
  sort?:
    | 'conferenceYearDesc'
    | 'abstractNumberAsc'
    | 'titleAsc'
    | 'dateOpenDesc'
    | 'commentCountDesc';
  page?: number;
  pageSize?: number;
}

export class ConferenceApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ConferenceApiError';
  }
}

const getApiBaseUrl = () => {
  const runtimeValue = typeof window !== 'undefined'
    ? (window as RuntimeWindow)._env_?.VITE_API_URL
    : undefined;
  const value = runtimeValue || import.meta.env.VITE_API_URL || '/api';
  return value.includes('${') ? '/api' : value.replace(/\/$/, '');
};

const buildUrl = (
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
) => {
  const url = new URL(`${getApiBaseUrl()}${path}`, window.location.origin);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
};

const errorMessage = async (response: Response) => {
  try {
    const body = await response.json();
    const message = body?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string' && message.trim()) return message;
  } catch {
    // HTTP status fallback below.
  }
  return `API request failed: ${response.status}`;
};

const get = async <T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  signal?: AbortSignal,
): Promise<T> => {
  const response = await fetch(buildUrl(path, params), {
    credentials: 'include',
    signal,
  });
  notifyIfAuthRequired(response);
  if (!response.ok) {
    throw new ConferenceApiError(await errorMessage(response), response.status);
  }
  return response.json() as Promise<T>;
};

const mutate = async <T>(
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: Record<string, unknown>,
): Promise<T> => {
  const response = await fetch(buildUrl(path), {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  notifyIfAuthRequired(response);
  if (!response.ok) {
    throw new ConferenceApiError(await errorMessage(response), response.status);
  }
  return response.json() as Promise<T>;
};

export const resolveConferenceAssetUrl = (path: string) => (
  new URL(
    path,
    new URL(`${getApiBaseUrl()}/`, window.location.origin),
  ).toString()
);

export const conferenceApi = {
  listAbstracts: (
    params: ConferenceAbstractListParams,
    signal?: AbortSignal,
  ) => get<ConferenceAbstractListResponse>(
    '/conference-abstracts',
    { ...params },
    signal,
  ),
  getAbstract: (abstractId: string, signal?: AbortSignal) => (
    get<ConferenceAbstractDetail>(
      `/conference-abstracts/${encodeURIComponent(abstractId)}`,
      undefined,
      signal,
    )
  ),
  setAbstractBookmark: (abstractId: string, bookmarked: boolean) => (
    mutate<{ abstractId: string; isFavorite: boolean }>(
      `/conference-abstracts/${encodeURIComponent(abstractId)}/bookmark`,
      bookmarked ? 'PUT' : 'DELETE',
    )
  ),
  searchRecipients: (q: string, limit = 10, signal?: AbortSignal) => (
    get<ConferenceNotificationRecipient[]>(
      '/notification-recipients/search',
      { q, limit },
      signal,
    )
  ),
  createComment: (
    abstractId: string,
    content: string,
    recipientIds: string[],
    recipientEmails: string[],
  ) => mutate<ConferenceComment>(
    `/conference-abstracts/${encodeURIComponent(abstractId)}/comments`,
    'POST',
    { content, recipientIds, recipientEmails },
  ),
  deleteComment: (commentId: string) => (
    mutate<{ commentId: string; deleted: boolean }>(
      `/conference-abstract-comments/${encodeURIComponent(commentId)}`,
      'DELETE',
    )
  ),
};
