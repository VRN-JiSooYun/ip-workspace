/**
 * 특허 관리 화면 검증용 harness. 개발 전용이고 앱 번들에는 들어가지 않는다
 * (patent-management-harness.html에서만 진입한다).
 *
 * 실제 화면은 AuthGate 안에 있어 dev 브라우저에서 열 수 없다. 그래서 상태만 가짜로 채우고
 * (PatentWorkspaceProvider) 배치는 페이지와 **같은 컴포넌트**(PatentManagementBody)를 쓴다.
 * 배치를 여기서 따로 베껴 그리면 페이지가 바뀔 때 조용히 어긋난다.
 *
 * 보는 것: 위(상세 검색) 아래(관리 특허 목록) 두 칸이 화면 높이를 나눠 쓰는지, 스크롤이
 * 표에만 생기는지, 좁은 폭에서 깨지지 않는지.
 */

import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';
import PatentManagementBody from '../components/patent-management/PatentManagementBody';
import { PatentWorkspaceProvider } from '../components/patent-management/workspace/PatentWorkspaceContext';
import PatentRecordDetailModal from '../components/patent-management/PatentRecordDetailModal';
import type { PatentListFilterValues } from '../components/patent-management/PatentListFilters';
import type { PatentRecord } from '../services/patentRecordApi';
import { buildMockWorkspaceState } from './patentWorkspaceMock';
import '../index.css';
import '../styles/dday.css';
import '../pages/PatentManagement.css';

/** 스텁이 받은 PATCH. 어떤 키가 담겨 나갔는지·몇 번 나갔는지 본다. */
const patchCalls: { body: Record<string, unknown>; requestId: string | null }[] = [];
/** 가짜 감사 로그. PATCH가 들어올 때마다 한 행 늘린다. */
const auditRows: Record<string, unknown>[] = [];

const json = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * 이 화면이 쓰는 endpoint만 가로챈다. 나머지는 흘려보내 스텁이 조용히 다른 요청을
 * 삼키지 않게 한다(railHarness·officeActionHarness와 같은 규칙).
 */
/** 서버의 AUDITED_FIELDS 라벨 중 이 화면에서 쓰는 것만. */
const FIELD_LABELS: Record<string, string> = { applicant: '출원인', note: '설명' };

/** 서버 summarizeRichText와 같은 규칙(태그를 벗기고 60자). */
const summarize = (html: string) => {
  const plain = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!plain) return null;
  return plain.length > 60 ? `${plain.slice(0, 60)}…` : plain;
};

const installFetchStub = (getRecord: () => Record<string, unknown>) => {
  const original = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL ? input.toString() : input.url;

    if (/\/patent-records\/\d+\/audit-logs/.test(url)) {
      return json({ items: [...auditRows].reverse(), nextCursor: null });
    }

    if (/\/patent-records\/\d+$/.test(url) && init?.method === 'PATCH') {
      const body = typeof init.body === 'string'
        ? (JSON.parse(init.body) as Record<string, unknown>)
        : {};
      const headers = new Headers(init.headers ?? {});
      patchCalls.push({ body, requestId: headers.get('x-request-id') });

      // 서버처럼 바뀐 필드마다 로그 한 행. requestId를 그대로 물려 화면이 묶을 수 있게 한다.
      for (const [field, value] of Object.entries(body)) {
        auditRows.push({
          id: `log-${auditRows.length + 1}`,
          eventType: 'PATENT_FIELD_CHANGED',
          field,
          fieldLabel: FIELD_LABELS[field] ?? field,
          beforeValue: '이전 값',
          // 설명은 서버가 태그를 벗기고 앞 60자만 남긴다. 피드가 그것을 받는지 본다.
          afterValue: value === null ? null : field === 'note' ? summarize(String(value)) : String(value),
          requestId: headers.get('x-request-id'),
          metadata: {},
          createdAt: new Date().toISOString(),
          actor: { id: 'u1', name: '윤지수' },
        });
      }
      return json({ ...getRecord(), ...body });
    }

    if (url.includes('/patent-todos')) return json([]);
    return original(input as RequestInfo, init);
  }) as typeof window.fetch;
};

type Check = { name: string; pass: boolean; detail: string };

