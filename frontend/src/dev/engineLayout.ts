/**
 * 레이아웃 엔진 harness 전용 fixture. 앱 코드는 이 파일을 쓰지 않는다.
 *
 * 엔진(lib/layoutTree)은 도메인을 모르므로 검증도 도메인에 매이지 않아야 한다. 예전에는
 * harness가 특허 관리 화면의 config(patentWorkspaceLayout)를 빌려 썼는데, 그 화면이
 * 두 칸 고정 배치로 단순해지면서 config가 사라졌고 harness가 함께 깨졌다. 엔진을 쓰는
 * 화면이 바뀔 때마다 엔진 검증이 깨지지 않도록, 여기에 harness 소유의 fixture를 둔다.
 *
 * 값(패널 목록·최소 크기·기본 트리)은 검증이 기대하는 숫자와 묶여 있다. 바꾸면
 * workspaceHarness의 단정도 함께 고쳐야 한다.
 */

import {
  findPanelByTab,
  makePanelNode,
  makeSplitNode,
  normalizeTree,
  type LayoutNode,
  type PanelMeta,
} from '../lib/layoutTree';

export const ENGINE_LAYOUT_SCHEMA_VERSION = 1;

export const ENGINE_PANEL_TYPES = [
  'filters',
  'stagePipeline',
  'targets',
  'patentList',
] as const;

export type EnginePanelTypeId = typeof ENGINE_PANEL_TYPES[number];

const PANEL_TYPE_SET = new Set<string>(ENGINE_PANEL_TYPES);

export const isEnginePanelTypeId = (value: string): value is EnginePanelTypeId => (
  PANEL_TYPE_SET.has(value)
);

export type EnginePanelMeta = PanelMeta & {
  title: string;
  closable: boolean;
};

/** 최소 크기를 서로 다르게 둔다 — clampRatio·measure의 하한 처리를 구분해 보려면 필요하다. */
export const ENGINE_PANEL_META: Record<EnginePanelTypeId, EnginePanelMeta> = {
  filters: { title: '상세 검색', minWidth: 280, minHeight: 200, closable: true },
  stagePipeline: { title: '진행 현황', minWidth: 240, minHeight: 200, closable: true },
  targets: { title: 'Target', minWidth: 200, minHeight: 200, closable: true },
  patentList: { title: '관리 특허 목록', minWidth: 320, minHeight: 240, closable: false },
};

/**
 * 기본 배치.
 *
 *   column(0.34)
 *   ├── row(0.5): 상세 검색 | 진행 현황
 *   └── row(0.22): Target | 관리 특허 목록
 *
 * 2단 중첩이라 measure의 반올림 오차 누적과 split 정리를 함께 볼 수 있다.
 */
export const buildDefaultEngineLayout = (): LayoutNode => makeSplitNode(
  'column',
  0.34,
  makeSplitNode('row', 0.5, makePanelNode(['filters']), makePanelNode(['stagePipeline'])),
  makeSplitNode('row', 0.22, makePanelNode(['targets']), makePanelNode(['patentList'])),
);

type StoredLayout = {
  schemaVersion: number;
  tree: unknown;
};

export const getEngineLayoutStorageKey = (userId: string): string => (
  `engine-harness-layout:${userId}:v${ENGINE_LAYOUT_SCHEMA_VERSION}`
);

export const readEngineLayout = (userId: string): LayoutNode => {
  const fallback = buildDefaultEngineLayout();
  if (typeof window === 'undefined') return fallback;

  try {
    const rawValue = window.localStorage.getItem(getEngineLayoutStorageKey(userId));
    if (!rawValue) return fallback;
    const parsed = JSON.parse(rawValue) as Partial<StoredLayout>;
    if (parsed.schemaVersion !== ENGINE_LAYOUT_SCHEMA_VERSION) return fallback;

    const tree = normalizeTree(parsed.tree, isEnginePanelTypeId);
    if (!tree) return fallback;
    // 닫을 수 없는 패널이 없다면 저장값이 손상됐거나 예전 스키마다.
    if (!findPanelByTab(tree, 'patentList')) return fallback;
    return tree;
  } catch {
    return fallback;
  }
};

export const writeEngineLayout = (userId: string, tree: LayoutNode): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      getEngineLayoutStorageKey(userId),
      JSON.stringify({ schemaVersion: ENGINE_LAYOUT_SCHEMA_VERSION, tree } satisfies StoredLayout),
    );
  } catch {
    // 저장이 실패해도 harness는 계속 써야 한다.
  }
};

export const removeEngineLayout = (userId: string): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(getEngineLayoutStorageKey(userId));
};

/** 이 폭 아래에서는 트리를 접고 세로로 쌓는다. */
export const ENGINE_STACK_BREAKPOINT = 768;
