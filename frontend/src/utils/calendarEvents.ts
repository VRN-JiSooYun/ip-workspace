/**
 * 캘린더 일정의 자료형과 배치 계산.
 *
 * 여기에는 순수 함수만 둔다. 저장은 services/calendarEventApi가, 화면은
 * components/dashboard/widgets/ScheduleCalendar가 갖는다. 막대 배치(여러 날에 걸친 일정이
 * 주(week) 안에서 몇 번째 줄에 놓이는가)와 시간 격자의 겹침 계산은 손으로 재현하기 어려운
 * 경계가 많아서, harness에서 단정으로 확인할 수 있게 화면과 떼어 놓았다
 * — utils/patentCalendar와 같은 역할 분담이다.
 *
 * 날짜는 전부 `YYYY-MM-DD`, 시각은 `HH:mm` 문자열이다. 두 형식 모두 사전순 비교가 시간순
 * 비교와 같아서 비교하려고 Date를 만들지 않는다(자정 근처에서 하루가 밀리는 사고를 피한다).
 * 기간의 끝(`end`)은 **그날을 포함**한다 — 사용자가 달력에서 보는 것과 같은 뜻이다.
 */

import { formatDisplayDateTime } from './displayFormat';
import {
  buildMonthGrid,
  parseDateKey,
  shiftDateKey,
  toLocalDateKey,
  type MonthGridCell,
} from './patentCalendar';

/** 일정 색. 그룹웨어 캘린더처럼 종류가 아니라 사용자가 고르는 표식이다. */
export const CALENDAR_EVENT_COLORS = [
  'purple',
  'orange',
  'yellow',
  'teal',
  'blue',
  'red',
] as const;

export type CalendarEventColor = typeof CALENDAR_EVENT_COLORS[number];

export const CALENDAR_EVENT_COLOR_LABELS: Record<CalendarEventColor, string> = {
  purple: '보라',
  orange: '주황',
  yellow: '노랑',
  teal: '청록',
  blue: '파랑',
  red: '빨강',
};

export const DEFAULT_CALENDAR_EVENT_COLOR: CalendarEventColor = 'purple';

const COLOR_SET = new Set<string>(CALENDAR_EVENT_COLORS);

export const isCalendarEventColor = (value: unknown): value is CalendarEventColor => (
  typeof value === 'string' && COLOR_SET.has(value)
);

/**
 * 달력이 그릴 수 있는 것의 최소 모양.
 *
 * 배치 계산은 이 모양만 알면 된다. 그래서 사용자가 만든 일정(CalendarEvent)과 특허
 * 일정(서버에서 온 읽기 전용 항목)이 같은 격자 위에 섞여 놓일 수 있다
 * — utils/scheduleEntries가 둘을 이 모양으로 맞춰 준다.
 */
export type CalendarItem = {
  id: string;
  title: string;
  /** 시작일. `YYYY-MM-DD`. */
  start: string;
  /** 종료일(포함). 항상 start 이상이다. */
  end: string;
  allDay: boolean;
  /** 종일이면 null. */
  startTime: string | null;
  endTime: string | null;
  color: CalendarEventColor;
};

/** 공개 범위. 서버 enum(CalendarEventVisibility)과 같은 값이다. */
export const CALENDAR_EVENT_VISIBILITIES = ['PRIVATE', 'TEAM'] as const;

export type CalendarEventVisibility = typeof CALENDAR_EVENT_VISIBILITIES[number];

/**
 * 사용자가 만든 일정. 서버(`/api/calendar-events`)가 주는 모양 그대로다.
 *
 * `canEdit`은 서버가 계산해 준다. 팀에 공개된 일정은 팀원 모두에게 보이지만 고치고 지우는
 * 것은 만든 사람만 할 수 있는데, 그 판단이 화면과 서버 두 곳에 있으면 언젠가 갈린다.
 */
export type CalendarEvent = CalendarItem & {
  memo: string | null;
  visibility: CalendarEventVisibility;
  teamId: string | null;
  teamName: string | null;
  owner: { id: string; name: string };
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
};

