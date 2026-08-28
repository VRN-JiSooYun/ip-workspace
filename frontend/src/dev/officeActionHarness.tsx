/**
 * 의견제출통지서 화면 검증용 harness. 개발 전용이고 앱 번들에는 들어가지 않는다
 * (office-action-harness.html에서만 진입한다).
 *
 * railHarness와 같은 방식으로 **네트워크 경계(fetch)만** 스텁하고 그 위는 전부 실제
 * 코드를 쓴다 — 실제 페이지 컴포넌트, 실제 서비스 계층, 실제 레일. 확인하려는 것이
 * "진입했을 때 실제로 무슨 일이 벌어지는가"라서, 페이지를 흉내 낸 가짜를 그리면 의미가 없다.
 *
 * 보는 것 세 가지:
 *   1) 진입 즉시 content 없는 /patent-search/index를 한 번만 불러오는가
 *   2) 진입 시 우측 레일이 문서 뷰어로 펼쳐지는가
 *   3) 스크롤을 .oa-result-cards가 갖고 .oa-page는 갖지 않는가
 */

import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import OfficeActionAnalysis from '../pages/OfficeActionAnalysis';
import RightSidebar from '../components/layout/RightSidebar';
import { AccessContextProvider } from '../contexts/AccessContext';
import { useRightSidebarStore } from '../store/useRightSidebarStore';
import type {
  PatentSearchIndexItem,
  PatentSearchItem,
  PatentSearchResult,
} from '../services/patentSearchApi';
import '../index.css';

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

const TARGETS = ['EGFR', 'KRAS G12C', 'BTK', 'JAK1', 'PARP1', 'CDK4/6', 'SHP2'];

const makeItem = (index: number): PatentSearchItem => ({
  officeActionId: 9000 + index,
  relevanceScore: null,
  adminId: index,
  content: [
    '# 의견제출통지서',
    '',
    `【출원번호】10-2024-${String(1000000 + index).slice(1)}`,
    '',
    '【거절이유】',
    '이 출원의 청구항 1 내지 5에 기재된 발명은 그 출원 전에 국내에서 반포된 간행물에',
    '게재된 발명에 의하여 통상의 기술자가 쉽게 발명할 수 있는 것이므로 특허를 받을 수 없습니다.',
  ].join('\n'),
  contentLength: 240,
  documentPath: null,
  actionDate: `2025-${String((index % 12) + 1).padStart(2, '0')}-14`,
  action: '의견제출통지서',
  actionNumber: `9-5-2025-${String(100000 + index).padStart(9, '0')}`,
  patentId: index,
  applicationNumber: `10-2024-${String(1000000 + index).slice(1)}`,
  koreanTitle: `${TARGETS[index % TARGETS.length]} 억제제 및 이를 포함하는 약학 조성물`,
  englishTitle: `${TARGETS[index % TARGETS.length]} inhibitor and pharmaceutical composition`,
  applicant: index % 2 === 0 ? '보로노이 주식회사' : 'Voronoi Inc.',
  legalStatusId: 1,
  legalStatus: '출원',
  examStatusId: 2,
  exam: true,
  examiners: [
    { id: index, office: '특허청', bureau: '화학생명기술심사국', department: '약품화학심사과', name: '홍길동' },
  ],
  submissions: [],
  rejections: [
    { rejectionId: index, claim: '1-5', lawType: 1, article: 29, paragraph: 2, subParagraph: null },
  ],
  patent: null,
});

const makeIndexItem = (index: number): PatentSearchIndexItem => ({
  ...makeItem(index),
  content: null,
  filterIndex: { attorneyName: null, examStatus: null, ipcs: [] },
});

/** 전문 검색과 content 없는 인덱스 호출을 따로 센다. */
const searchCalls: { body: unknown; at: number }[] = [];
let indexCalls = 0;

const json = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * 이 화면이 쓰는 endpoint만 가로챈다. 나머지는 그대로 흘려보내 스텁이 조용히 다른 요청을
 * 삼키지 않게 한다(railHarness와 같은 규칙).
 */
const installFetchStub = () => {
  const original = window.fetch.bind(window);
  let sequence = 0;
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL ? input.toString() : input.url;

    if (url.includes('/access-context')) return json(ACCESS_CONTEXT);

    if (url.includes('/patent-search/index')) {
      indexCalls += 1;
      return json({
        generatedAt: new Date().toISOString(),
        total: 137,
        items: Array.from({ length: 137 }, (_, index) => makeIndexItem(index)),
      });
    }

    if (url.includes('/patent-search/') && url.endsWith('/content')) {
      return json({ content: '선택한 통지서 본문', contentLength: 11, submissions: [] });
    }

    if (url.includes('/patent-search')) {
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      searchCalls.push({ body, at: sequence += 1 });
      const size = Number(body?.size ?? 10);
      const page = Number(body?.page ?? 1);
      const result: PatentSearchResult = {
        total: 137,
        page,
        size,
        items: Array.from({ length: size }, (_, index) => makeItem((page - 1) * size + index)),
      };
      return json(result);
    }

    // 레일의 일정·To-do 패널이 부르는 것들. 빈 응답으로 조용히 지나가게 한다.
    if (url.includes('/patent-records/schedule')) {
      return json({ year: 2026, month: 8, events: [], todos: [], todoTotal: 0 });
    }
    if (url.includes('/patent-records/deadlines')) return json({ items: [], total: 0 });
    if (url.includes('/holidays')) return json({ year: 2026, configured: false, holidays: [] });

    return original(input as RequestInfo, init);
  }) as typeof window.fetch;
};

