/**
 * 대시보드 위젯 정의와 레이아웃 영속화.
 *
 * lib/layoutTree는 도메인을 모르는 순수 엔진이고, 여기서 "이 화면에 어떤 위젯이 있고
 * 각자 최소 크기가 얼마인지"를 채워 준다. 저장 규칙(schemaVersion + normalize + 실패 시
 * 기본값 폴백 + 사용자별 키)은 patentWorkspaceLayout.ts와 같은 방식이다 — 같은 엔진의
 * 두 번째 소비자이므로 규약도 같아야 한다.
 */

import {
  makePanelNode,
  makeSplitNode,
  normalizeTree,
  findPanelByTab,
  type LayoutNode,
  type PanelMeta,
} from '../lib/layoutTree';

/**
 * 2로 올린 이유: 기본 배치에 일정 위젯이 들어왔다. 버전을 올려야 이미 배치를 저장해 둔
 * 사용자도 새 위젯을 한 번은 보게 된다(그 대가로 저장해 둔 배치가 한 번 초기화된다).
 */
export const DASHBOARD_LAYOUT_SCHEMA_VERSION = 2;

export const DASHBOARD_PANEL_TYPES = [
  'kpi',
  'schedule',
  'deadlines',
  'stageFunnel',
  'dataQuality',
] as const;

export type DashboardPanelTypeId = typeof DASHBOARD_PANEL_TYPES[number];

const PANEL_TYPE_SET = new Set<string>(DASHBOARD_PANEL_TYPES);

export const isDashboardPanelTypeId = (value: string): value is DashboardPanelTypeId => (
  PANEL_TYPE_SET.has(value)
);

export type DashboardPanelMeta = PanelMeta & {
  title: string;
  /** false면 탭을 닫을 수 없다. KPI는 이 화면의 뼈대라 항상 남긴다. */
  closable: boolean;
};

export const DASHBOARD_PANEL_META: Record<DashboardPanelTypeId, DashboardPanelMeta> = {
  // 타일이 auto-fit이라 좁아지면 스스로 줄바꿈한다. 높이는 한 줄이 들어갈 만큼만.
  kpi: { title: '요약', minWidth: 260, minHeight: 110, closable: false },
  // 월 격자 6주가 눌리지 않으려면 이만큼은 있어야 한다. 더 좁아지면 막대가 '+N'으로 접힌다.
  schedule: { title: '일정', minWidth: 360, minHeight: 300, closable: true },
  // 버킷 머리줄 + 몇 줄이 보여야 "무엇이 급한가"를 답할 수 있다.
  deadlines: { title: '기한', minWidth: 320, minHeight: 260, closable: true },
  // 진행 현황은 특허 관리의 같은 패널과 같은 최소 폭을 쓴다(같은 컴포넌트다).
  stageFunnel: { title: '진행 현황', minWidth: 240, minHeight: 220, closable: true },
  dataQuality: { title: '데이터 품질', minWidth: 260, minHeight: 180, closable: true },
};

export const getDashboardPanelMeta = (tabId: string): DashboardPanelMeta | undefined => (
  isDashboardPanelTypeId(tabId) ? DASHBOARD_PANEL_META[tabId] : undefined
);

/**
 * 기본 배치.
 *
 *   column(0.16)
 *   ├── kpi (전폭)
 *   └── row(0.6)
 *       ├── column(0.6): 일정 / 기한
 *       └── column(0.5): 진행 현황 / 데이터 품질
 *
 * 왼쪽 열이 "언제·무엇이 급한가"를 답한다 — 일정(언제)과 기한(무엇이 급한가)은 서로
 * 붙여 두어야 한 눈에 읽힌다. 오른쪽 두 위젯은 조망이라 좁아도 읽힌다.
 *
 * 0.16은 1240px×800px 기준으로 KPI 한 줄(110px + gap)이 들어가는 비율이고, 왼쪽 열의
 * 0.6은 그 아래 남는 높이에서 월 격자 6주가 눌리지 않는 최소치다.
 */
export const buildDefaultDashboardLayout = (): LayoutNode => makeSplitNode(
  'column',
  0.16,
  makePanelNode(['kpi']),
  makeSplitNode(
    'row',
    0.6,
    makeSplitNode('column', 0.6, makePanelNode(['schedule']), makePanelNode(['deadlines'])),
    makeSplitNode('column', 0.5, makePanelNode(['stageFunnel']), makePanelNode(['dataQuality'])),
  ),
);

type StoredLayout = {
  schemaVersion: number;
  tree: unknown;
};

export const getDashboardLayoutStorageKey = (userId: string): string => (
  `dashboard-layout:${userId}:v${DASHBOARD_LAYOUT_SCHEMA_VERSION}`
);

/**
 * 저장된 배치를 읽는다. 없거나 깨졌거나 KPI 패널이 사라진 트리는 기본값으로 되돌린다.
 * KPI를 확인하는 이유: 닫을 수 없는 패널이라 정상 경로로는 사라지지 않는다. 없다면
 * 저장값이 손상됐거나 예전 스키마다.
 */
export const readDashboardLayout = (userId: string): LayoutNode => {
  const fallback = buildDefaultDashboardLayout();
  if (typeof window === 'undefined') return fallback;

  try {
    const rawValue = window.localStorage.getItem(getDashboardLayoutStorageKey(userId));
    if (!rawValue) return fallback;
    const parsed = JSON.parse(rawValue) as Partial<StoredLayout>;
    if (parsed.schemaVersion !== DASHBOARD_LAYOUT_SCHEMA_VERSION) return fallback;

    const tree = normalizeTree(parsed.tree, isDashboardPanelTypeId);
    if (!tree) return fallback;
    if (!findPanelByTab(tree, 'kpi')) return fallback;
    return tree;
  } catch {
    return fallback;
  }
};

export const writeDashboardLayout = (userId: string, tree: LayoutNode): void => {
  if (typeof window === 'undefined') return;
  const value: StoredLayout = {
    schemaVersion: DASHBOARD_LAYOUT_SCHEMA_VERSION,
    tree,
  };
  try {
    window.localStorage.setItem(
      getDashboardLayoutStorageKey(userId),
      JSON.stringify(value),
    );
  } catch {
    // 용량 초과 등으로 저장이 실패해도 화면은 계속 써야 한다.
  }
};

export const removeDashboardLayout = (userId: string): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(getDashboardLayoutStorageKey(userId));
};

/** 이 폭 아래에서는 트리를 접고 세로로 쌓는다. 특허 관리와 같은 기준. */
export const DASHBOARD_STACK_BREAKPOINT = 768;
