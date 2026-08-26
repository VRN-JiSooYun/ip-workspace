/**
 * 우측 상시 레일 검증용 harness. 개발 전용이고 앱 번들에는 들어가지 않는다
 * (rail-harness.html에서만 진입한다).
 *
 * 다른 harness와 다른 점: 레일 패널은 스스로 조회하므로 컨텍스트를 가짜로 채우는 것으로는
 * 부족하다. 그래서 **네트워크 경계(fetch)만** 스텁하고 그 위(서비스 계층·권한 컨텍스트·
 * 패널 컴포넌트)는 전부 실제 코드를 쓴다. 확인하고 싶은 것이 "실제 응답을 받았을 때 어떻게
 * 그려지는가"이기 때문이다.
 */

import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntApp, ConfigProvider, Segmented, theme } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import RightSidebar from '../components/layout/RightSidebar';
import { AccessContextProvider } from '../contexts/AccessContext';
import {
  RAIL_DEFAULT_WIDTH,
  RAIL_MIN_WIDTH,
  RIGHT_RAIL_ITEMS,
  useRightSidebarStore,
} from '../store/useRightSidebarStore';
import type { PatentSearchItem } from '../services/patentSearchApi';
import {
  buildDocumentNodes,
  buildTimelineEntries,
  dateGroupLeaders,
  parseDateFromDocumentPath,
} from '../components/patent-management/patentDocumentNodes';
import { shiftDateKey, toLocalDateKey } from '../utils/patentCalendar';
import '../index.css';
import '../styles/dday.css';

// ---- fetch 스텁 -----------------------------------------------------------

const today = toLocalDateKey(new Date());
const at = (offset: number) => shiftDateKey(today, offset);

const ACCESS_CONTEXT = {
  userId: 'harness-user',
  globalRoles: ['SUPER_ADMIN'],
  organization: { id: 'org', name: 'Harness Org' },
  teams: [{ id: 'team', name: 'Harness Team' }],
  permissions: ['patentAnalysis.read', 'patentAnalysis.manage'],
  modules: {
    patentAnalysis: { read: true, write: true, manage: true },
    sarTable: { read: false, write: false, manage: false },
    design: { read: false, write: false, manage: false },
    synthesis: { read: false, write: false, manage: false },
  },
};

const scheduleEvent = (
  date: string,
  type: string,
  label: string,
  overrides: Record<string, unknown> = {},
) => ({
  patentId: 1,
  internalRef: 'A25W001',
  applicationNumber: '10-2026-0000001',
  title: '치환된 헤테로아릴 화합물',
  country: 'KR',
  target: 'FGFR',
  type,
  label,
  date,
  ...overrides,
});

const SCHEDULE_RESPONSE = () => ({
  year: Number(today.slice(0, 4)),
  month: Number(today.slice(5, 7)),
  events: [
    scheduleEvent(at(-6), 'APPLICATION', '출원일'),
    scheduleEvent(at(-2), 'PUBLICATION', '공개일', { internalRef: 'A25W002', country: 'US' }),
    scheduleEvent(today, 'TODO', 'To-do 마감일', { todoId: 11, title: '의견서 제출' }),
    scheduleEvent(at(3), 'EXAM', '심사일', { internalRef: 'A25W003' }),
    scheduleEvent(at(3), 'EXPECTED_EXPIRY', '예상 만료일', { internalRef: 'A25W004', country: 'EP' }),
  ],
  todos: [],
  todoTotal: 4,
});

const todoItem = (
  offset: number,
  title: string,
  overrides: Record<string, unknown> = {},
) => ({
  patentId: 1,
  todoId: 100 + offset,
  internalRef: 'A25W001',
  applicationNumber: '10-2026-0000001',
  patentTitle: '치환된 헤테로아릴 화합물 및 이를 포함하는 약학 조성물',
  todoTitle: title,
  country: 'KR',
  target: 'FGFR',
  type: 'TODO',
  label: 'To-do 마감일',
  date: at(offset),
  ...overrides,
});

