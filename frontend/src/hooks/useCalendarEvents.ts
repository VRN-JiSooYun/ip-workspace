import { useCallback, useEffect, useRef, useState } from 'react';
import {
  sanitizeCalendarEventInput,
  type CalendarEvent,
  type CalendarEventInput,
} from '../utils/calendarEvents';
import type { CalendarEventGateway } from '../services/calendarEventApi';

export type CalendarEventsState = {
  events: CalendarEvent[];
  loading: boolean;
  error: string;
  createEvent: (input: CalendarEventInput) => Promise<void>;
  updateEvent: (id: string, input: CalendarEventInput) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
  reload: () => void;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

/**
 * 화면에 보이는 기간의 일정과 그 편집.
 *
 * 캐시하지 않고 기간이 바뀔 때마다 다시 묻는다. 특허 일정(usePatentScheduleEvents)과 다른
 * 점인데, 이쪽은 **사용자가 방금 고칠 수 있는 값**이라 오래된 목록을 들고 있으면 다른
 * 자리에서 만든 일정이 안 보이거나 지운 일정이 남는다. 달력 한 화면치라 요청도 가볍다.
 *
 * 등록·수정·삭제 뒤에는 목록을 다시 부른다. 응답 하나만 목록에 끼워 넣으면 기간 밖으로
 * 옮겨진 일정이 화면에 남고, 팀 공개로 바꾼 일정의 표시가 어긋난다.
 */
export const useCalendarEvents = (
  gateway: CalendarEventGateway,
  from: string,
  to: string,
): CalendarEventsState => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  /** 늦게 도착한 응답이 최신 목록을 덮지 않게 하는 표식. */
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!from || !to) return;
    const id = requestId.current + 1;
    requestId.current = id;
    setLoading(true);
    try {
      const result = await gateway.list(from, to);
      if (requestId.current !== id) return;
      setEvents(result);
      setError('');
    } catch (failure) {
      if (requestId.current !== id) return;
      setEvents([]);
      setError(getErrorMessage(failure));
    } finally {
      if (requestId.current === id) setLoading(false);
    }
  }, [from, gateway, to]);

  useEffect(() => { void load(); }, [load]);

  const createEvent = useCallback(async (input: CalendarEventInput) => {
    await gateway.create(sanitizeCalendarEventInput(input));
    await load();
  }, [gateway, load]);

  const updateEvent = useCallback(async (id: string, input: CalendarEventInput) => {
    await gateway.update(id, sanitizeCalendarEventInput(input));
    await load();
  }, [gateway, load]);

  const removeEvent = useCallback(async (id: string) => {
    await gateway.remove(id);
    await load();
  }, [gateway, load]);

  const reload = useCallback(() => { void load(); }, [load]);

  return { events, loading, error, createEvent, updateEvent, removeEvent, reload };
};