installFetchStub();

// ---- 진입 후 상태 점검 -----------------------------------------------------

type Check = { name: string; pass: boolean; detail: string };

const measureChecks = (): Check[] => {
  const checks: Check[] = [];
  const expect = (name: string, pass: boolean, detail = '') => {
    checks.push({ name, pass, detail });
  };

  const el = (selector: string) => document.querySelector<HTMLElement>(selector);
  const page = el('.oa-page');
  const main = el('.oa-main');
  const cards = el('.oa-result-cards');

  // 1) 진입 시 content 없는 로컬 필터 인덱스
  expect('진입 시 /patent-search/index를 호출한다', indexCalls === 1,
    `${indexCalls}회`);
  expect('키워드가 없으면 전문 Search API를 호출하지 않는다', searchCalls.length === 0,
    `${searchCalls.length}회`);
  expect('결과 카드가 그려졌다', (document.querySelectorAll('.oa-result-card').length > 0),
    `${document.querySelectorAll('.oa-result-card').length}장`);

  // 2) 문서 뷰어가 펼쳐진다
  const rail = useRightSidebarStore.getState();
  expect('레일이 문서 뷰어로 펼쳐진다', rail.activeItem === 'documents', `${rail.activeItem}`);
  expect('문서 뷰어 패널이 실제로 그려졌다', !!el('.rs-panel'), '');

  // 3) 스크롤 주인
  const overflows = (node: HTMLElement | null) => (
    !!node && node.scrollHeight - node.clientHeight > 1
  );
  const scrollY = (node: HTMLElement | null) => (
    node ? getComputedStyle(node).overflowY : 'n/a'
  );
  expect('.oa-page는 스크롤하지 않는다',
    !overflows(page) && scrollY(page) === 'hidden',
    `overflowY=${scrollY(page)}, scrollHeight=${page?.scrollHeight} clientHeight=${page?.clientHeight}`);
  expect('.oa-main도 스크롤하지 않는다', !overflows(main),
    `scrollHeight=${main?.scrollHeight} clientHeight=${main?.clientHeight}`);
  expect('.oa-result-cards가 스크롤을 갖는다',
    scrollY(cards) === 'auto' && overflows(cards),
    `overflowY=${scrollY(cards)}, scrollHeight=${cards?.scrollHeight} clientHeight=${cards?.clientHeight}`);
  expect('검색 바는 결과를 내려도 제자리에 있다',
    !!page && !!el('.oa-searchbar') &&
    el('.oa-searchbar')!.getBoundingClientRect().top >= page.getBoundingClientRect().top - 1,
    '');
  expect('페이지네이션이 스크롤 밖(항상 보이는 자리)에 있다',
    !!el('.oa-results-pagination') && !!cards &&
    !cards.contains(el('.oa-results-pagination')!), '');

  return checks;
};

// ---- 화면 -----------------------------------------------------------------

const Harness: React.FC = () => {
  const [checks, setChecks] = useState<Check[] | null>(null);

  // 첫 검색 응답이 그려진 뒤에 재야 의미가 있다. 카드가 나타날 때까지 기다린다.
  useEffect(() => {
    let cancelled = false;
    const wait = (attempt = 0) => {
      if (cancelled) return;
      if (document.querySelector('.oa-result-card') || attempt > 60) {
        setChecks(measureChecks());
        return;
      }
      requestAnimationFrame(() => wait(attempt + 1));
    };
    wait();
    return () => { cancelled = true; };
  }, []);

  const failed = checks?.filter((check) => !check.pass) ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', flex: '0 0 auto' }}>
        <strong style={{ fontSize: 14 }}>Office action harness</strong>
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
      </div>

      {/* MainLayout의 Content와 같은 껍데기 — 고정 높이 + overflow:hidden. */}
      <div style={{ display: 'flex', flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <OfficeActionAnalysis />
        </div>
        <RightSidebar />
      </div>

      {checks && (
        <details style={{ flex: '0 0 auto', maxHeight: '28vh', overflow: 'auto', fontSize: 12, padding: '0 12px 8px' }} open={failed.length > 0}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>진입 상태 점검</summary>
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
        <MemoryRouter>
          <AccessContextProvider>
            <Harness />
          </AccessContextProvider>
        </MemoryRouter>
      </AntApp>
    </ConfigProvider>,
  );
}