const DEADLINES_RESPONSE = () => {
  const items = [
    todoItem(-40, '기한 연장 신청'),
    todoItem(-9, '의견서 제출', { country: 'US', internalRef: 'F25W003US' }),
    todoItem(0, '심사청구 기한 확인'),
    todoItem(5, '보정서 작성', { country: 'EP', internalRef: 'F25W005EP', patentTitle: null }),
    todoItem(22, '분할출원 검토', { internalRef: null }),
    // 예상 만료일 항목도 섞어 To-do만 걸러내는지 확인한다.
    {
      ...todoItem(12, ''),
      todoId: null,
      todoTitle: null,
      type: 'EXPECTED_EXPIRY',
      label: '예상 만료일',
    },
  ];
  return {
    from: at(-3650),
    to: at(365),
    items,
    total: items.length,
    counts: { overdue: 2, today: 1, within7: 1, within30: 1 },
  };
};

/**
 * 탭이 실제로 생기는 문서 두 건. 탭 유지를 확인하려면 `문서 전문`·`정보`처럼 두 문서에
 * 공통으로 있는 탭과, 의견서처럼 한쪽에만 있는 탭이 함께 필요하다.
 */
const railDocument = (
  officeActionId: number,
  overrides: Record<string, unknown> = {},
): PatentSearchItem => ({
  officeActionId,
  relevanceScore: null,
  adminId: officeActionId,
  content: `통지서 ${officeActionId} 본문입니다. `.repeat(20),
  contentLength: 400,
  documentPath: `https://example.invalid/oa-${officeActionId}.pdf`,
  // 1번이 가장 오래된 통지가 되게 한다(대응 서류 날짜를 그 뒤로 잡을 수 있다).
  actionDate: at(-400 + 120 * officeActionId),
  action: '의견제출통지서',
  actionNumber: `SEED-${officeActionId}`,
  patentId: 1,
  applicationNumber: `10-2026-000000${officeActionId}`,
  koreanTitle: '치환된 헤테로아릴 화합물',
  englishTitle: 'Substituted heteroaryl compounds',
  applicant: '보로노이',
  legalStatusId: 2,
  legalStatus: '공개',
  examStatusId: null,
  exam: true,
  examiners: [],
  submissions: [],
  rejections: [],
  patent: null,
  ...overrides,
}) as PatentSearchItem;

/**
 * 의견서·보정서 픠스처.
 *
 * 경로 모양을 실제와 같게 둔다(`..._보정서_20240701.pdf`) — 날짜를 파일명에서 읽으므로
 * 여기서 모양을 단순화하면 타임라인이 날짜를 못 얻어 검증이 의미를 잃는다.
 */
/** `at()`과 같은 기준의 상대 날짜를 파일명용 YYYYMMDD로. */
const dateKeyAt = (offset: number) => at(offset).split('-').join('');

const submission = (
  id: number,
  kind: 'OPINION' | 'AMENDMENT' | null,
  hasPdf = true,
  dateKey = '20240701',
) => {
  const name = kind === 'OPINION' ? '의견서' : kind === 'AMENDMENT' ? '보정서' : '기타';
  const folder = kind === 'AMENDMENT' ? 'amendment' : 'opinion';
  return {
    id,
    typeCode: kind === 'OPINION' ? 1 : kind === 'AMENDMENT' ? 2 : 9,
    kind,
    content: '본문',
    contentLength: 2,
    documentPath: hasPdf
      ? `https://example.invalid/response/${folder}/2023/1020230184208_${name}_${dateKey}.pdf`
      : null,
  };
};