const measureChecks = (): Check[] => {
  const checks: Check[] = [];
  const expect = (name: string, pass: boolean, detail = '') => {
    checks.push({ name, pass, detail });
  };

  const el = (selector: string) => document.querySelector<HTMLElement>(selector);
  const page = el('.pm-page');
  const filters = el('.pm-section-filters');
  const list = el('.pm-section-list');
  const table = el('.pm-list-table .ant-table-body, .pm-list-table .ant-table-content');

  const overflows = (node: HTMLElement | null) => (
    !!node && node.scrollHeight - node.clientHeight > 1
  );
  const scrollY = (node: HTMLElement | null) => (
    node ? getComputedStyle(node).overflowY : 'n/a'
  );

  expect('두 칸만 있다(상세 검색 · 관리 특허 목록)',
    document.querySelectorAll('.pm-section').length === 2,
    `${document.querySelectorAll('.pm-section').length}칸`);
  expect('진행 현황·Target 패널이 없다',
    !el('.pm-pipeline') && !el('.pm-target-list'), '');

  // ---- 상세 검색이 목록의 모든 열을 덮는지 --------------------------------
  // 표 헤더에서 열 이름을 읽어, 각 열에 대응하는 필터 입력이 있는지 확인한다.
  // 하드코딩한 목록과 비교하면 열이 늘어날 때 이 검증이 조용히 통과한다.
  {
    const columnTitles = [...document.querySelectorAll('.pm-list-table thead th')]
      .map((th) => th.textContent?.trim() ?? '')
      .filter((title) => title.length > 0);
    const filterLabels = [...document.querySelectorAll('.pm-detail-filters .filter-field-label')]
      .map((node) => node.textContent?.trim() ?? '');

    /** 열 이름 → 필터 라벨. 이름이 다른 것만 적는다. */
    const ALIAS: Record<string, string> = {
      '법적 상태': '법적상태',
      '심사 상태': '심사상태',
    };
    const uncovered = columnTitles.filter((title) => (
      !filterLabels.includes(ALIAS[title] ?? title)
    ));
    expect('표의 모든 열에 대응하는 필터가 있다', uncovered.length === 0,
      `누락: ${uncovered.join(', ')} / 필터: ${filterLabels.join(', ')}`);
    expect('열을 하나도 못 읽지는 않았다', columnTitles.length >= 10,
      `${columnTitles.length}열`);
  }

  // Target·진행 단계가 상세 검색 안에 있다.
  expect('Target 필터가 상세 검색 안에 있다',
    !!el('.pm-detail-filters [aria-label="Target으로 거르기"]'), '');
  expect('진행 단계 필터가 상세 검색 안에 있다',
    !!el('.pm-detail-filters [aria-label="진행 단계로 거르기"]'), '');
  expect('출원일은 기간 선택이다',
    !!el('.pm-detail-filters .ant-picker-range'), '');
  expect('탭 스트립·분할선이 없다(Grid 제거)',
    !el('.lt-tabstrip') && !el('.lt-splitter') && !el('.lt-grid'), '');

  expect('상세 검색이 위, 목록이 아래',
    !!filters && !!list &&
    filters.getBoundingClientRect().bottom <= list.getBoundingClientRect().top + 1, '');
  // clientHeight는 padding을 포함한다(box-sizing:border-box). 두 칸이 채우는 것은
  // content box라 padding을 빼고 비교해야 한다.
  const pageContentHeight = (() => {
    if (!page) return 0;
    const style = getComputedStyle(page);
    return page.clientHeight
      - parseFloat(style.paddingTop || '0')
      - parseFloat(style.paddingBottom || '0');
  })();
  expect('두 칸 + gap이 페이지 높이를 정확히 채운다',
    !!filters && !!list &&
    Math.abs((filters.offsetHeight + list.offsetHeight + 8) - pageContentHeight) <= 2,
    `${filters?.offsetHeight} + ${list?.offsetHeight} + 8 vs ${pageContentHeight}`);

  expect('.pm-page는 스크롤하지 않는다',
    !overflows(page) && scrollY(page) === 'hidden',
    `overflowY=${scrollY(page)} ${page?.scrollHeight}/${page?.clientHeight}`);
  expect('상세 검색 칸은 스크롤하지 않는다', !overflows(filters),
    `${filters?.scrollHeight}/${filters?.clientHeight}`);
  expect('상세 검색 본문도 스크롤하지 않는다',
    scrollY(el('.pm-section-filters .pm-panel-scroll')) === 'visible',
    scrollY(el('.pm-section-filters .pm-panel-scroll')));
  expect('목록 표가 스크롤을 갖는다', overflows(table),
    `${table?.className} ${table?.scrollHeight}/${table?.clientHeight}`);
  expect('목록 페이지네이션은 스크롤 밖에 있다',
    !!el('.pm-list-footer') && !!table && !table.contains(el('.pm-list-footer')!), '');

  return checks;
};

