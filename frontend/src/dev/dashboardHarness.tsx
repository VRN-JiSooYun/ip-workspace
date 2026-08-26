/**
 * 대시보드 검증용 harness. 개발 전용이고 앱 번들에는 들어가지 않는다
 * (dashboard-harness.html에서만 진입한다).
 *
 * 실제 화면은 모든 라우트가 AuthGate 안에 있어 dev 브라우저에서 Groupware 로그인에
 * 막힌다. 그래서 위젯만 떼어 여기서 조작해 본다. workspaceHarness와 같은 구조로
 * 두 가지를 함께 낸다.
 *   1) 실제 위젯을 올린 MovableGrid — 손으로 끌고 붙이고 좁혀 보는 용도
 *   2) 순수 함수 단정(assert) 결과 — 경계값은 손으로 재현하기 어려워 코드로 확인한다
 */

import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntApp, Button, ConfigProvider, Segmented, theme } from 'antd';
import MovableGrid from '../components/workspace/MovableGrid';
import { DashboardProvider } from '../components/dashboard/DashboardContext';
import { DASHBOARD_PANEL_COMPONENTS } from '../components/dashboard/panels';
import { DEADLINE_BUCKETS } from '../components/dashboard/widgets/DeadlineBoard';
import {
  DASHBOARD_LAYOUT_SCHEMA_VERSION,
  DASHBOARD_PANEL_META,
  DASHBOARD_PANEL_TYPES,
  DASHBOARD_STACK_BREAKPOINT,
  buildDefaultDashboardLayout,
  getDashboardLayoutStorageKey,
  isDashboardPanelTypeId,
  readDashboardLayout,
  removeDashboardLayout,
  writeDashboardLayout,
} from '../config/dashboardLayout';
import {
  collectMountedTabs,
  makePanelNode,
  makeSplitNode,
  removeTabAnywhere,
  type LayoutNode,
} from '../lib/layoutTree';
import { nextBusinessDay, shiftDateKey } from '../utils/patentCalendar';
import {
  buildWeekDates,
  layoutBarSegments,
  layoutTimedBlocks,
  sanitizeCalendarEventInput,
  startOfWeek,
  type CalendarEvent,
} from '../utils/calendarEvents';
import {
  monthKeysOfDates,
  toPatentEntry,
  toUserEntry,
} from '../utils/scheduleEntries';
import type { PatentScheduleEvent } from '../services/patentRecordApi';
import {
  buildPatentListQuery,
  readPatentListQueryParams,
} from '../utils/patentListQueryParams';
import { buildMockDashboardState, type MockScenario } from './dashboardMock';
import '../index.css';
import '../styles/dday.css';
// 위젯 안쪽 스타일. 실제 화면과 같은 규칙으로 그려야 확인하는 의미가 있다.
import '../components/dashboard/dashboard.css';
import '../pages/Dashboard.css';

const HARNESS_USER = 'dashboard-harness';
/** 저장 단정은 별도 키를 쓴다. HARNESS_USER를 쓰면 검증이 화면의 배치를 지워 버린다. */
const STORAGE_CHECK_USER = 'dashboard-harness-storage-check';

// ---- 순수 함수 단정 -------------------------------------------------------

type Check = { name: string; pass: boolean; detail: string };

/**
 * 배치를 id 없이 직렬화한다.
 *
 * makeNodeId()는 호출마다 새 UUID를 준다. 그래서 buildDefaultDashboardLayout()를 두 번
 * 부르면 모양은 같아도 JSON이 달라진다. 여기서 보고 싶은 것은 "같은 배치인가"이므로
 * 노드 id는 빼고 견준다.
 */
const shapeOf = (node: LayoutNode): string => JSON.stringify(
  node,
  (key, value) => (key === 'id' ? undefined : value),
);

/** 기본 배치와 모양이 같은가. 폴백 단정 네 곳이 함께 쓴다. */
const isDefaultShape = (node: LayoutNode): boolean => (
  shapeOf(node) === shapeOf(buildDefaultDashboardLayout())
);