const RAIL_DOCUMENTS: PatentSearchItem[] = [
  /**
   * 1번 통지 건: 의견서 2건 + 보정서 1건. 타임라인 한 마디에 노드 4개가 붙는 경우다
   * (화면 스크린샷의 '의견제출통지서 / 의견서 1 / 의견서 2 / 보정서'와 같은 구성).
   */
  railDocument(1, {
    // 대응 서류는 통지 뒤에 온다. 날짜는 파일명에서 읽는다.
    submissions: [
      submission(11, 'OPINION', true, dateKeyAt(-250)),
      // 의견서 2와 보정서는 **같은 날짜**다. 날짜 라벨은 구간의 첫 문서만 그리므로,
      // 뒤쪽(보정서)을 골랐을 때도 그 라벨이 활성으로 보여야 한다.
      submission(12, 'OPINION', true, dateKeyAt(-200)),
      submission(13, 'AMENDMENT', true, dateKeyAt(-200)),
      // PDF가 없는 문서. 노드는 남고 날짜를 못 읽어 축 끝으로 밀린다.
      submission(14, null, false),
    ],
  }),
  // 2번 통지 건: 통지서만. 1번의 의견서 노드를 보다가 넘어오면 통지서로 떨어져야 한다.
  railDocument(2),
  // 통지일이 비어 있는 건. 축 끝으로 밀리고 '날짜 없음'으로 표시되어야 한다.
  railDocument(3, {
    actionDate: null,
    submissions: [submission(31, null, true, dateKeyAt(-60))],
  }),
];

const json = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * 레일이 쓰는 endpoint만 가로챈다. 나머지는 그대로 흘려보내 스텁이 조용히 다른 요청을
 * 삼키지 않게 한다(무엇이 스텁인지가 코드에 드러나야 한다).
 */
const installFetchStub = () => {
  const original = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL ? input.toString() : input.url;

    if (url.includes('/access-context')) return json(ACCESS_CONTEXT);
    if (url.includes('/patent-records/schedule')) return json(SCHEDULE_RESPONSE());
    if (url.includes('/patent-records/deadlines')) return json(DEADLINES_RESPONSE());
    // 공휴일은 서버 자격증명이 없다는 정상 응답으로 답한다. 로컬 표로 폴백한다.
    if (url.includes('/holidays')) {
      return json({ year: Number(today.slice(0, 4)), configured: false, holidays: [] });
    }
    // To-do 완료 처리.
    if (/\/patent-todos\/\d+$/.test(url) && init?.method === 'PATCH') {
      return json({ id: 1, completed: true });
    }
    return original(input as RequestInfo, init);
  }) as typeof window.fetch;
};

// ---- 순수 함수 단정 -------------------------------------------------------

type Check = { name: string; pass: boolean; detail: string };

