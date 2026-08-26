/**
 * harness용 가짜 대시보드 상태.
 *
 * 실제 화면은 AuthGate 안에 있어 dev 브라우저에서 열 수 없다. 위젯의 '생김새'
 * (높이를 채우는지, 스크롤이 위젯 안에서만 생기는지, 좁아졌을 때 깨지지 않는지, 빈 상태와
 * 에러 상태가 읽히는지)는 데이터 없이도 확인할 수 있으므로 컨텍스트만 가짜로 채운다.
 *
 * API는 부르지 않는다. useDashboardState가 반환하는 모양만 그대로 맞춰 채운다.
 */

import type { DashboardState } from '../hooks/useDashboardState';
import type {
  PatentDeadlineItem,
  PatentDeadlineResult,
  PatentScheduleEvent,
  PatentStageSummary,
  PatentSummary,
} from '../services/patentRecordApi';
import { getHolidayName as getLocalHolidayName } from '../utils/koreanHolidays';
import { shiftDateKey, toLocalDateKey } from '../utils/patentCalendar';
import {
  compareCalendarItems,
  sanitizeCalendarEventInput,
  type CalendarEvent,
  type CalendarEventInput,
} from '../utils/calendarEvents';
import type { CalendarEventGateway } from '../services/calendarEventApi';

/** 오늘을 기준으로 상대 날짜를 만든다. harness를 언제 열어도 버킷이 같게 나온다. */
const relativeDate = (offset: number): string => (
  shiftDateKey(toLocalDateKey(new Date()), offset)
);

const TARGETS = [
  { target: 'FGFR', count: 42 },
  { target: 'cMET', count: 17 },
  { target: 'EGFR', count: 8 },
];

const deadlineItem = (
  overrides: Partial<PatentDeadlineItem> & { date: string },
): PatentDeadlineItem => ({
  patentId: 1,
  todoId: null,
  internalRef: 'A25W001',
  applicationNumber: '10-2026-0000001',
  patentTitle: '치환된 헤테로아릴 화합물 및 이를 포함하는 약학 조성물',
  todoTitle: null,
  country: 'KR',
  target: 'FGFR',
  type: 'EXPECTED_EXPIRY',
  label: '예상 만료일',
  ...overrides,
});

/**
 * 네 버킷을 모두 채우는 표본. 토요일·공휴일에 걸리는 건을 일부러 섞어 영업일 보정 표시가
 * 나오는지 확인한다(국내 건에만 붙어야 한다).
 */
const DEADLINE_ITEMS: PatentDeadlineItem[] = [
  deadlineItem({
    date: relativeDate(-12),
    patentId: 11,
    todoId: 101,
    todoTitle: '의견서 제출',
    type: 'TODO',
    label: 'To-do 마감일',
    internalRef: 'A25W011',
  }),
  deadlineItem({
    date: relativeDate(-3),
    patentId: 12,
    todoId: 102,
    todoTitle: '보정서 제출',
    type: 'TODO',
    label: 'To-do 마감일',
    internalRef: 'F25W003US',
    country: 'US',
    target: 'cMET',
  }),
  deadlineItem({
    date: relativeDate(0),
    patentId: 13,
    todoId: 103,
    todoTitle: '심사청구 기한 확인',
    type: 'TODO',
    label: 'To-do 마감일',
    internalRef: 'A25W013',
  }),
  deadlineItem({
    date: relativeDate(4),
    patentId: 14,
    internalRef: null,
    applicationNumber: '10-2026-0000014',
    target: null,
  }),
  deadlineItem({
    date: relativeDate(6),
    patentId: 15,
    todoId: 105,
    todoTitle: '연차료 납부',
    type: 'TODO',
    label: 'To-do 마감일',
    internalRef: 'F25W005EP',
    country: 'EP',
    patentTitle: null,
  }),
  deadlineItem({
    date: relativeDate(19),
    patentId: 16,
    internalRef: 'A25W016',
    target: 'EGFR',
  }),
  deadlineItem({
    date: relativeDate(27),
    patentId: 17,
    todoId: 107,
    todoTitle: '분할출원 검토',
    type: 'TODO',
    label: 'To-do 마감일',
    internalRef: 'A25W017',
  }),
];