/**
 * 단정에서 쓰는 일정 한 건.
 *
 * 일정은 이제 서버가 만든다(id·작성자·시각 도장). 배치 계산이 보는 것은 날짜와 시각뿐이라
 * 나머지는 그럴듯한 값으로 채운다.
 */
let checkEventSeq = 0;
const checkEvent = (
  overrides: Partial<CalendarEvent> & { start: string; end: string },
): CalendarEvent => {
  checkEventSeq += 1;
  return {
    id: `check-${checkEventSeq}`,
    title: '일정',
    allDay: true,
    startTime: null,
    endTime: null,
    color: 'purple',
    memo: null,
    visibility: 'PRIVATE',
    teamId: null,
    teamName: null,
    owner: { id: 'me', name: '나' },
    canEdit: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
};

const runChecks = (): Check[] => {
  const checks: Check[] = [];
  const expect = (name: string, pass: boolean, detail = '') => {
    checks.push({ name, pass, detail });
  };

  // ---- 배치 저장·복원 ----
  {
    const key = getDashboardLayoutStorageKey(STORAGE_CHECK_USER);
    const custom = makeSplitNode(
      'row',
      0.3,
      makePanelNode(['kpi']),
      makePanelNode(['deadlines', 'dataQuality'], 'dataQuality'),
    );

    writeDashboardLayout(STORAGE_CHECK_USER, custom);
    const restored = readDashboardLayout(STORAGE_CHECK_USER);
    expect(
      '저장한 배치를 그대로 복원한다',
      JSON.stringify(restored) === JSON.stringify(custom),
      shapeOf(restored),
    );

    // 스키마 버전이 다르면 기본값으로.
    window.localStorage.setItem(key, JSON.stringify({
      schemaVersion: DASHBOARD_LAYOUT_SCHEMA_VERSION + 1,
      tree: custom,
    }));
    expect(
      '스키마 버전이 다르면 기본 배치로 되돌린다',
      isDefaultShape(readDashboardLayout(STORAGE_CHECK_USER)),
    );

    // 깨진 JSON.
    window.localStorage.setItem(key, '{not json');
    expect(
      '깨진 저장값이면 기본 배치로 되돌린다',
      isDefaultShape(readDashboardLayout(STORAGE_CHECK_USER)),
    );

    // KPI 패널이 없는 트리 → 기본값. (닫을 수 없는 패널이라 정상 경로로는 안 생긴다)
    const withoutKpi = removeTabAnywhere(custom, 'kpi');
    window.localStorage.setItem(key, JSON.stringify({
      schemaVersion: DASHBOARD_LAYOUT_SCHEMA_VERSION,
      tree: withoutKpi,
    }));
    expect(
      'KPI 패널이 없는 배치는 기본값으로 되돌린다',
      isDefaultShape(readDashboardLayout(STORAGE_CHECK_USER)),
    );

    // 모르는 위젯 id는 정규화가 걷어낸다.
    window.localStorage.setItem(key, JSON.stringify({
      schemaVersion: DASHBOARD_LAYOUT_SCHEMA_VERSION,
      tree: makeSplitNode('row', 0.5, makePanelNode(['kpi']), makePanelNode(['ghostWidget'])),
    }));
    const cleaned = readDashboardLayout(STORAGE_CHECK_USER);
    expect(
      '모르는 위젯 id는 복원에서 걷어낸다',
      !collectMountedTabs(cleaned).includes('ghostWidget'),
      collectMountedTabs(cleaned).join(', '),
    );

    removeDashboardLayout(STORAGE_CHECK_USER);
    expect(
      '초기화하면 기본 배치를 준다',
      isDefaultShape(readDashboardLayout(STORAGE_CHECK_USER)),
    );
  }

  // ---- 기본 배치가 무엇을 올리는가 ----
  {
    const mounted = collectMountedTabs(buildDefaultDashboardLayout()).sort();
    // 데이터 품질은 점검용이라 기본에서 뺐다. 나머지 위젯은 처음부터 보여야 한다.
    const expected = DASHBOARD_PANEL_TYPES.filter((id) => id !== 'dataQuality').sort();
    expect(
      `기본 배치에 위젯 ${expected.length}종이 올라간다(데이터 품질 제외)`,
      JSON.stringify(mounted) === JSON.stringify(expected),
      mounted.join(', '),
    );
    // 기본에서 뺀 위젯도 탭 목록에는 남아 있어야 사용자가 꺼내 붙일 수 있다.
    expect(
      '데이터 품질은 기본에 없지만 붙일 수는 있다',
      !mounted.includes('dataQuality') && DASHBOARD_PANEL_TYPES.includes('dataQuality'),
    );
    expect(
      'KPI만 닫을 수 없다',
      DASHBOARD_PANEL_TYPES.filter((id) => !DASHBOARD_PANEL_META[id].closable).join(',') === 'kpi',
    );
  }

  // ---- 마감 버킷이 서로 겹치지 않는가 ----
  {
    // -400 ~ +400일까지 훑어 어떤 D-day도 두 버킷에 동시에 들어가지 않음을 확인한다.
    let overlaps = 0;
    let uncovered = 0;
    for (let days = -400; days <= 400; days += 1) {
      const hits = DEADLINE_BUCKETS.filter((bucket) => bucket.match(days)).length;
      if (hits > 1) overlaps += 1;
      // 31일 이후는 조회 범위 밖이라 어느 버킷에도 안 들어가는 게 정상이다.
      if (hits === 0 && days <= 30) uncovered += 1;
    }
    expect('버킷이 서로 겹치지 않는다', overlaps === 0, `겹침 ${overlaps}건`);
    expect(
      '조회 범위(−∞ ~ +30일) 안은 빈틈이 없다',
      uncovered === 0,
      `빈틈 ${uncovered}건`,
    );
  }

  // ---- 영업일 보정 ----
  {
    // 2026-08-22는 토요일, 2026-08-23은 일요일 → 다음 영업일은 24(월).
    expect(
      '토요일 마감은 다음 월요일로 보정한다',
      nextBusinessDay('2026-08-22', () => false) === '2026-08-24',
      String(nextBusinessDay('2026-08-22', () => false)),
    );
    expect(
      '평일 마감은 보정하지 않는다(null)',
      nextBusinessDay('2026-08-24', () => false) === null,
    );
    // 월요일이 공휴일이면 화요일로 밀린다.
    expect(
      '보정 대상일이 공휴일이면 한 칸 더 밀린다',
      nextBusinessDay('2026-08-22', (key) => key === '2026-08-24') === '2026-08-25',
      String(nextBusinessDay('2026-08-22', (key) => key === '2026-08-24')),
    );
    // 전부 휴일이면 보정을 포기한다(틀린 날짜를 자신 있게 보여 주지 않는다).
    expect(
      '끝없는 연휴면 보정을 포기한다(null)',
      nextBusinessDay('2026-08-22', () => true) === null,
    );
  }

  // ---- 날짜 이동 ----
  {
    expect(
      '월 경계를 넘어 날짜를 옮긴다',
      shiftDateKey('2026-08-31', 1) === '2026-09-01',
      shiftDateKey('2026-08-31', 1),
    );
    expect(
      '연 경계를 거꾸로 넘는다',
      shiftDateKey('2026-01-01', -1) === '2025-12-31',
      shiftDateKey('2026-01-01', -1),
    );
    expect(
      '윤년 2월을 넘는다',
      shiftDateKey('2028-02-28', 1) === '2028-02-29',
      shiftDateKey('2028-02-28', 1),
    );
  }

  // ---- 딥링크 query 왕복 ----
  {
    const seed = {
      q: 'FGFR',
      targets: ['FGFR', 'cMET'],
      stageGroup: 'EXAM',
      stageCode: 'EXAM_REQUEST',
      countryId: 1,
      countryText: 'KR',
      legalStatusId: 2,
      legalStatusText: '등록',
      examStatusId: 3,
      examStatusText: '심사청구',
      quality: 'refParseFailed' as const,
    };
    const parsed = readPatentListQueryParams(
      new URLSearchParams(buildPatentListQuery(seed)),
    );
    expect(
      '만든 query를 그대로 다시 읽는다',
      parsed.q === seed.q
        && JSON.stringify(parsed.targets) === JSON.stringify(seed.targets)
        && parsed.stageGroup === seed.stageGroup
        && parsed.filters.stageCode === seed.stageCode
        && parsed.filters.countryId === seed.countryId
        && parsed.filters.countryText === seed.countryText
        && parsed.filters.legalStatusId === seed.legalStatusId
        && parsed.filters.legalStatusText === seed.legalStatusText
        && parsed.filters.examStatusId === seed.examStatusId
        && parsed.filters.examStatusText === seed.examStatusText
        && parsed.filters.quality === seed.quality,
      JSON.stringify(parsed),
    );

    expect(
      '빈 seed는 빈 query가 된다',
      buildPatentListQuery({}) === '',
      buildPatentListQuery({}),
    );

    const junk = readPatentListQueryParams(
      new URLSearchParams('countryId=abc&legalStatusId=0&examStatusId=-3&quality=nope&q=%20%20'),
    );
    expect(
      '형식이 깨진 값은 조용히 버린다',
      Object.keys(junk.filters).length === 0 && junk.q === undefined,
      JSON.stringify(junk),
    );

    const trimmed = readPatentListQueryParams(
      new URLSearchParams('targets=FGFR&targets=%20%20&targets=cMET'),
    );
    expect(
      '빈 Target 항목은 걸러낸다',
      JSON.stringify(trimmed.targets) === JSON.stringify(['FGFR', 'cMET']),
      JSON.stringify(trimmed.targets),
    );
  }

  // ---- 일정 막대 배치 ----
  {
    const week = buildWeekDates('2026-08-25');
    expect(
      '주는 일요일에서 시작한다',
      week[0] === '2026-08-23' && week[6] === '2026-08-29',
      week.join(', '),
    );
    expect(
      '일요일에 물어도 그 주의 일요일을 준다',
      startOfWeek('2026-08-23') === '2026-08-23',
    );

    const sample = (overrides: Partial<CalendarEvent> & { start: string; end: string }): CalendarEvent =>
      checkEvent(overrides);

    // 같은 날 겹치는 두 일정은 서로 다른 줄에, 겹치지 않으면 같은 줄(0)에 놓인다.
    const overlapping = [
      sample({ start: '2026-08-24', end: '2026-08-26', title: 'A' }),
      sample({ start: '2026-08-25', end: '2026-08-25', title: 'B' }),
      sample({ start: '2026-08-28', end: '2026-08-28', title: 'C' }),
    ];
    const segments = layoutBarSegments(overlapping, week);
    const laneOf = (title: string) =>
      segments.find((segment) => segment.item.title === title)?.lane;
    expect(
      '겹치는 일정은 다른 줄에, 겹치지 않으면 맨 윗줄에 놓인다',
      laneOf('A') === 0 && laneOf('B') === 1 && laneOf('C') === 0,
      `A=${laneOf('A')}, B=${laneOf('B')}, C=${laneOf('C')}`,
    );

    // 주를 넘어가는 일정은 이 주 안에서만 잘리고, 잘렸다는 표시가 남는다.
    const across = layoutBarSegments([sample({ start: '2026-08-20', end: '2026-09-02' })], week)[0];
    expect(
      '주 밖으로 이어지는 일정은 주 경계에서 잘린다',
      across?.startCol === 0
        && across?.endCol === 6
        && across.continuesBefore
        && across.continuesAfter,
      JSON.stringify(across && {
        startCol: across.startCol,
        endCol: across.endCol,
        before: across.continuesBefore,
        after: across.continuesAfter,
      }),
    );

    expect(
      '구간 밖의 일정은 막대를 만들지 않는다',
      layoutBarSegments([sample({ start: '2026-09-10', end: '2026-09-10' })], week).length === 0,
    );
  }

  // ---- 시간 격자 겹침 ----
  {
    const timed = (title: string, startTime: string, endTime: string) => checkEvent({
      title,
      start: '2026-08-25',
      end: '2026-08-25',
      allDay: false,
      startTime,
      endTime,
      color: 'blue',
    });

    const blocks = layoutTimedBlocks(
      [timed('A', '09:00', '10:30'), timed('B', '10:00', '11:00'), timed('C', '13:00', '14:00')],
      '2026-08-25',
    );
    const blockOf = (title: string) => blocks.find((block) => block.item.title === title);
    expect(
      '겹친 시각 일정은 폭을 나눠 나란히 선다',
      blockOf('A')?.columnCount === 2
        && blockOf('B')?.columnCount === 2
        && blockOf('A')?.columnIndex !== blockOf('B')?.columnIndex,
      `A=${blockOf('A')?.columnIndex}/${blockOf('A')?.columnCount}, B=${blockOf('B')?.columnIndex}/${blockOf('B')?.columnCount}`,
    );
    expect(
      '겹치지 않는 일정은 폭을 온전히 쓴다',
      blockOf('C')?.columnCount === 1,
    );
    expect(
      '분 단위 좌표로 옮긴다(09:00 → 540분)',
      blockOf('A')?.startMinutes === 540,
      String(blockOf('A')?.startMinutes),
    );
    expect(
      '종일 일정은 시간 격자에 놓이지 않는다',
      layoutTimedBlocks(
        [checkEvent({ title: '종일', start: '2026-08-25', end: '2026-08-25' })],
        '2026-08-25',
      ).length === 0,
    );
  }

  // ---- 입력 다듬기 ----
  {
    const scope = { visibility: 'PRIVATE' as const, teamId: null };
    const flipped = sanitizeCalendarEventInput({
      ...scope,
      title: '  회의  ',
      start: '2026-08-27',
      end: '2026-08-25',
      allDay: false,
      startTime: '15:00',
      endTime: '09:00',
      color: 'teal',
      memo: '   ',
    });
    expect(
      '거꾸로 된 기간은 뒤집고 제목은 다듬는다',
      flipped.start === '2026-08-25' && flipped.end === '2026-08-27' && flipped.title === '회의',
      JSON.stringify(flipped),
    );
    expect(
      '여러 날 일정은 끝 시각이 앞서도 그대로 둔다(다음 날이므로)',
      flipped.startTime === '15:00' && flipped.endTime === '09:00',
    );

    const sameDay = sanitizeCalendarEventInput({
      ...scope,
      title: '점심',
      start: '2026-08-25',
      end: '2026-08-25',
      allDay: false,
      startTime: '13:00',
      endTime: '12:00',
      color: 'blue',
      memo: null,
    });
    expect(
      '같은 날 안에서 거꾸로 된 시각은 뒤집는다',
      sameDay.startTime === '12:00' && sameDay.endTime === '13:00',
      `${sameDay.startTime} ~ ${sameDay.endTime}`,
    );

    const noTime = sanitizeCalendarEventInput({
      ...scope,
      title: '휴가',
      start: '2026-08-25',
      end: '2026-08-25',
      allDay: false,
      startTime: null,
      endTime: null,
      color: 'red',
      memo: null,
    });
    expect(
      '시각이 없으면 종일로 되돌린다',
      noTime.allDay && noTime.startTime === null,
    );
  }

  // ---- 공개 범위 ----
  {
    const shared = sanitizeCalendarEventInput({
      title: '팀 회의',
      start: '2026-08-25',
      end: '2026-08-25',
      allDay: true,
      startTime: null,
      endTime: null,
      color: 'blue',
      memo: null,
      visibility: 'TEAM',
      teamId: 'team-ip',
    });
    expect(
      '팀 공개는 팀과 함께 남는다',
      shared.visibility === 'TEAM' && shared.teamId === 'team-ip',
      JSON.stringify({ visibility: shared.visibility, teamId: shared.teamId }),
    );

    // 서버도 같은 규칙을 다시 본다. 화면에서 먼저 거르는 것은 400을 받기 전에 고치기 위해서다.
    const teamless = sanitizeCalendarEventInput({
      ...shared,
      teamId: null,
    });
    expect(
      '팀 없는 팀 공개는 비공개로 되돌린다',
      teamless.visibility === 'PRIVATE' && teamless.teamId === null,
      JSON.stringify({ visibility: teamless.visibility, teamId: teamless.teamId }),
    );

    const madePrivate = sanitizeCalendarEventInput({
      ...shared,
      visibility: 'PRIVATE',
    });
    expect(
      '비공개로 되돌리면 팀 연결도 끊는다',
      madePrivate.teamId === null,
      String(madePrivate.teamId),
    );
  }

  // ---- 특허 일정 겹쳐 보기 ----
  {
    const patentEvent = (overrides: Partial<PatentScheduleEvent> & { date: string }): PatentScheduleEvent => ({
      patentId: 11,
      internalRef: 'A25W011',
      applicationNumber: '10-2026-0000011',
      title: '치환된 헤테로아릴 화합물',
      country: 'KR',
      target: 'FGFR',
      type: 'APPLICATION',
      label: '출원일',
      ...overrides,
    });

    const application = toPatentEntry(patentEvent({ date: '2026-08-25' }));
    expect(
      '특허 일정은 종일 하루짜리로 놓인다',
      application.allDay
        && application.start === '2026-08-25'
        && application.end === '2026-08-25'
        && application.source === 'patent',
      JSON.stringify({ start: application.start, end: application.end }),
    );
    expect(
      '특허 일정 막대에는 날짜 이름과 내부관리번호가 함께 나온다',
      application.title === '출원일 · A25W011',
      application.title,
    );

    // To-do는 label이 'To-do 마감일'로 고정이라, 무엇 때문의 마감인지는 title에만 있다.
    const todo = toPatentEntry(patentEvent({
      date: '2026-08-25',
      todoId: 501,
      type: 'TODO',
      label: 'To-do 마감일',
      title: '의견서 제출',
    }));
    expect(
      'To-do는 마감 이름 대신 To-do 제목을 보여 준다',
      todo.title === '의견서 제출 · A25W011',
      todo.title,
    );

    // 같은 특허가 같은 날 두 종류의 일정을 가질 수 있다. id가 겹치면 하나가 사라진다.
    const sameDay = toPatentEntry(patentEvent({
      date: '2026-08-25',
      type: 'EXPECTED_EXPIRY',
      label: '예상 만료일',
    }));
    expect(
      '같은 특허·같은 날의 다른 일정은 id가 겹치지 않는다',
      application.id !== sameDay.id && application.id !== todo.id,
      `${application.id} / ${sameDay.id} / ${todo.id}`,
    );

    // 내 일정과 특허 일정이 한 격자에서 같은 규칙으로 배치된다.
    const mine = toUserEntry(checkEvent({
      title: '내 일정',
      start: '2026-08-25',
      end: '2026-08-25',
      color: 'blue',
    }));
    const mixed = layoutBarSegments([mine, application], buildWeekDates('2026-08-25'));
    expect(
      '내 일정과 특허 일정이 같은 날에서 서로 다른 줄을 받는다',
      mixed.length === 2 && mixed[0].lane !== mixed[1].lane,
      mixed.map((segment) => `${segment.item.title}=${segment.lane}`).join(', '),
    );

    expect(
      '보이는 날짜가 걸치는 달만 골라 낸다',
      JSON.stringify(monthKeysOfDates(['2026-07-30', '2026-08-01', '2026-08-31', '2026-09-01']))
        === JSON.stringify(['2026-07', '2026-08', '2026-09']),
      monthKeysOfDates(['2026-07-30', '2026-08-01']).join(', '),
    );
  }

  return checks;
};

// ---- 화면 ------------------------------------------------------------------

const SCENARIOS: MockScenario[] = ['normal', 'empty', 'error', 'loading'];
const SCENARIO_LABELS: Record<MockScenario, string> = {
  normal: '정상',
  empty: '빈 상태',
  error: '에러',
  loading: '로딩',
};

const Harness: React.FC = () => {
  const [root, setRoot] = useState<LayoutNode>(() => readDashboardLayout(HARNESS_USER));
  const [scenario, setScenario] = useState<MockScenario>('normal');
  const [dark, setDark] = useState(false);
  const [checksOpen, setChecksOpen] = useState(false);

  const checks = useMemo(runChecks, []);
  const failed = checks.filter((check) => !check.pass);

  const mockState = useMemo(() => buildMockDashboardState(scenario), [scenario]);

  const apply = (next: LayoutNode | null) => {
    const tree = next ?? buildDefaultDashboardLayout();
    setRoot(tree);
    writeDashboardLayout(HARNESS_USER, tree);
  };

  return (
    <ConfigProvider
      theme={{ algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm }}
    >
      <AntApp>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            background: 'var(--bg-color)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              padding: '8px 12px',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            <button
              type="button"
              onClick={() => setChecksOpen((open) => !open)}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 12,
                color: failed.length === 0 ? '#047857' : '#dc2626',
              }}
            >
              {failed.length === 0
                ? `${checks.length} checks passed`
                : `${failed.length} / ${checks.length} failed`}
            </button>
            <Segmented
              size="small"
              value={scenario}
              onChange={(value) => setScenario(value as MockScenario)}
              options={SCENARIOS.map((value) => ({
                value,
                label: SCENARIO_LABELS[value],
              }))}
            />
            <Segmented
              size="small"
              value={dark ? 'dark' : 'light'}
              onChange={(value) => setDark(value === 'dark')}
              options={[
                { value: 'light', label: '라이트' },
                { value: 'dark', label: '다크' },
              ]}
            />
            <Button
              size="small"
              onClick={() => {
                removeDashboardLayout(HARNESS_USER);
                setRoot(buildDefaultDashboardLayout());
              }}
            >
              배치 초기화
            </Button>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              위젯을 끌어 옮기고 창을 {DASHBOARD_STACK_BREAKPOINT}px 아래로 좁혀 보세요.
              새로고침하면 배치가 유지됩니다.
            </span>
          </div>

          {checksOpen ? (
            <div
              style={{
                maxHeight: 260,
                overflow: 'auto',
                padding: '8px 12px',
                borderBottom: '1px solid var(--border-color)',
                fontSize: 12,
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              {checks.map((check) => (
                <div key={check.name} style={{ padding: '2px 0' }}>
                  <span style={{ color: check.pass ? '#047857' : '#dc2626' }}>
                    {check.pass ? 'PASS' : 'FAIL'}
                  </span>
                  {'  '}
                  {check.name}
                  {check.detail ? (
                    <span style={{ color: 'var(--text-secondary)' }}>{`  — ${check.detail}`}</span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <div className="db-page" style={{ flex: 1, minHeight: 0 }}>
            <DashboardProvider value={mockState}>
              <MovableGrid
                root={root}
                onChange={apply}
                allTabs={DASHBOARD_PANEL_TYPES}
                describeTab={(tabId) => {
                  const meta = isDashboardPanelTypeId(tabId)
                    ? DASHBOARD_PANEL_META[tabId]
                    : undefined;
                  return meta ?? { title: tabId, closable: true, minWidth: 200, minHeight: 120 };
                }}
                renderTab={(tabId) => {
                  if (!isDashboardPanelTypeId(tabId)) return null;
                  const Panel = DASHBOARD_PANEL_COMPONENTS[tabId];
                  return <Panel />;
                }}
                stackBreakpoint={DASHBOARD_STACK_BREAKPOINT}
              />
            </DashboardProvider>
          </div>
        </div>
      </AntApp>
    </ConfigProvider>
  );
};

const container = document.getElementById('root');
if (container) createRoot(container).render(<Harness />);
