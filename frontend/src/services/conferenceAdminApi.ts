import { AUTH_REQUIRED_EVENT, notifyIfAuthRequired } from './authApi';

type RuntimeWindow = Window & { _env_?: { VITE_API_URL?: string } };

export type ConferenceImportStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
export type ConferenceImportMode = 'DRY_RUN' | 'APPLY';

export interface ConferenceImportBatch {
  batchKey: string;
  fileCount: number;
  excelCount: number;
  hasManifest: boolean;
  sourceFiles: string[];
}

export interface ConferenceImportIssue {
  id: string;
  sourceFile: string;
  rowNumber: number | null;
  entityType: string;
  severity: 'WARNING' | 'ERROR';
  errorCode: string;
  message: string;
}

export interface ConferenceImportRun {
  id: string;
  mode: ConferenceImportMode;
  status: ConferenceImportStatus;
  batchKey: string;
  profileVersion: string;
  sourceChecksum: string;
  insertedCount: number;
  updatedCount: number;
  inspectedCount?: number;
  skippedCount: number;
  errorCount: number;
  startedAt: string;
  finishedAt: string | null;
  startedBy?: { id: string; name: string; email: string };
  issues?: ConferenceImportIssue[];
  _count?: { issues: number };
}

export interface NotificationRecipientImportIssue {
  id: string;
  rowNumber: number | null;
  severity: 'WARNING' | 'ERROR';
  errorCode: string;
  message: string;
  memberId: number | null;
}

export interface NotificationRecipientImportRun {
  id: string;
  mode: ConferenceImportMode;
  status: 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  profileVersion: string;
  sourceChecksum: string;
  sourceCount: number;
  insertedCount: number;
  updatedCount: number;
  unchangedCount: number;
  skippedCount: number;
  conflictCount: number;
  errorCount: number;
  startedAt: string;
  finishedAt: string | null;
  startedBy?: { id: string; name: string; email: string };
  issues?: NotificationRecipientImportIssue[];
  _count?: { issues: number };
}

export type ConferenceMailOutboxStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'RETRY'
  | 'SENT'
  | 'FAILED';

export interface ConferenceMailOutboxItem {
  id: string;
  type: 'COMMENT_MENTION';
  status: ConferenceMailOutboxStatus;
  recipientNameSnapshot: string;
  recipientEmailSnapshot: string;
  subjectSnapshot: string;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lastErrorCode: string | null;
  providerMessageId: string | null;
  sentAt: string | null;
  createdAt: string;
  comment: {
    abstract: {
      id: string;
      title: string;
      conferenceId: string;
    };
  };
}

export interface ConferenceMailHealth {
  provider: {
    ready: boolean;
    fromEmailConfigured: boolean;
    tokenFileConfigured: boolean;
    errorCode?: string;
  };
  counts: Partial<Record<ConferenceMailOutboxStatus, number>>;
}

export interface CreateAdminConferenceInput {
  title: string;
  abbreviation: string;
  fullTitle?: string;
  year: number;
  status?: 'OPEN' | 'NOT_OPENED';
  sourceUrl?: string;
  dateStart?: string;
  dateEnd?: string;
}

export interface CreateAdminAbstractInput {
  title: string;
  sourceUrl?: string;
  firstAuthorName?: string;
  firstAuthorOrganization?: string;
  authors?: string[];
  meeting?: string;
  sessionType?: string;
  sessionTitle?: string;
  track?: string;
  subTrack?: string;
  abstractNumber?: string;
  posterNumber?: string;
  clinicalTrialRegistrationNumber?: string;
  dateOpen?: string;
  contentsJson?: string;
}

const getApiBaseUrl = () => {
  const runtimeValue = typeof window !== 'undefined'
    ? (window as RuntimeWindow)._env_?.VITE_API_URL
    : undefined;
  const value = runtimeValue || import.meta.env.VITE_API_URL || '/api';
  return value.includes('${') ? '/api' : value.replace(/\/$/, '');
};

const url = (path: string) => new URL(
  `${getApiBaseUrl()}${path}`,
  window.location.origin,
).toString();

const request = async <T>(
  path: string,
  options?: RequestInit,
): Promise<T> => {
  const response = await fetch(url(path), {
    ...options,
    credentials: 'include',
  });
  notifyIfAuthRequired(response);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const rawMessage = body?.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join(', ')
      : typeof rawMessage === 'string'
        ? rawMessage
        : `ADMIN_CONFERENCE_API_${response.status}`;
    if (response.status === 403) {
      window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
    }
    throw new Error(message);
  }
  return body as T;
};

const jsonRequest = <T>(
  path: string,
  method: 'POST' | 'PATCH',
  body: Record<string, unknown>,
) => request<T>(path, {
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const conferenceAdminApi = {
  listBatches: () => request<ConferenceImportBatch[]>('/admin/conference-imports/batches'),
  listRuns: (limit = 30) => request<ConferenceImportRun[]>(
    `/admin/conference-imports?limit=${limit}`,
  ),
  getRun: (runId: string) => request<ConferenceImportRun>(
    `/admin/conference-imports/${encodeURIComponent(runId)}`,
  ),
  createDryRun: (batchKey: string, profileVersion: string) => (
    jsonRequest<ConferenceImportRun>('/admin/conference-imports/dry-run', 'POST', {
      batchKey,
      profileVersion,
    })
  ),
  createApply: (batchKey: string, profileVersion: string) => (
    jsonRequest<ConferenceImportRun>('/admin/conference-imports', 'POST', {
      batchKey,
      profileVersion,
    })
  ),
  listRecipientImportRuns: () => request<NotificationRecipientImportRun[]>(
    '/admin/notification-recipient-imports',
  ),
  getRecipientImportRun: (runId: string) => request<NotificationRecipientImportRun>(
    `/admin/notification-recipient-imports/${encodeURIComponent(runId)}`,
  ),
  createRecipientDryRun: () => request<NotificationRecipientImportRun>(
    '/admin/notification-recipient-imports/dry-run',
    { method: 'POST' },
  ),
  createRecipientApply: () => request<NotificationRecipientImportRun>(
    '/admin/notification-recipient-imports',
    { method: 'POST' },
  ),
  reconcileRecipientUsers: () => request<{
    sourceCount: number;
    syncedCount: number;
    failedCount: number;
  }>('/admin/notification-recipient-imports/reconcile-users', { method: 'POST' }),
  getMailHealth: () => request<ConferenceMailHealth>(
    '/admin/conference-mail-outbox/health',
  ),
  listMailOutboxes: (limit = 50) => request<ConferenceMailOutboxItem[]>(
    `/admin/conference-mail-outbox?limit=${limit}`,
  ),
  retryMailOutbox: (outboxId: string) => request<{
    id: string;
    status: ConferenceMailOutboxStatus;
    nextAttemptAt: string;
  }>(
    `/admin/conference-mail-outbox/${encodeURIComponent(outboxId)}/retry`,
    { method: 'POST' },
  ),
  createConference: (body: CreateAdminConferenceInput) => (
    jsonRequest<Record<string, unknown>>('/admin/conferences', 'POST', { ...body })
  ),
  createAbstract: (conferenceId: string, body: CreateAdminAbstractInput) => (
    jsonRequest<Record<string, unknown>>(
      `/admin/conferences/${encodeURIComponent(conferenceId)}/abstracts`,
      'POST',
      { ...body },
    )
  ),
};