const runChecks = (): Check[] => {
  const checks: Check[] = [];
  const expect = (name: string, pass: boolean, detail = '') => {
    checks.push({ name, pass, detail });
  };

  /**
   * 단정이 화면과 같은 store를 조작하므로, 끝나면 원래대로 돌려놓는다.
   *
   * 돌려놓지 않으면 검증이 복원된 사용자 상태(펼쳐 둔 항목·폭)를 지우고 그것을 저장까지
   * 한다. workspaceHarness가 저장 단정에 별도 키를 쓰는 것과 같은 이유다.
   */
  const snapshot = (() => {
    const {
      activeItem, lastItem, widths, documentContext, documentTabKey, todoRevision,
    } = useRightSidebarStore.getState();
    // store에 상태를 더하면 여기도 같이 늘려야 한다. 빠뜨리면 단정이 그 값을 되돌리지 못해
    // 화면이 검증 결과를 물려받는다.
    return {
      activeItem, lastItem, widths: { ...widths }, documentContext, documentTabKey, todoRevision,
    };
  })();
  const restore = () => useRightSidebarStore.setState(snapshot);

  // 항목마다 폭이 달라야 한다. 하나의 고정폭이면 문서 뷰어에서 PDF가 안 읽힌다.
  expect(
    '문서 뷰어 기본 폭이 일정·To-do보다 넓다',
    RAIL_DEFAULT_WIDTH.documents > RAIL_DEFAULT_WIDTH.schedule
      && RAIL_DEFAULT_WIDTH.documents > RAIL_DEFAULT_WIDTH.todo,
    `${RAIL_DEFAULT_WIDTH.documents} / ${RAIL_DEFAULT_WIDTH.schedule} / ${RAIL_DEFAULT_WIDTH.todo}`,
  );

  expect(
    '모든 항목의 기본 폭이 자기 최소 폭 이상이다',
    RIGHT_RAIL_ITEMS.every((item) => RAIL_DEFAULT_WIDTH[item] >= RAIL_MIN_WIDTH[item]),
  );

  // 토글: 같은 항목을 다시 누르면 접힌다.
  {
    const store = useRightSidebarStore.getState();
    store.openItem('schedule');
    expect('openItem으로 펼친다', useRightSidebarStore.getState().activeItem === 'schedule');
    useRightSidebarStore.getState().toggleItem('schedule');
    expect(
      '같은 항목을 토글하면 접힌다',
      useRightSidebarStore.getState().activeItem === null,
    );
    useRightSidebarStore.getState().toggleItem('todo');
    expect(
      '다른 항목을 토글하면 그 항목으로 바뀐다',
      useRightSidebarStore.getState().activeItem === 'todo',
    );
  }

  /*
    접었다가 다시 열면 보던 문서가 남아 있어야 한다.

    특허 관리 목록의 문서 버튼은 누를 때마다 openItem('documents')를 보낸다. 그 한 줄이
    쓸모가 있으려면 **접을 때 documentContext가 살아 있어야** 한다 — 접으면서 비워 버리면
    다시 열어도 빈 뷰어가 나오고, 화면이 문서를 다시 실어 줄 때까지 아무것도 못 본다.
  */
  {
    const store = useRightSidebarStore.getState();
    store.showDocuments({
      source: 'rail-harness',
      patentId: 1,
      label: '접힘 복원 확인',
      items: [],
      activeId: null,
      legalStatusLabel: null,
      examStatusLabel: null,
    });
    useRightSidebarStore.getState().collapse();
    expect(
      '접어도 보던 문서는 남는다',
      useRightSidebarStore.getState().documentContext?.label === '접힘 복원 확인',
      String(useRightSidebarStore.getState().documentContext?.label),
    );
    useRightSidebarStore.getState().openItem('documents');
    const reopened = useRightSidebarStore.getState();
    expect(
      '접힌 상태에서 openItem이 문서를 그대로 다시 펼친다',
      reopened.activeItem === 'documents'
        && reopened.documentContext?.label === '접힘 복원 확인',
      `${reopened.activeItem} / ${reopened.documentContext?.label}`,
    );
  }

  // 문서 컨텍스트: source가 다르면 지우지 않는다.
  {
    const store = useRightSidebarStore.getState();
    store.showDocuments({
      source: 'screen-a',
      patentId: 1,
      label: 'A25W001',
      items: [],
      activeId: null,
      legalStatusLabel: null,
      examStatusLabel: null,
    });
    expect(
      'showDocuments가 문서 뷰어를 펼친다',
      useRightSidebarStore.getState().activeItem === 'documents',
    );
    useRightSidebarStore.getState().clearDocuments('screen-b');
    expect(
      '다른 화면의 clearDocuments는 무시한다',
      useRightSidebarStore.getState().documentContext !== null,
    );
    useRightSidebarStore.getState().clearDocuments('screen-a');
    const after = useRightSidebarStore.getState();
    expect(
      '넣은 화면이 지우면 문서와 펼침이 함께 사라진다',
      after.documentContext === null && after.activeItem === null,
    );
  }

  // 두 화면이 같은 뷰어를 쓰는 상황. 나중에 넣은 쪽이 이긴다.
  {
    const api = () => useRightSidebarStore.getState();
    const ctx = (source: string, activeId: number) => ({
      source,
      patentId: null,
      label: `${source}-${activeId}`,
      items: [],
      activeId,
      legalStatusLabel: null,
      examStatusLabel: null,
    });

    api().showDocuments(ctx('patent-management', 1));
    api().showDocuments(ctx('office-action', 2));
    expect(
      '나중에 넣은 화면의 문서가 뷰어를 차지한다',
      api().documentContext?.source === 'office-action'
        && api().documentContext?.activeId === 2,
      `${api().documentContext?.source}/${api().documentContext?.activeId}`,
    );
    // 각 화면은 자기가 넣은 것만 강조에 써야 한다. source가 다르면 null로 읽힌다.
    const highlightFor = (source: string) => (
      api().documentContext?.source === source ? api().documentContext?.activeId : null
    );
    expect('넣은 화면은 자기 문서를 강조한다', highlightFor('office-action') === 2);
    expect('넣지 않은 화면은 강조하지 않는다', highlightFor('patent-management') === null);

    // 앞서 밀려난 화면이 떠나도 지금 올라와 있는 문서는 지워지지 않는다.
    api().clearDocuments('patent-management');
    expect(
      '밀려난 화면의 정리가 남의 문서를 지우지 않는다',
      api().documentContext?.source === 'office-action',
      String(api().documentContext?.source),
    );
    api().clearDocuments('office-action');
    expect('넣은 화면이 떠나면 지워진다', api().documentContext === null);
  }

  // 문서 뷰어 탭 기억.
  {
    const api = () => useRightSidebarStore.getState();
    const ctx = (activeId: number) => ({
      source: 'tab-check',
      patentId: null,
      label: `doc-${activeId}`,
      items: [],
      activeId,
      legalStatusLabel: null,
      examStatusLabel: null,
    });

    api().showDocuments(ctx(1));
    api().setDocumentTabKey('full-text');
    expect('탭 key를 기억한다', api().documentTabKey === 'full-text', String(api().documentTabKey));

    // 문서를 갈아도 탭은 남는다. 이게 이 기능의 요점이다.
    api().showDocuments(ctx(2));
    expect(
      '문서를 바꿔도 탭은 유지된다',
      api().documentTabKey === 'full-text',
      String(api().documentTabKey),
    );

    // 문서를 내려도 탭은 남긴다. 다음 문서를 열었을 때 같은 탭으로 이어지는 게 자연스럽다.
    api().clearDocuments('tab-check');
    expect(
      '문서를 내려도 탭 기억은 남는다',
      api().documentContext === null && api().documentTabKey === 'full-text',
      String(api().documentTabKey),
    );
  }

  // 폭 저장.
  {
    useRightSidebarStore.getState().setWidth('todo', 400);
    expect('setWidth가 항목별로 반영된다', useRightSidebarStore.getState().widths.todo === 400);
    useRightSidebarStore.getState().setWidth('todo', RAIL_DEFAULT_WIDTH.todo);
  }

  // 레일 상단 화살표: 접기·펼치기와 마지막 항목 기억.
  {
    const api = () => useRightSidebarStore.getState();
    api().openItem('todo');
    api().toggleCollapsed();
    expect('화살표로 접는다', api().activeItem === null);
    expect('접어도 lastItem은 남는다', api().lastItem === 'todo', String(api().lastItem));
    api().toggleCollapsed();
    expect(
      '화살표로 다시 열면 마지막 항목이 돌아온다',
      api().activeItem === 'todo',
      String(api().activeItem),
    );

    // 아이콘을 눌러 접은 경우에도 그 항목이 lastItem이어야 한다(다시 열 대상).
    api().toggleItem('schedule');   // todo → schedule
    api().toggleItem('schedule');   // 같은 항목 → 접힘
    expect('아이콘으로 접어도 그 항목을 기억한다', api().lastItem === 'schedule', String(api().lastItem));
    api().toggleCollapsed();
    expect('그 항목이 다시 열린다', api().activeItem === 'schedule', String(api().activeItem));
  }

  // To-do 갱신 신호.
  {
    const before = useRightSidebarStore.getState().todoRevision;
    useRightSidebarStore.getState().invalidateTodos();
    expect(
      'invalidateTodos가 revision을 올린다',
      useRightSidebarStore.getState().todoRevision === before + 1,
    );
  }

  restore();
  // ---- 문서 타임라인 ----
  {
    // 파일명에서 날짜를 읽는다. 의견서·보정서에는 날짜 컬럼이 없어 이것이 유일한 출처다.
    expect(
      '파일명 끝의 _YYYYMMDD를 읽는다',
      parseDateFromDocumentPath(
        'http://172.16.1.210:8888/response/amendment/2023/1020230184208_보정서_20240701.pdf',
      ) === '2024-07-01',
      String(parseDateFromDocumentPath('.../1020230184208_보정서_20240701.pdf')),
    );
    expect(
      '출원번호(13자리) 안에서 잘못 잡지 않는다',
      parseDateFromDocumentPath('.../1020230184208_보정서.pdf') === null,
      String(parseDateFromDocumentPath('.../1020230184208_보정서.pdf')),
    );
    expect(
      'URL 인코딩된 한글 파일명도 읽는다',
      parseDateFromDocumentPath(
        '.../1020230184208_%EB%B3%B4%EC%A0%95%EC%84%9C_20240701.pdf',
      ) === '2024-07-01',
    );
    expect(
      '없는 날짜는 버린다',
      parseDateFromDocumentPath('.../x_20240231.pdf') === null
        && parseDateFromDocumentPath('.../x_99999999.pdf') === null,
      `${parseDateFromDocumentPath('.../x_20240231.pdf')} / ${parseDateFromDocumentPath('.../x_99999999.pdf')}`,
    );
    expect(
      'null·빈 경로는 null',
      parseDateFromDocumentPath(null) === null && parseDateFromDocumentPath('') === null,
    );

    // 통지서는 DB의 통지일이 정본, 파일명은 폴백.
    const withActionDate = buildDocumentNodes(railDocument(1, {
      actionDate: '2026-01-05T00:00:00.000Z',
      documentPath: '.../oa_20991231.pdf',
    }))[0];
    expect(
      '통지서는 DB 통지일을 파일명보다 우선한다',
      withActionDate.date === '2026-01-05' && withActionDate.dateSource === 'actionDate',
      `${withActionDate.date} / ${withActionDate.dateSource}`,
    );
    const withoutActionDate = buildDocumentNodes(railDocument(1, {
      actionDate: null,
      documentPath: '.../oa_20240101.pdf',
    }))[0];
    expect(
      '통지일이 없으면 파일명에서 읽는다',
      withoutActionDate.date === '2024-01-01' && withoutActionDate.dateSource === 'fileName',
      `${withoutActionDate.date} / ${withoutActionDate.dateSource}`,
    );

    // 축은 통지 건 경계가 아니라 날짜가 정한다.
    const entries = buildTimelineEntries([
      railDocument(1, {
        actionDate: '2026-01-01T00:00:00.000Z',
        documentPath: '.../oa1_20260101.pdf',
        submissions: [
          { ...submission(11, 'OPINION'), documentPath: '.../1020_의견서_20260901.pdf' },
        ],
      }),
      railDocument(2, {
        actionDate: '2026-05-01T00:00:00.000Z',
        documentPath: '.../oa2_20260501.pdf',
        submissions: [],
      }),
    ]);
    expect(
      '다른 통지 건의 문서가 날짜 순서대로 섞인다',
      entries.map((entry) => `${entry.node.label}@${entry.node.date}`).join(' > ')
        === '의견제출통지서@2026-01-01 > 의견제출통지서@2026-05-01 > 의견서@2026-09-01',
      entries.map((entry) => `${entry.node.label}@${entry.node.date}`).join(' > '),
    );

    // 날짜 없는 문서는 축 끝으로.
    const withUnknown = buildTimelineEntries([
      railDocument(1, {
        actionDate: null,
        documentPath: null,
        content: '본문',
        contentLength: 2,
        submissions: [{ ...submission(21, 'OPINION'), documentPath: '.../x_20240101.pdf' }],
      }),
    ]);
    expect(
      '날짜를 못 읽은 문서는 축 끝으로 밀린다',
      withUnknown.map((entry) => entry.node.label).join(' > ') === '의견서 > 의견제출통지서',
      withUnknown.map((entry) => `${entry.node.label}@${entry.node.date}`).join(' > '),
    );

    // 같은 날짜 구간의 라벨 위치. 뒤쪽 문서를 골라도 구간 라벨이 활성이어야 한다.
    {
      const grouped = buildTimelineEntries([
        railDocument(1, {
          actionDate: '2026-01-01T00:00:00.000Z',
          documentPath: '.../oa_20260101.pdf',
          submissions: [
            { ...submission(81, 'OPINION'), documentPath: '.../a_20260301.pdf' },
            { ...submission(82, 'AMENDMENT'), documentPath: '.../b_20260301.pdf' },
          ],
        }),
      ]);
      const leaders = dateGroupLeaders(grouped);
      expect(
        '같은 날짜 두 문서는 한 구간으로 묶인다',
        leaders.join(',') === '0,1,1',
        `${leaders.join(',')} / ${grouped.map((entry) => entry.node.date).join(',')}`,
      );
      expect(
        '구간의 두 번째 문서를 골라도 라벨은 첫 자리(활성 대상)를 가리킨다',
        leaders[2] === 1,
        String(leaders[2]),
      );
      // 날짜 없는 문서끼리도 한 구간.
      const unknowns = buildTimelineEntries([
        railDocument(1, {
          actionDate: null,
          documentPath: null,
          content: '본문',
          contentLength: 2,
          submissions: [submission(83, 'OPINION', false), submission(84, 'AMENDMENT', false)],
        }),
      ]);
      expect(
        '날짜 없는 문서끼리도 한 구간이다',
        dateGroupLeaders(unknowns).join(',') === '0,0,0',
        dateGroupLeaders(unknowns).join(','),
      );
    }

    // 같은 날짜면 절차 순서(통지 → 대응)를 지킨다.
    const sameDay = buildTimelineEntries([
      railDocument(1, {
        actionDate: '2026-02-02T00:00:00.000Z',
        documentPath: '.../oa_20260202.pdf',
        submissions: [{ ...submission(31, 'OPINION'), documentPath: '.../y_20260202.pdf' }],
      }),
    ]);
    expect(
      '같은 날짜면 통지서가 대응보다 앞이다',
      sameDay.map((entry) => entry.node.label).join(' > ') === '의견제출통지서 > 의견서',
      sameDay.map((entry) => entry.node.label).join(' > '),
    );

    // 노드 이름·key 규칙.
    const nodes = buildDocumentNodes(railDocument(1, {
      submissions: [
        submission(41, 'AMENDMENT'),
        submission(42, null),
        submission(43, 'OPINION'),
        submission(44, 'OPINION'),
      ],
    }));
    expect(
      '노드 이름은 통지서 → 의견서 → 보정서 → 기타 순으로 붙는다',
      nodes.map((node) => node.label).join(' > ')
        === '의견제출통지서 > 의견서 1 > 의견서 2 > 보정서 > 기타 문서',
      nodes.map((node) => node.label).join(' > '),
    );
    expect(
      '같은 종류가 하나뿐이면 번호를 붙이지 않는다',
      buildDocumentNodes(railDocument(1, { submissions: [submission(51, 'OPINION')] }))
        .map((node) => node.label).join(' > ') === '의견제출통지서 > 의견서',
    );
    expect(
      '노드 key는 서로 겹치지 않는다',
      new Set(nodes.map((node) => node.key)).size === nodes.length,
      nodes.map((node) => node.key).join(','),
    );
    expect(
      'PDF 없는 문서도 노드로 남는다(sources·date만 빈다)',
      (() => {
        const withoutPdf = buildDocumentNodes(railDocument(1, {
          submissions: [submission(61, 'OPINION', false)],
        }));
        const opinion = withoutPdf.find((node) => node.label === '의견서');
        return !!opinion && opinion.sources.length === 0 && opinion.date === null;
      })(),
    );
    expect(
      '본문·PDF가 모두 없는 통지서는 노드를 만들지 않는다',
      buildDocumentNodes(railDocument(1, {
        content: null,
        contentLength: 0,
        documentPath: null,
        submissions: [submission(71, 'OPINION')],
      })).map((node) => node.label).join(' > ') === '의견서',
    );
  }

  return checks;
};

