/**
 * 레이아웃 트리 조작. 모두 불변(immutable)이라 React state에 그대로 넣을 수 있고,
 * 바뀌지 않은 하위 트리는 같은 참조를 유지하므로 memo가 살아 있다.
 *
 * 핵심은 replaceNode 하나다. 노드를 다른 노드로 바꾸거나(=삽입) null로 바꾸면(=삭제)
 * 나머지는 전부 여기서 파생된다. 삭제할 때 부모 SplitNode를 살아남은 형제로 대체하는
 * 정리(토스 기사의 "쓰이지 않는 split 정리")도 이 함수 안에 있다.
 */

import { measure, minSizeOf } from './measure';
import {
  LAYOUT_GAP,
  isPanelNode,
  isSplitNode,
  makePanelNode,
  makeSplitNode,
  type Edge,
  type LayoutNode,
  type PanelMetaLookup,
  type PanelNode,
  type Rect,
  type SplitNode,
  type TabId,
} from './types';

/** ratio가 이 밖으로 나가면 한쪽이 사실상 사라진다. 최소 크기 계산과 별개인 안전판. */
export const MIN_RATIO = 0.05;
export const MAX_RATIO = 0.95;

/**
 * targetId 노드를 replacer의 결과로 갈아 끼운다. null을 돌려주면 그 노드를 지우고
 * 부모 분할을 살아남은 형제로 대체한다. 트리가 통째로 비면 null을 반환한다.
 *
 * 바뀐 것이 없으면 원래 참조를 그대로 돌려준다.
 */
const replaceNode = (
  node: LayoutNode,
  targetId: string,
  replacer: (found: LayoutNode) => LayoutNode | null,
): LayoutNode | null => {
  if (node.id === targetId) return replacer(node);
  if (isPanelNode(node)) return node;

  const first = replaceNode(node.first, targetId, replacer);
  const second = replaceNode(node.second, targetId, replacer);
  if (first === node.first && second === node.second) return node;
  // 한쪽이 사라지면 이 분할은 존재 이유가 없다. 남은 쪽이 자리를 물려받는다.
  if (first === null) return second;
  if (second === null) return first;
  return { ...node, first, second };
};

// ---- 조회 ----------------------------------------------------------------

export const collectPanels = (node: LayoutNode): PanelNode[] => (
  isPanelNode(node)
    ? [node]
    : [...collectPanels(node.first), ...collectPanels(node.second)]
);

export const collectSplits = (node: LayoutNode): SplitNode[] => (
  isSplitNode(node)
    ? [node, ...collectSplits(node.first), ...collectSplits(node.second)]
    : []
);

/** 트리에 올라와 있는 탭 전부. 트리 순회 순서를 유지한다. */
export const collectMountedTabs = (node: LayoutNode): TabId[] => (
  collectPanels(node).flatMap((panel) => panel.tabs)
);

export const findPanel = (node: LayoutNode, panelId: string): PanelNode | null => {
  for (const panel of collectPanels(node)) {
    if (panel.id === panelId) return panel;
  }
  return null;
};

export const findPanelByTab = (node: LayoutNode, tabId: TabId): PanelNode | null => {
  for (const panel of collectPanels(node)) {
    if (panel.tabs.includes(tabId)) return panel;
  }
  return null;
};

// ---- 리사이즈 ------------------------------------------------------------

export const setRatio = (
  root: LayoutNode,
  splitId: string,
  ratio: number,
): LayoutNode => replaceNode(root, splitId, (found) => (
  isSplitNode(found)
    ? { ...found, ratio: Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio)) }
    : found
)) ?? root;

/**
 * 양쪽 하위 트리가 요구하는 최소 px을 실제 측정값과 견줘 비율의 상·하한을 구한다.
 * 최소 크기를 둘 다 만족할 수 없을 만큼 좁으면 반반으로 둔다 — 어느 쪽을 희생할지는
 * 정할 근거가 없고, 이 상황에서는 stacked 폴백으로 넘어가는 것이 맞다.
 */