const DEADLINES: PatentDeadlineResult = {
  from: relativeDate(-365),
  to: relativeDate(30),
  items: DEADLINE_ITEMS,
  // items보다 크게 둬서 "N건 더 있습니다" 줄이 나오는지 확인한다.
  total: DEADLINE_ITEMS.length + 23,
  counts: { overdue: 2, today: 1, within7: 2, within30: 2 },
};

const SUMMARY: PatentSummary = {
  total: 1_284,
  deadlines: DEADLINES.counts,
  expiringWithinYear: 31,
  awaitingRegistration: 7,
  quality: {
    unmappedStatus: 12,
    refParseFailed: 4,
    missingApplicationDate: 2,
    missingExpectedExpiry: 158,
    noTodo: 23,
  },
};

const STAGE_SUMMARY: PatentStageSummary = {
  total: 1_284,
  groups: [
    {
      code: 'PREP',
      label: '출원 준비',
      ordinal: 1,
      count: 30,
      stages: [{
        code: 'FILING_PREP', label: '출원 준비', description: null,
        scope: null, active: true, count: 30,
      }],
    },
    {
      code: 'FILED',
      label: '출원',
      ordinal: 2,
      count: 402,
      stages: [{
        code: 'FILED', label: '출원', description: null,
        scope: null, active: true, count: 402,
      }],
    },
    {
      code: 'EXAM',
      label: '심사',
      ordinal: 3,
      count: 318,
      stages: [
        {
          code: 'EXAM_REQUEST', label: '심사 청구', description: null,
          scope: 'KR,JP', active: true, count: 121,
        },
        {
          code: 'EXAM', label: '심사', description: null,
          scope: null, active: true, count: 197,
        },
      ],
    },
    {
      code: 'RESPONSE',
      label: '대응',
      ordinal: 4,
      count: 96,
      stages: [{
        code: 'OA_RESPONSE', label: 'OA 대응', description: null,
        scope: null, active: true, count: 96,
      }],
    },
    {
      code: 'REG',
      label: '등록',
      ordinal: 5,
      count: 411,
      stages: [
        {
          code: 'ALLOWANCE', label: '등록 결정', description: null,
          scope: null, active: true, count: 7,
        },
        {
          code: 'REGISTERED', label: '등록', description: null,
          scope: null, active: true, count: 404,
        },
      ],
    },
    {
      code: 'CLOSED',
      label: '종결',
      ordinal: 6,
      count: 15,
      stages: [{
        code: 'CLOSED', label: '종결', description: null,
        scope: null, active: true, count: 15,
      }],
    },
  ],
  unmapped: {
    groupCode: 'UNMAPPED',
    count: 12,
    statuses: [
      { legalStatusId: 91, status: '출원 (File closing)', count: 8 },
      { legalStatusId: null, status: null, count: 4 },
    ],
  },
};

export type MockScenario = 'normal' | 'empty' | 'error' | 'loading';

const noop = () => {};

const MOCK_TEAMS = [
  { id: 'team-ip', name: 'IP' },
  { id: 'team-research', name: '연구1' },
];

const MOCK_ME = { id: 'dashboard-harness', name: '나' };

/**
 * 일정 저장소를 메모리로 흉내 낸다.
 *
 * 실제 화면은 서버(`/api/calendar-events`)를 쓰지만 harness는 API를 부르지 않는다. 훅과
 * 달력이 보는 것은 gateway 네 함수뿐이라, 여기서 같은 모양을 채워 주면 등록·수정·삭제까지
 * 손으로 확인할 수 있다. 모듈 수준에 두는 이유는 시나리오(정상·에러…)를 바꿔도 방금 만든
 * 일정이 사라지지 않게 하기 위해서다. 새로고침하면 아래 표본으로 돌아간다.
 */