// ---- 화면 ------------------------------------------------------------------

const Harness: React.FC = () => {
  const [dark, setDark] = useState(false);
  const [checksOpen, setChecksOpen] = useState(false);
  const checks = useMemo(runChecks, []);
  const failed = checks.filter((check) => !check.pass);

  const showDocuments = useRightSidebarStore((state) => state.showDocuments);
  const clearDocuments = useRightSidebarStore((state) => state.clearDocuments);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <ConfigProvider theme={{ algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
      <AntApp>
        <MemoryRouter>
          <AccessContextProvider>
            <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-color)' }}>
              {/* 본문 자리. 레일이 폭을 먹었을 때 본문이 어떻게 눌리는지 본다. */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
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
                    value={dark ? 'dark' : 'light'}
                    onChange={(value) => setDark(value === 'dark')}
                    options={[
                      { value: 'light', label: '라이트' },
                      { value: 'dark', label: '다크' },
                    ]}
                  />
                  <button
                    type="button"
                    onClick={() => showDocuments({
                      source: 'harness',
                      patentId: 1,
                      label: 'A25W001',
                      items: [],
                      activeId: null,
                      legalStatusLabel: '공개',
                      examStatusLabel: '심사청구',
                    })}
                  >
                    문서 넣기(빈 묶음)
                  </button>
                  {/* 탭 유지 확인용. 같은 자리에 다른 문서를 넣어 보고 있던 탭이 남는지 본다. */}
                  {RAIL_DOCUMENTS.map((doc, index) => (
                    <button
                      key={doc.officeActionId}
                      type="button"
                      onClick={() => showDocuments({
                        source: 'harness',
                        patentId: doc.patentId,
                        label: doc.applicationNumber ?? '문서',
                        items: [doc],
                        activeId: doc.officeActionId,
                        legalStatusLabel: doc.legalStatus,
                        examStatusLabel: null,
                      })}
                    >
                      {`문서 ${index + 1} 열기${index === 0 ? ' (대응 3건)' : ''}`}
                    </button>
                  ))}
                  {/* 타임라인이 여러 마디가 되는 경우. 통지 건 3개를 한 묶음으로 넣는다. */}
                  <button
                    type="button"
                    onClick={() => showDocuments({
                      source: 'harness',
                      patentId: 1,
                      label: '10-2026-0000001',
                      items: RAIL_DOCUMENTS,
                      activeId: RAIL_DOCUMENTS[0].officeActionId,
                      legalStatusLabel: '공개',
                      examStatusLabel: null,
                    })}
                  >
                    통지 3건 모두 열기 (타임라인)
                  </button>
                  <button type="button" onClick={() => clearDocuments('harness')}>
                    문서 비우기
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    오른쪽 아이콘을 눌러 패널을 열고, 경계를 끌어 폭을 바꿔 보세요.
                    새로고침하면 유지됩니다.
                  </span>
                </div>

                {checksOpen ? (
                  <div
                    style={{
                      maxHeight: 240,
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
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {`  — ${check.detail}`}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)',
                    fontSize: 13,
                  }}
                >
                  본문 자리 (화면 컴포넌트가 들어오는 곳)
                </div>
              </div>

              <RightSidebar />
            </div>
          </AccessContextProvider>
        </MemoryRouter>
      </AntApp>
    </ConfigProvider>
  );
};

installFetchStub();

const container = document.getElementById('root');
if (container) createRoot(container).render(<Harness />);
