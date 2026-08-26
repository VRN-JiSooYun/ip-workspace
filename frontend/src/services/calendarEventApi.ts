/**
 * 사용자 일정 API(`/api/calendar-events`).
 *
 * 서버로 옮기기 전에는 이 자리에 localStorage 저장소가 있었다. 화면과 훅이 보는 모양
 * (`CalendarEvent`)은 그대로 두고 이 파일만 갈아 끼웠다 — 그러라고 계층을 나눠 두었다.
 *
 * 날짜는 `YYYY-MM-DD`, 시각은 `HH:mm` 문자열로 주고받는다. 서버의 column도 date/시각
 * 문자열이라 시간대 변환이 끼어들 자리가 없다.
 */

import { DEFAULT_API_BASE_PATH } from '../config/basePath';
import { AUTH_REQUIRED_EVENT, notifyIfAuthRequired } from './authApi';
import type { CalendarEvent, CalendarEventInput } from '../utils/calendarEvents';

type RuntimeWindow = Window & { _env_?: { VITE_API_URL?: string } };

const getApiBaseUrl = () => {
  const runtimeValue = typeof window !== 'undefined'
    ? (window as RuntimeWindow)._env_?.VITE_API_URL
    : undefined;
  const value = runtimeValue || import.meta.env.VITE_API_URL || DEFAULT_API_BASE_PATH;
  return value.includes('${') ? DEFAULT_API_BASE_PATH : value.replace(/\/$/, '');
};

const url = (path: string) => new URL(
  `${getApiBaseUrl()}${path}`,
  window.location.origin,
).toString();

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url(path), {
    ...options,
    credentials: 'include',
    headers: options?.body
      ? { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
      : options?.headers,
  });
  notifyIfAuthRequired(response);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const rawMessage = (body as { message?: unknown } | null)?.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join(', ')
      : typeof rawMessage === 'string'
        ? rawMessage
        : `CALENDAR_EVENT_API_${response.status}`;
    if (response.status === 403) {
      window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
    }
    throw new Error(message);
  }
  return body as T;
};

export const calendarEventApi = {
  /** 기간이 겹치는 일정. 내 것과 내 팀에 공개된 것이 함께 온다. */
  list(from: string, to: string): Promise<CalendarEvent[]> {
    return request<CalendarEvent[]>(
      `/calendar-events?from=${from}&to=${to}`,
    );
  },

  create(input: CalendarEventInput): Promise<CalendarEvent> {
    return request<CalendarEvent>('/calendar-events', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /** 부분 수정이 아니라 전체 교체다(서버 dto 주석 참고). */
  update(id: string, input: CalendarEventInput): Promise<CalendarEvent> {
    return request<CalendarEvent>(`/calendar-events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  remove(id: string): Promise<{ id: string }> {
    return request<{ id: string }>(`/calendar-events/${id}`, { method: 'DELETE' });
  },
};

/**
 * 화면이 저장소에 대해 아는 전부.
 *
 * 실제 화면은 위 API를, harness는 메모리 구현을 넣는다. 이 네 함수만 맞추면 되므로
 * 달력 컴포넌트는 어느 쪽이 붙었는지 모른다.
 */
export type CalendarEventGateway = {
  list: (from: string, to: string) => Promise<CalendarEvent[]>;
  create: (input: CalendarEventInput) => Promise<CalendarEvent>;
  update: (id: string, input: CalendarEventInput) => Promise<CalendarEvent>;
  remove: (id: string) => Promise<unknown>;
};