/** 등록·수정 폼이 서버로 보내는 값. id·작성자·시각 도장은 서버가 찍는다. */
export type CalendarEventInput = Omit<
  CalendarEvent,
  'id' | 'createdAt' | 'updatedAt' | 'teamName' | 'owner' | 'canEdit'
>;

// ---- 값 검증 ---------------------------------------------------------------

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * 왕복해서 같은 문자열이 나와야 진짜 날짜다. `2026-13-45` 같은 값은 Date가 조용히
 * 2027년으로 넘겨 버리므로, 형식과 NaN 검사만으로는 걸러지지 않는다.
 */
export const isDateKey = (value: unknown): value is string => (
  typeof value === 'string'
  && DATE_KEY_PATTERN.test(value)
  && toLocalDateKey(parseDateKey(value)) === value
);

export const isTimeValue = (value: unknown): value is string => (
  typeof value === 'string' && TIME_PATTERN.test(value)
);

export const MINUTES_PER_DAY = 24 * 60;

/** `HH:mm` → 자정부터의 분. 형식이 아니면 fallback을 준다. */
export const minutesOfTime = (value: unknown, fallback: number): number => {
  if (!isTimeValue(value)) return fallback;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
};

/** 시간 블록이 이보다 짧으면 글자가 들어가지 않는다. 겹침 계산도 이 값을 쓴다. */
export const MIN_EVENT_MINUTES = 30;

/**
 * 폼이 준 값을 저장 가능한 모양으로 다듬는다.
 *
 * - 제목은 trim하고, 비면 '(제목 없음)'으로 둔다(제목 없는 막대는 읽을 수 없다)
 * - 기간이 거꾸로면 뒤집는다
 * - 종일이면 시각을 버리고, 종일이 아닌데 시각이 없으면 종일로 되돌린다
 * - 같은 날 안에서 끝 시각이 시작보다 앞서면 뒤집는다
 * - 비공개면 팀 연결을 끊는다(서버도 같은 규칙을 다시 확인한다)
 */
export const sanitizeCalendarEventInput = (input: CalendarEventInput): CalendarEventInput => {
  const title = input.title.trim() || '(제목 없음)';
  const start = isDateKey(input.start) ? input.start : input.end;
  const end = isDateKey(input.end) ? input.end : start;
  const [from, to] = start <= end ? [start, end] : [end, start];
  const color = isCalendarEventColor(input.color) ? input.color : DEFAULT_CALENDAR_EVENT_COLOR;
  const memo = input.memo?.trim() ? input.memo.trim() : null;
  const visibility = input.visibility === 'TEAM' && input.teamId ? 'TEAM' : 'PRIVATE';
  const teamId = visibility === 'TEAM' ? input.teamId : null;
  const shared = { color, memo, visibility, teamId } as const;

  if (input.allDay || !isTimeValue(input.startTime) || !isTimeValue(input.endTime)) {
    return { title, start: from, end: to, allDay: true, startTime: null, endTime: null, ...shared };
  }

  const sameDay = from === to;
  const [startTime, endTime] = sameDay && input.endTime < input.startTime
    ? [input.endTime, input.startTime]
    : [input.startTime, input.endTime];

  return { title, start: from, end: to, allDay: false, startTime, endTime, ...shared };
};

// ---- 질의 ------------------------------------------------------------------

export const eventIsMultiDay = (event: CalendarItem): boolean => event.start !== event.end;

/**
 * 위쪽 막대 줄에 놓이는 일정인가. 종일이거나 여러 날에 걸친 일정이 그렇다.
 * 나머지(하루 안의 시각 일정)는 주간·일간 보기에서 시간 격자에 놓인다.
 */
export const eventIsBar = (event: CalendarItem): boolean => (
  event.allDay || eventIsMultiDay(event)
);

/**
 * 그리는 순서. 긴 일정이 위로 올라가야 여러 날짜에 걸친 막대가 끊겨 보이지 않는다.
 * 마지막에 id로 견주는 이유는 값이 같을 때도 순서가 흔들리지 않게 하기 위해서다.
 */