/** 진행 단계 코드 → 라벨. 실제 화면은 buildStageTiles가 만들어 준다. */
const STAGE_LABELS: Record<string, string> = {
  FILING: '출원',
  EXAM: '심사',
  REGISTERED: '등록',
  CLOSED: '종료',
  UNMAPPED: '미분류',
};

/** applyListFilters가 몇 번 불렸는지. 디바운스가 실제로 묶는지 보려면 세어야 한다. */
const pushCounter = { listFilters: 0 };

/**
 * 상세 모달(필드별 PATCH·활동 피드) 점검. 모달이 열려 있어야 의미가 있어 따로 둔다.
 * 실제 조작(입력·select)은 브라우저 자동화로 하고, 여기서는 구조와 계약을 본다.
 */
const measureModalChecks = (): Check[] => {
  const checks: Check[] = [];
  const expect = (name: string, pass: boolean, detail = '') => {
    checks.push({ name, pass, detail });
  };
  const el = (selector: string) => document.querySelector<HTMLElement>(selector);

  expect('상세 모달이 열린다', !!el('.pm-detail-modal'));
  // JIRA식 필드별 저장이므로 하단 [저장]이 있으면 규칙이 두 개가 된다.
  expect('하단 저장 버튼이 없다(필드별 즉시 저장)',
    !el('.pm-detail-modal .ant-modal-footer'));
  expect('법적 상태가 머리줄에 있다', !!el('.pm-detail-status .ant-select'));

  const sections = [...document.querySelectorAll('.pm-detail-section-title')]
    .map((node) => node.textContent ?? '');
  // 본문은 사람이 읽는 것만 남긴다. 문서·하위 작업·연결은 사이드바 '연결' 그룹으로 갔다.
  for (const name of ['설명', '활동']) {
    expect(`본문에 '${name}' 섹션이 있다',`.replace("',", "'"),
      sections.some((text) => text.startsWith(name)), sections.join(' | '));
  }
  expect('본문에 필드 묶음 섹션이 남아 있지 않다',
    !sections.some((text) => ['첨부 파일', '하위 작업', '연결된 업무 항목'].some((gone) => text.startsWith(gone))),
    sections.join(' | '));
  expect('설명 자리가 서식 편집기다', !!el('.pm-detail-main .rich-text-field'));
  // 옮겨 온 값들이 사이드바에서 실제로 보이는지. 그룹이 접혀 있으면 옮긴 뜻이 없다.
  const sideLabels = [...document.querySelectorAll('.pm-detail-side .pm-detail-row-label')]
    .map((node) => node.textContent ?? '');
  for (const name of ['문서', '하위 작업', '원출원번호', '관계']) {
    expect(`'${name}'이 사이드바에 있다`, sideLabels.includes(name), sideLabels.join(','));
  }
  // 설명만 규칙이 다르다 — 다른 칸처럼 바로 입력하는 것이 아니라 눌러서 편집기를 연다.
  // (문단은 다 쓰고 나서 [저장] 한 번이 사람의 단위다.)
  expect('설명은 눌러서 여는 편집기다',
    !!el('.pm-detail-main .rich-text-read.is-editable, .pm-detail-main .rich-text-empty'));
  // 자유 서술은 '설명' 한 자리다. 옛 '상태 메모'(status_note)는 여기로 합쳐졌다.
  expect('상태 메모 섹션이 없다',
    !sections.some((text) => text.startsWith('상태 메모')), sections.join(' | '));

  const groups = [...document.querySelectorAll('.pm-detail-side .ant-collapse-header-text')]
    .map((node) => node.textContent ?? '');
  // '연결'은 '기본' 바로 다음이다 — 누를 것이 있는 그룹이라 아래로 내리면 못 찾는다.
  expect('사이드바 그룹이 기본·연결·상태·일자·번호·국제 순이다',
    groups.slice(0, 6).join(',') === '기본,연결,상태,일자,번호,국제(PCT)', groups.join(','));
  // 값이 하나도 없는 읽기 전용 그룹은 빈 항목만 늘어놓게 되므로 숨긴다.
  expect('값 없는 권리·계약 그룹은 숨는다', !groups.includes('권리·계약'), groups.join(','));

  expect('만듦/업데이트 시각을 보여 준다',
    (el('.pm-detail-stamps')?.textContent ?? '').includes('만듦 20'),
    el('.pm-detail-stamps')?.textContent ?? '');

  return checks;
};