export const clampRatio = (
  root: LayoutNode,
  splitId: string,
  containerRect: Rect,
  next: number,
  options: { panelMeta?: PanelMetaLookup; gap?: number } = {},
): number => {
  const gap = options.gap ?? LAYOUT_GAP;
  const split = collectSplits(root).find((node) => node.id === splitId);
  if (!split) return next;

  const { nodeRects } = measure(root, containerRect, { gap, panelMeta: options.panelMeta });
  const area = nodeRects.get(splitId);
  if (!area) return next;

  const axis = split.direction === 'row' ? 'x' : 'y';
  const available = (split.direction === 'row' ? area.width : area.height) - gap;
  if (available <= 0) return next;

  const minFirst = minSizeOf(split.first, axis, options.panelMeta, gap);
  const minSecond = minSizeOf(split.second, axis, options.panelMeta, gap);
  const low = minFirst / available;
  const high = 1 - minSecond / available;
  if (low > high) return 0.5;

  return Math.min(
    Math.min(MAX_RATIO, high),
    Math.max(Math.max(MIN_RATIO, low), next),
  );
};

// ---- 패널 추가·삭제·이동 ------------------------------------------------

const edgeToDirection = (edge: Edge): SplitNode['direction'] => (
  edge === 'left' || edge === 'right' ? 'row' : 'column'
);

/** 대상 패널을 새 분할로 감싸고, edge가 가리키는 쪽에 새 패널을 놓는다. */
export const insertPanel = (
  root: LayoutNode,
  targetNodeId: string,
  edge: Edge,
  newPanel: PanelNode,
): LayoutNode => replaceNode(root, targetNodeId, (found) => {
  const direction = edgeToDirection(edge);
  const insertFirst = edge === 'left' || edge === 'top';
  return insertFirst
    ? makeSplitNode(direction, 0.5, newPanel, found)
    : makeSplitNode(direction, 0.5, found, newPanel);
}) ?? root;

/** 패널을 지우고 부모 분할을 정리한다. 마지막 패널이었다면 null. */
export const removePanel = (
  root: LayoutNode,
  panelId: string,
): LayoutNode | null => replaceNode(root, panelId, () => null);

/**
 * 패널을 다른 패널의 edge 쪽으로 옮긴다. 떼어낸 뒤 붙이는 순서라, 떼면서 정리된
 * 분할이 대상 패널을 없애는 일은 없다(대상은 다른 노드다).
 */
export const movePanel = (
  root: LayoutNode,
  panelId: string,
  targetPanelId: string,
  edge: Edge,
): LayoutNode => {
  if (panelId === targetPanelId) return root;
  const moving = findPanel(root, panelId);
  if (!moving || !findPanel(root, targetPanelId)) return root;

  const detached = removePanel(root, panelId);
  if (!detached) return root;
  return insertPanel(detached, targetPanelId, edge, moving);
};

// ---- 탭 ------------------------------------------------------------------

const updatePanel = (
  root: LayoutNode,
  panelId: string,
  update: (panel: PanelNode) => PanelNode | null,
): LayoutNode | null => replaceNode(root, panelId, (found) => (
  isPanelNode(found) ? update(found) : found
));

export const setActiveTab = (
  root: LayoutNode,
  panelId: string,
  tabId: TabId,
): LayoutNode => updatePanel(root, panelId, (panel) => (
  panel.tabs.includes(tabId) ? { ...panel, activeTab: tabId } : panel
)) ?? root;

/** 탭을 패널에 넣고 활성화한다. index를 주면 그 자리에 끼운다. */
export const addTab = (
  root: LayoutNode,
  panelId: string,
  tabId: TabId,
  index?: number,
): LayoutNode => updatePanel(root, panelId, (panel) => {
  if (panel.tabs.includes(tabId)) return { ...panel, activeTab: tabId };
  const tabs = [...panel.tabs];
  tabs.splice(index ?? tabs.length, 0, tabId);
  return { ...panel, tabs, activeTab: tabId };
}) ?? root;

/**
 * 탭을 뺀다. 마지막 탭이었다면 패널 노드까지 사라진다(분할 정리 포함).
 * 트리가 통째로 비면 null.
 */