export const compareCalendarItems = (a: CalendarItem, b: CalendarItem): number => {
  if (eventIsBar(a) !== eventIsBar(b)) return eventIsBar(a) ? -1 : 1;
  const spanA = parseDateKey(a.end).getTime() - parseDateKey(a.start).getTime();
  const spanB = parseDateKey(b.end).getTime() - parseDateKey(b.start).getTime();
  if (spanA !== spanB) return spanB - spanA;
  if (a.start !== b.start) return a.start < b.start ? -1 : 1;
  const timeA = minutesOfTime(a.startTime, -1);
  const timeB = minutesOfTime(b.startTime, -1);
  if (timeA !== timeB) return timeA - timeB;
  if (a.title !== b.title) return a.title.localeCompare(b.title, 'ko');
  return a.id.localeCompare(b.id);
};

// ---- 표시 문자열 -----------------------------------------------------------

/** 팝업의 '기간' 줄. 하루짜리면 날짜 하나만 보여 준다. */
export const formatEventPeriod = (event: CalendarItem): string => (
  eventIsMultiDay(event)
    ? `${formatDisplayDateTime(event.start)} ~ ${formatDisplayDateTime(event.end)}`
    : formatDisplayDateTime(event.start)
);

/** 팝업의 '시간' 줄. */
export const formatEventTime = (event: CalendarItem): string => {
  if (event.allDay || !event.startTime) return '종일';
  return event.endTime ? `${event.startTime} ~ ${event.endTime}` : event.startTime;
};

// ---- 구간 만들기 -----------------------------------------------------------

/** 그 날짜가 속한 주의 일요일. 달력이 일요일 시작이라 요일 번호를 그대로 뺀다. */
export const startOfWeek = (dateKey: string): string => (
  shiftDateKey(dateKey, -parseDateKey(dateKey).getDay())
);

export const buildWeekDates = (dateKey: string): string[] => {
  const sunday = startOfWeek(dateKey);
  return Array.from({ length: 7 }, (_, index) => shiftDateKey(sunday, index));
};

/** 월 격자를 주 단위로 자른다. 막대 배치가 '주'를 단위로 돌기 때문이다. */
export const buildMonthWeeks = (year: number, month: number): MonthGridCell[][] => {
  const cells = buildMonthGrid(year, month);
  const weeks: MonthGridCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
};

// ---- 막대 배치 -------------------------------------------------------------

export type CalendarBarSegment<T extends CalendarItem = CalendarItem> = {
  item: T;
  /** 같은 주 안에서 몇 번째 줄인가. 0이 맨 위. */
  lane: number;
  /** 이 주 안에서 차지하는 칸 범위(양끝 포함). */
  startCol: number;
  endCol: number;
  /** 앞/뒤 주로 이어지는가. 잘린 끝을 각지게 그려 "계속됨"을 보여 준다. */
  continuesBefore: boolean;
  continuesAfter: boolean;
};

/**
 * 연속한 날짜 목록(보통 한 주) 위에 일정 막대를 겹치지 않게 깐다.
 *
 * 한 일정은 그 주 안에서 하나의 줄(lane)만 차지한다 — 그래야 여러 칸에 걸친 막대가
 * 한 줄로 이어져 보인다. 줄은 비어 있는 가장 위 칸부터 채운다(그룹웨어 캘린더와 같은 규칙).
 */