const Harness: React.FC = () => {
  /** 상세 모달을 띄울 특허. 필드 저장이 성공하면 여기 값을 갈아 끼운다. */
  const [detail, setDetail] = useState<PatentRecord | null>(null);
  const detailRef = useRef<PatentRecord | null>(null);
  detailRef.current = detail;
  const stubReady = useRef(false);
  if (!stubReady.current) {
    stubReady.current = true;
    installFetchStub(() => (detailRef.current ?? {}) as Record<string, unknown>);
  }

  const [checks, setChecks] = useState<Check[] | null>(null);
  const today = new Date();

  // 필터는 실제로 동작해야 확인할 수 있다(디바운스, select와 텍스트가 서로를 지우지 않는지).
  // 목록 조회는 없으니 조건만 상태로 들고 화면에 되돌려 준다.
  const [listFilters, setListFilters] = useState<PatentListFilterValues>({});
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [stageGroup, setStageGroup] = useState<string | null>(null);

  const state = buildMockWorkspaceState(
    { year: today.getFullYear(), month: today.getMonth() + 1 },
    {
      listFilters,
      applyListFilters: (next) => {
        pushCounter.listFilters += 1;
        setListFilters(next);
      },
      selectedTargets,
      applySelectedTargets: setSelectedTargets,
      activeStageGroup: stageGroup,
      applyStageGroup: setStageGroup,
      // 목록 헤더 칩이 코드가 아니라 라벨을 보여 주는지도 확인해야 한다.
      activeStageLabel: stageGroup
        ? STAGE_LABELS[stageGroup] ?? stageGroup
        : '',
    },
  );

  // 표가 그려진 뒤에 재야 의미가 있다.
  useEffect(() => {
    let cancelled = false;
    const wait = (attempt = 0) => {
      if (cancelled) return;
      if (document.querySelector('.pm-list-table .ant-table-row') || attempt > 60) {
        setChecks(measureChecks());
        return;
      }
      requestAnimationFrame(() => wait(attempt + 1));
    };
    wait();
    return () => { cancelled = true; };
  }, []);

  const failed = checks?.filter((check) => !check.pass) ?? [];

  // 브라우저 자동화로 조작 결과를 확인하기 위한 창구(개발 전용).
  (window as unknown as Record<string, unknown>).__harness = {
    listFilters,
    selectedTargets,
    stageGroup,
    pushCount: pushCounter.listFilters,
    patchCalls,
    auditRows,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', flex: '0 0 auto' }}>
        <strong style={{ fontSize: 14 }}>Patent management harness</strong>
        <span
          style={{
            padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: '#fff',
            background: !checks ? '#8c8c8c' : failed.length === 0 ? '#52c41a' : '#ff4d4f',
          }}
        >
          {!checks ? '측정 중…' : failed.length === 0
            ? `${checks.length} checks passed`
            : `${failed.length} / ${checks.length} failed`}
        </span>
        <button type="button" onClick={() => setChecks(measureChecks())}>다시 측정</button>
        <button
          type="button"
          onClick={() => {
            const first = state.patents[0] ?? null;
            // 문서·하위 작업이 없는 상태로 연다. 점검할 것이 **빈 칸의 생김새**다 —
            // 어디는 눌러서 들어가고 어디는 눌러도 소용없는지가 화면에 드러나야 한다.
            setDetail(first ? { ...first, note: '기타 메모입니다.', documentCount: 0 } : null);
            // 모달이 그려진 뒤에 재야 의미가 있다.
            window.setTimeout(() => {
              setChecks([...measureChecks(), ...measureModalChecks()]);
            }, 400);
          }}
        >
          상세 모달 열기
        </button>
      </div>

      {/* MainLayout의 Content와 같은 껍데기 — 고정 높이 + overflow:hidden. */}
      <div style={{ display: 'flex', flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
        <PatentWorkspaceProvider value={state}>
          <div className="pm-page">
            <PatentManagementBody />
          </div>
        </PatentWorkspaceProvider>
      </div>

      <PatentRecordDetailModal
        open={detail !== null}
        record={detail}
        lookups={state.lookups}
        canManage
        onClose={() => setDetail(null)}
        onSaved={setDetail}
        onOpenDocuments={() => undefined}
        onOpenTodos={() => undefined}
      />

      {checks && (
        <details style={{ flex: '0 0 auto', maxHeight: '28vh', overflow: 'auto', fontSize: 12, padding: '0 12px 8px' }} open={failed.length > 0}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>배치 점검</summary>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>
            {checks.map((check) => (
              <li key={check.name} style={{ color: check.pass ? '#52c41a' : '#ff4d4f' }}>
                {check.pass ? 'PASS' : 'FAIL'} — {check.name}
                {check.detail && !check.pass ? ` (${check.detail})` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <ConfigProvider theme={{ token: { colorPrimary: '#F87C63', borderRadius: 12, fontSize: 13 } }}>
      <AntApp>
        <Harness />
      </AntApp>
    </ConfigProvider>,
  );
}
