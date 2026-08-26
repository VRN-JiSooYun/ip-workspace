/**
 * 달력 한 칸에 놓이는 항목(entry)의 자료형.
 *
 * 달력에는 성격이 다른 두 가지가 섞여 놓인다.
 *   - `user`   : 사용자가 만든 일정. 고치고 지울 수 있다(브라우저에 저장된다)
 *   - `patent` : 특허 일정. 서버가 준 사실이라 **읽기 전용**이다
 *                (출원·공개·등록·국제출원·국제공개·심사·예상 만료일과 To-do 마감일)
 *
 * 둘을 하나의 모양(CalendarItem)으로 맞춰 두면 배치 계산이 출처를 몰라도 된다. 대신
 * `source`를 남겨, 눌렀을 때 어떤 팝업을 열지와 어떤 스타일로 그릴지를 화면이 고른다.
 */

import type { CalendarItem, CalendarEventColor, CalendarEvent } from './calendarEvents';
import type {
  PatentScheduleEvent,
  PatentScheduleEventType,
} from '../services/patentRecordApi';

export type ScheduleEntry = CalendarItem & (
  | { source: 'user'; event: CalendarEvent }
  | { source: 'patent'; patent: PatentScheduleEvent }
);

/**
 * 특허 일정의 종류별 색.
 *
 * 사용자 일정과 같은 여섯 색을 쓰되 칠하는 방식이 다르다(특허 일정은 테두리만 칠한다).
 * 색은 "무슨 일인가"를 거들 뿐이고, 뜻은 항상 막대의 글자가 갖는다.
 */
export const PATENT_EVENT_TONES: Record<PatentScheduleEventType, CalendarEventColor> = {
  APPLICATION: 'blue',
  INT_APPLICATION: 'blue',
  PUBLICATION: 'teal',
  INT_PUBLICATION: 'teal',
  EXAM: 'purple',
  REGISTRATION: 'yellow',
  // 마감은 지나면 문제가 되는 유일한 종류다. 눈에 먼저 들어와야 한다.
  TODO: 'red',
  EXPECTED_EXPIRY: 'orange',
};

/** 특허를 가리키는 짧은 이름. 내부관리번호가 없으면 출원번호를 쓴다. */
export const patentEventRef = (event: PatentScheduleEvent): string => (
  event.internalRef ?? event.applicationNumber
);

/**
 * 막대에 쓸 글자.
 *
 * To-do는 `label`이 'To-do 마감일'로 고정이라 무엇 때문의 마감인지가 사라진다. 그래서
 * To-do만 일정 제목(= To-do 제목)을 쓰고, 나머지는 날짜의 이름(출원일·등록일 …)을 쓴다.
 */
export const patentEventHeadline = (event: PatentScheduleEvent): string => (
  event.type === 'TODO' ? event.title ?? event.label : event.label
);

/**
 * 서버가 준 특허 일정 하나를 달력 항목으로 옮긴다.
 *
 * 특허 일정은 모두 '그날 하루'다. 서버가 주는 것이 날짜뿐이라 시각이 없고, 그래서 종일로
 * 둔다(시간 격자에서는 위쪽 종일 줄에 놓인다).
 *
 * id는 화면 안에서만 유일하면 된다. 같은 특허가 같은 날 두 종류의 일정을 가질 수 있으므로
 * 종류와 날짜까지 넣어 만든다.
 */
export const toPatentEntry = (event: PatentScheduleEvent): ScheduleEntry => ({
  source: 'patent',
  patent: event,
  id: `patent:${event.patentId}:${event.todoId ?? 'x'}:${event.type}:${event.date}`,
  title: `${patentEventHeadline(event)} · ${patentEventRef(event)}`,
  start: event.date,
  end: event.date,
  allDay: true,
  startTime: null,
  endTime: null,
  color: PATENT_EVENT_TONES[event.type],
});

export const toUserEntry = (event: CalendarEvent): ScheduleEntry => ({
  source: 'user',
  event,
  id: event.id,
  title: event.title,
  start: event.start,
  end: event.end,
  allDay: event.allDay,
  startTime: event.startTime,
  endTime: event.endTime,
  color: event.color,
});

/** `YYYY-MM-DD` 목록이 걸치는 달들. 특허 일정 조회가 달 단위라 필요하다. */
export const monthKeysOfDates = (dates: string[]): string[] => (
  [...new Set(dates.map((date) => date.slice(0, 7)))].sort()
);