const mockEvent = (
  input: CalendarEventInput,
  overrides: Partial<CalendarEvent> = {},
): CalendarEvent => {
  const clean = sanitizeCalendarEventInput(input);
  const team = MOCK_TEAMS.find((item) => item.id === clean.teamId) ?? null;
  return {
    id: `mock-${Math.random().toString(36).slice(2, 10)}`,
    ...clean,
    teamName: team?.name ?? null,
    owner: MOCK_ME,
    canEdit: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
};

const seedCalendarEvents = (): CalendarEvent[] => {
  const at = (offset: number) => relativeDate(offset);
  return [
    mockEvent({ title: '[외근] 특허사무소 미팅', start: at(-7), end: at(-7), allDay: false, startTime: '08:00', endTime: '11:00', color: 'purple', memo: null, visibility: 'PRIVATE', teamId: null }),
    mockEvent({ title: '내부 교육', start: at(-7), end: at(-7), allDay: false, startTime: '13:00', endTime: '14:00', color: 'orange', memo: null, visibility: 'PRIVATE', teamId: null }),
    mockEvent({ title: '[휴가] 김가이', start: at(-6), end: at(-5), allDay: true, startTime: null, endTime: null, color: 'teal', memo: null, visibility: 'TEAM', teamId: 'team-ip' }),
    mockEvent({ title: '신입사원 교육', start: at(0), end: at(1), allDay: true, startTime: null, endTime: null, color: 'orange', memo: null, visibility: 'TEAM', teamId: 'team-ip' }),
    mockEvent({ title: '[외근] 송채안', start: at(0), end: at(0), allDay: false, startTime: '08:00', endTime: '10:00', color: 'purple', memo: null, visibility: 'PRIVATE', teamId: null }),
    // 남이 만든 팀 일정. 팝업에 수정·삭제가 없어야 한다.
    mockEvent(
      { title: '[공유] 분기 IP 보고', start: at(3), end: at(3), allDay: false, startTime: '10:00', endTime: '11:00', color: 'blue', memo: null, visibility: 'TEAM', teamId: 'team-ip' },
      { owner: { id: 'other', name: '송채안' }, canEdit: false },
    ),
    mockEvent({ title: '전사 워크숍', start: at(9), end: at(11), allDay: true, startTime: null, endTime: null, color: 'red', memo: null, visibility: 'TEAM', teamId: 'team-research' }),
  ];
};

let mockCalendarEvents = seedCalendarEvents();

const mockCalendarGateway: CalendarEventGateway = {
  // 서버와 같은 조건: 기간이 겹치는 것(시작일만 보지 않는다).
  list: async (from, to) => mockCalendarEvents
    .filter((event) => event.start <= to && event.end >= from)
    .sort(compareCalendarItems),
  create: async (input) => {
    const event = mockEvent(input);
    mockCalendarEvents = [...mockCalendarEvents, event];
    return event;
  },
  update: async (id, input) => {
    const next = mockEvent(input, { id });
    mockCalendarEvents = mockCalendarEvents.map(
      (event) => (event.id === id ? { ...next, createdAt: event.createdAt } : event),
    );
    return next;
  },
  remove: async (id) => {
    mockCalendarEvents = mockCalendarEvents.filter((event) => event.id !== id);
    return { id };
  },
};

/**
 * 달력에 겹쳐 그릴 특허 일정 표본.
 *
 * 실제 조회는 달 단위라 harness도 같은 모양으로 흉내 낸다 — 어느 달을 보든 그 달의
 * 며칠에 일정이 찍히게 만들어, 달을 넘겨 봐도 빈 격자만 보이지 않게 한다.
 */
const mockPatentScheduleEvents = (year: number, month: number): PatentScheduleEvent[] => {
  const day = (value: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(value).padStart(2, '0')}`;

  const base = {
    patentId: 11,
    internalRef: 'A25W011',
    applicationNumber: '10-2026-0000011',
    title: '치환된 헤테로아릴 화합물 및 이를 포함하는 약학 조성물',
    country: 'KR',
    target: 'FGFR',
  };

  return [
    { ...base, type: 'APPLICATION', label: '출원일', date: day(4) },
    { ...base, patentId: 12, internalRef: 'A25W012', applicationNumber: '10-2026-0000012', type: 'PUBLICATION', label: '공개일', date: day(11) },
    { ...base, patentId: 13, internalRef: 'F25W003US', applicationNumber: '17/123,456', country: 'US', type: 'EXAM', label: '심사일', date: day(18) },
    { ...base, patentId: 14, internalRef: 'A25W014', applicationNumber: '10-2026-0000014', type: 'REGISTRATION', label: '등록일', date: day(19) },
    {
      ...base,
      patentId: 15,
      internalRef: 'A25W015',
      applicationNumber: '10-2026-0000015',
      todoId: 501,
      title: '의견서 제출',
      type: 'TODO',
      label: 'To-do 마감일',
      date: day(21),
    },
    { ...base, patentId: 16, internalRef: 'A25W016', applicationNumber: '10-2026-0000016', type: 'EXPECTED_EXPIRY', label: '예상 만료일', date: day(26) },
  ];
};

/**
 * harness가 고른 시나리오로 컨텍스트를 만든다.
 *
 * `empty`와 `error`를 따로 두는 이유: 데이터가 있는 화면만 보면 정작 사용자가 처음 만나는
 * 두 상태(아직 아무것도 없음 / 못 불러옴)가 검증되지 않는다.
 */
export const buildMockDashboardState = (
  scenario: MockScenario,
  overrides: Partial<DashboardState> = {},
): DashboardState => {
  const isEmpty = scenario === 'empty';
  const isError = scenario === 'error';
  const isLoading = scenario === 'loading';

  const emptySummary: PatentSummary = {
    total: 0,
    deadlines: { overdue: 0, today: 0, within7: 0, within30: 0 },
    expiringWithinYear: 0,
    awaitingRegistration: 0,
    quality: {
      unmappedStatus: 0,
      refParseFailed: 0,
      missingApplicationDate: 0,
      missingExpectedExpiry: 0,
      noTodo: 0,
    },
  };

  const summary = isError ? null : isEmpty ? emptySummary : SUMMARY;
  const deadlines = isError
    ? null
    : isEmpty
      ? { from: relativeDate(-365), to: relativeDate(30), items: [], total: 0, counts: emptySummary.deadlines }
      : DEADLINES;

  return {
    // 배치 저장 키. harness 전용 값이라 실제 사용자의 배치와 섞이지 않는다.
    userId: MOCK_ME.id,
    teams: MOCK_TEAMS,
    calendarGateway: mockCalendarGateway,
    refreshToken: 0,
    canRead: true,
    canManage: true,

    targets: isEmpty ? [] : TARGETS,
    selectedTargets: [],
    setSelectedTargets: noop,
    toggleTarget: noop,

    summary,
    summaryLoading: isLoading,
    summaryError: isError ? '집계 조회에 실패했습니다.' : '',

    deadlines,
    deadlinesLoading: isLoading,
    deadlinesError: isError ? '마감 조회에 실패했습니다.' : '',

    stageSummary: isError ? null : isEmpty ? { total: 0, groups: [], unmapped: { groupCode: 'UNMAPPED', count: 0, statuses: [] } } : STAGE_SUMMARY,
    stagesLoading: isLoading,
    stagesError: isError ? '진행 현황 조회에 실패했습니다.' : '',

    focusedBucket: null,
    focusDeadlineBucket: noop,

    loadPatentScheduleEvents: async (year: number, month: number) => {
      if (isError) throw new Error('특허 일정 조회에 실패했습니다.');
      return isEmpty ? [] : mockPatentScheduleEvents(year, month);
    },

    kpiTiles: [
      { key: 'total', label: '관리 특허', value: summary?.total ?? 0, tone: 'neutral', to: '/patent-management' },
      { key: 'overdue', label: '지연 마감', value: summary?.deadlines.overdue ?? 0, tone: 'danger', focusBucket: 'overdue' },
      { key: 'today', label: '오늘 마감', value: summary?.deadlines.today ?? 0, tone: 'warn', focusBucket: 'today' },
      { key: 'within7', label: '7일 내 마감', value: summary?.deadlines.within7 ?? 0, tone: 'warn', focusBucket: 'within7' },
      { key: 'awaitingRegistration', label: '등록 대기', value: summary?.awaitingRegistration ?? 0, tone: 'neutral', to: '/patent-management?stageCode=ALLOWANCE' },
      { key: 'expiringWithinYear', label: '만료 임박 (1년)', value: summary?.expiringWithinYear ?? 0, tone: 'neutral' },
    ],
    navigateTo: noop,
    // harness는 API를 부르지 않는다. useHolidayName의 폴백과 같은 로컬 표를 그대로 쓰므로
    // 영업일 보정 표시가 실제 화면과 같은 결과로 검증된다.
    getHolidayName: getLocalHolidayName,
    refresh: noop,

    openPatentList: noop,
    openQualityList: noop,
    openCodeAdmin: noop,
    openDeadline: noop,

    ...overrides,
  };
};
