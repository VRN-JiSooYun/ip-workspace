/**
 * 이진 트리(BSP) 레이아웃의 자료구조.
 *
 * 토스증권 사례(https://toss.tech/article/frontend-tree-structure)와 같은 모델이다.
 * 노드는 두 종류뿐이다 — 실제로 그려지는 패널(PanelNode)과 공간을 둘로 나누는
 * 분할(SplitNode). 이 둘만으로 화면 배치를 빈틈·겹침 없이 전부 표현한다.
 *
 * 이 디렉터리는 React를 import하지 않는다. 도메인(어떤 탭이 있는지)도 모른다.
 * 탭은 그냥 문자열 id이고, 최소 크기 같은 도메인 지식은 PanelMetaLookup으로 주입받는다.
 */

/** 패널 안에 들어가는 내용의 식별자. 도메인 쪽에서 union type으로 좁혀 쓴다. */
export type TabId = string;

/** 화면에 그려지는 패널 하나. 여러 탭을 담고 그중 하나를 보여 준다. */
export type PanelNode = {
  kind: 'panel';
  id: string;
  /** 최소 1개. 비면 노드 자체가 트리에서 제거된다. */
  tabs: TabId[];
  activeTab: TabId;
};

/** 공간을 둘로 나누는 분할. row는 좌/우, column은 위/아래로 나눈다. */
export type SplitNode = {
  kind: 'split';
  id: string;
  direction: 'row' | 'column';
  /** first가 차지하는 비율. 0~1. */
  ratio: number;
  first: LayoutNode;
  second: LayoutNode;
};

export type LayoutNode = PanelNode | SplitNode;

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** 패널을 어디에 그릴지. CSS position:absolute에 그대로 넣는다. */
export type PanelRect = Rect & {
  panelId: string;
};

/** 분할선의 히트 영역. 두께는 gap과 같다. */
export type SplitterRect = Rect & {
  splitId: string;
  direction: 'row' | 'column';
};

/** 패널 내용이 요구하는 최소 크기. 도메인 쪽에서 채워 넘긴다. */
export type PanelMeta = {
  minWidth: number;
  minHeight: number;
};

/** 탭 id로 최소 크기를 찾는 함수. 모르는 id면 undefined를 돌려도 된다. */
export type PanelMetaLookup = (tabId: TabId) => PanelMeta | undefined;

/** 패널을 붙일 방향. 드롭존 판정 결과와 같은 어휘를 쓴다. */
export type Edge = 'top' | 'bottom' | 'left' | 'right';

export const DEFAULT_PANEL_META: PanelMeta = { minWidth: 200, minHeight: 120 };

/** 분할선 두께 겸 패널 사이 간격(px). */
export const LAYOUT_GAP = 8;

/**
 * 노드 id. 트리 안에서만 유일하면 되지만, 저장된 트리를 다시 읽어 올 때
 * 카운터가 0부터 다시 시작해 충돌하는 일을 막으려고 UUID를 우선 쓴다.
 */
let idCounter = 0;
export const makeNodeId = (): string => (
  globalThis.crypto?.randomUUID?.() ?? `n${Date.now().toString(36)}-${++idCounter}`
);

export const isPanelNode = (node: LayoutNode): node is PanelNode => node.kind === 'panel';
export const isSplitNode = (node: LayoutNode): node is SplitNode => node.kind === 'split';

export const makePanelNode = (tabs: TabId[], activeTab?: TabId): PanelNode => ({
  kind: 'panel',
  id: makeNodeId(),
  tabs: [...tabs],
  activeTab: activeTab && tabs.includes(activeTab) ? activeTab : tabs[0],
});

export const makeSplitNode = (
  direction: SplitNode['direction'],
  ratio: number,
  first: LayoutNode,
  second: LayoutNode,
): SplitNode => ({
  kind: 'split',
  id: makeNodeId(),
  direction,
  ratio,
  first,
  second,
});