export const layoutBarSegments = <T extends CalendarItem>(
  events: T[],
  dates: string[],
): CalendarBarSegment<T>[] => {
  if (dates.length === 0) return [];
  const first = dates[0];
  const last = dates[dates.length - 1];
  const lanes: string[][] = [];
  const segments: CalendarBarSegment<T>[] = [];

  for (const event of [...events].sort(compareCalendarItems)) {
    if (event.end < first || event.start > last) continue;

    // -1은 이 구간 밖에서 시작(끝)한다는 뜻이다. 구간을 벗어난 건은 위에서 걸렀다.
    const startIndex = dates.indexOf(event.start);
    const endIndex = dates.indexOf(event.end);
    const startCol = startIndex === -1 ? 0 : startIndex;
    const endCol = endIndex === -1 ? dates.length - 1 : endIndex;

    let lane = 0;
    for (;;) {
      if (!lanes[lane]) lanes[lane] = [];
      const row = lanes[lane];
      let free = true;
      for (let col = startCol; col <= endCol; col += 1) {
        if (row[col]) { free = false; break; }
      }
      if (free) {
        for (let col = startCol; col <= endCol; col += 1) row[col] = event.id;
        break;
      }
      lane += 1;
    }

    segments.push({
      item: event,
      lane,
      startCol,
      endCol,
      continuesBefore: event.start < first,
      continuesAfter: event.end > last,
    });
  }

  return segments;
};

/** 그 칸에 걸친 막대가 몇 줄까지 쌓였는가. '+N' 표시를 세는 데 쓴다. */
export const countSegmentsAtColumn = (
  segments: CalendarBarSegment<CalendarItem>[],
  column: number,
): number => segments.filter(
  (segment) => segment.startCol <= column && column <= segment.endCol,
).length;

// ---- 시간 격자 배치 --------------------------------------------------------

export type CalendarTimedBlock<T extends CalendarItem = CalendarItem> = {
  item: T;
  startMinutes: number;
  /** 최소 길이(MIN_EVENT_MINUTES)를 보장한 끝. 겹침 판정도 이 값으로 한다. */
  endMinutes: number;
  /** 겹친 일정을 나란히 놓기 위한 열 번호와 그 묶음의 열 개수. */
  columnIndex: number;
  columnCount: number;
};

/**
 * 하루치 시각 일정을 시간 격자에 놓는다.
 *
 * 서로 겹치는 일정들을 한 묶음으로 보고, 묶음 안에서 폭을 나눠 나란히 세운다. 겹치지
 * 않는 일정은 폭을 온전히 쓴다(구글·네이버 캘린더와 같은 규칙).
 */
export const layoutTimedBlocks = <T extends CalendarItem>(
  events: T[],
  dateKey: string,
): CalendarTimedBlock<T>[] => {
  const blocks = events
    .filter((event) => !eventIsBar(event) && event.start === dateKey)
    .map((event) => {
      const startMinutes = minutesOfTime(event.startTime, 0);
      const rawEnd = minutesOfTime(event.endTime, startMinutes + MIN_EVENT_MINUTES);
      return {
        item: event,
        startMinutes,
        endMinutes: Math.min(
          MINUTES_PER_DAY,
          Math.max(rawEnd, startMinutes + MIN_EVENT_MINUTES),
        ),
        columnIndex: 0,
        columnCount: 1,
      };
    })
    .sort((a, b) => (
      a.startMinutes !== b.startMinutes
        ? a.startMinutes - b.startMinutes
        : compareCalendarItems(a.item, b.item)
    ));

  let cluster: CalendarTimedBlock<T>[] = [];
  let clusterEnd = -1;

  const closeCluster = () => {
    if (cluster.length === 0) return;
    const columnCount = Math.max(...cluster.map((block) => block.columnIndex)) + 1;
    for (const block of cluster) block.columnCount = columnCount;
    cluster = [];
  };

  for (const block of blocks) {
    if (block.startMinutes >= clusterEnd) {
      closeCluster();
      clusterEnd = block.endMinutes;
    } else {
      clusterEnd = Math.max(clusterEnd, block.endMinutes);
    }

    // 묶음 안에서 아직 끝나지 않은 일정이 쓰는 열을 피해 가장 왼쪽 열을 잡는다.
    const taken = new Set(
      cluster
        .filter((other) => other.endMinutes > block.startMinutes)
        .map((other) => other.columnIndex),
    );
    let columnIndex = 0;
    while (taken.has(columnIndex)) columnIndex += 1;
    block.columnIndex = columnIndex;
    cluster.push(block);
  }
  closeCluster();

  return blocks;
};