export const removeTab = (
  root: LayoutNode,
  panelId: string,
  tabId: TabId,
): LayoutNode | null => updatePanel(root, panelId, (panel) => {
  const tabs = panel.tabs.filter((tab) => tab !== tabId);
  if (tabs.length === 0) return null;
  return {
    ...panel,
    tabs,
    // 보고 있던 탭을 닫았으면 원래 자리에서 가장 가까운 탭으로 넘긴다.
    activeTab: panel.activeTab === tabId
      ? tabs[Math.min(panel.tabs.indexOf(tabId), tabs.length - 1)]
      : panel.activeTab,
  };
});

/** 어느 패널에 있든 그 탭을 찾아 제거한다. 타입당 하나만 두는 규칙에 쓴다. */
export const removeTabAnywhere = (
  root: LayoutNode,
  tabId: TabId,
): LayoutNode | null => {
  const owner = findPanelByTab(root, tabId);
  return owner ? removeTab(root, owner.id, tabId) : root;
};

/**
 * 탭을 다른 패널로 옮긴다. 같은 패널이면 순서만 바꾼다.
 * 소스 패널이 비면 패널 노드가 사라지고 분할이 정리된다.
 */
export const moveTab = (
  root: LayoutNode,
  fromPanelId: string,
  tabId: TabId,
  toPanelId: string,
  index?: number,
): LayoutNode => {
  const source = findPanel(root, fromPanelId);
  if (!source || !source.tabs.includes(tabId)) return root;

  if (fromPanelId === toPanelId) {
    return updatePanel(root, fromPanelId, (panel) => {
      const tabs = panel.tabs.filter((tab) => tab !== tabId);
      tabs.splice(index ?? tabs.length, 0, tabId);
      return { ...panel, tabs, activeTab: tabId };
    }) ?? root;
  }

  if (!findPanel(root, toPanelId)) return root;
  const detached = removeTab(root, fromPanelId, tabId);
  if (!detached) return root;
  return addTab(detached, toPanelId, tabId, index);
};

/**
 * 패널을 통째로 대상 패널에 합친다. 소스의 탭 전부가 대상의 탭으로 들어가고 소스 노드는
 * 사라진다(분할 정리 포함). 그립으로 패널을 끌어 다른 패널의 탭 스트립이나 가운데에
 * 놓았을 때의 경로다.
 *
 * 보고 있던 탭은 그대로 유지한다 — 합쳤다고 사용자가 보던 내용이 바뀔 이유는 없다.
 */
export const mergePanel = (
  root: LayoutNode,
  fromPanelId: string,
  toPanelId: string,
  index?: number,
): LayoutNode => {
  if (fromPanelId === toPanelId) return root;
  const source = findPanel(root, fromPanelId);
  if (!source || !findPanel(root, toPanelId)) return root;

  const detached = removePanel(root, fromPanelId);
  if (!detached) return root;

  // 소스의 탭 순서를 지키려면 index를 하나씩 밀며 넣어야 한다.
  const merged = source.tabs.reduce(
    (tree, tabId, offset) => addTab(tree, toPanelId, tabId, index === undefined ? undefined : index + offset),
    detached,
  );
  return setActiveTab(merged, toPanelId, source.activeTab);
};

/**
 * 탭을 떼어내 대상 패널의 edge 쪽 새 패널로 만든다. 탭 드래그로 화면을 쪼개는 경로다.
 * 탭 하나뿐인 패널을 자기 자신의 edge에 떨어뜨리는 것은 의미가 없어 무시한다.
 */
export const moveTabToEdge = (
  root: LayoutNode,
  fromPanelId: string,
  tabId: TabId,
  targetPanelId: string,
  edge: Edge,
): LayoutNode => {
  const source = findPanel(root, fromPanelId);
  if (!source || !source.tabs.includes(tabId)) return root;
  if (fromPanelId === targetPanelId && source.tabs.length === 1) return root;
  if (!findPanel(root, targetPanelId)) return root;

  const detached = removeTab(root, fromPanelId, tabId);
  if (!detached) return root;
  // 소스 패널이 사라졌더라도 대상 패널은 다른 노드라 그대로 살아 있다.
  return insertPanel(detached, targetPanelId, edge, makePanelNode([tabId]));
};
