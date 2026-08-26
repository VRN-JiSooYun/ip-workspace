/**
 * 레이아웃 트리 → 절대 좌표.
 *
 * 루트에서 재귀로 내려가며 각 SplitNode의 ratio로 가용 공간을 나눈다. 결과는
 * position:absolute에 그대로 꽂을 수 있는 px 값이다. 트리가 유일한 진실이고
 * 좌표는 매 렌더에서 다시 계산하는 파생값이라, 좌표를 state로 들고 있지 않는다.
 */

import {
  DEFAULT_PANEL_META,
  LAYOUT_GAP,
  isPanelNode,
  type LayoutNode,
  type PanelMetaLookup,
  type PanelRect,
  type Rect,
  type SplitterRect,
} from './types';

export type MeasureOptions = {
  gap?: number;
  /**
   * 좁은 화면용. 트리를 무시하고 패널을 세로로 쌓는다. 분할선은 내지 않는다.
   * 총 높이가 컨테이너보다 커질 수 있으므로 부르는 쪽이 스크롤을 열어야 한다.
   */
  stacked?: boolean;
  /** stacked일 때 패널 하나에 줄 높이. 지정하지 않으면 패널의 최소 높이를 쓴다. */
  stackedPanelHeight?: number;
  panelMeta?: PanelMetaLookup;
};

export type MeasureResult = {
  panels: PanelRect[];
  splitters: SplitterRect[];
  /** 모든 노드(패널·분할 both)의 사각형. clampRatio가 분할의 실제 크기를 알아야 해서 함께 낸다. */
  nodeRects: Map<string, Rect>;
  /** stacked 모드에서 실제로 필요한 총 높이. 아니면 컨테이너 높이. */
  contentHeight: number;
};

/**
 * 패널 하나가 요구하는 최소 크기. 여러 탭이 한 프레임을 공유하므로 탭들의 최대값을 쓴다.
 * 그래야 어떤 탭으로 바꿔도 프레임이 그 탭의 최소 크기를 만족한다.
 */
const panelMinSize = (
  tabs: string[],
  axis: 'x' | 'y',
  lookup?: PanelMetaLookup,
): number => tabs.reduce((largest, tabId) => {
  const meta = lookup?.(tabId) ?? DEFAULT_PANEL_META;
  return Math.max(largest, axis === 'x' ? meta.minWidth : meta.minHeight);
}, 0);

/**
 * 하위 트리 전체가 요구하는 최소 크기.
 *
 * 분할 방향과 축이 같으면 양쪽이 자리를 나눠 쓰므로 합(+gap), 다르면 같은 자리를
 * 함께 쓰므로 최대값이다.
 */
export const minSizeOf = (
  node: LayoutNode,
  axis: 'x' | 'y',
  lookup?: PanelMetaLookup,
  gap: number = LAYOUT_GAP,
): number => {
  if (isPanelNode(node)) return panelMinSize(node.tabs, axis, lookup);

  const first = minSizeOf(node.first, axis, lookup, gap);
  const second = minSizeOf(node.second, axis, lookup, gap);
  const alongSplit = node.direction === 'row' ? axis === 'x' : axis === 'y';
  return alongSplit ? first + second + gap : Math.max(first, second);
};

const measureStacked = (
  root: LayoutNode,
  rect: Rect,
  options: MeasureOptions,
): MeasureResult => {
  const gap = options.gap ?? LAYOUT_GAP;
  const panels: PanelRect[] = [];
  const nodeRects = new Map<string, Rect>();
  let y = rect.y;

  const walk = (node: LayoutNode): void => {
    if (isPanelNode(node)) {
      const height = options.stackedPanelHeight
        ?? Math.max(panelMinSize(node.tabs, 'y', options.panelMeta), 240);
      const panelRect = { x: rect.x, y, width: rect.width, height };
      panels.push({ panelId: node.id, ...panelRect });
      nodeRects.set(node.id, panelRect);
      y += height + gap;
      return;
    }
    walk(node.first);
    walk(node.second);
  };

  walk(root);
  return {
    panels,
    splitters: [],
    nodeRects,
    // 마지막 패널 뒤의 gap은 빼고, 내용이 없으면 0이 되게 한다.
    contentHeight: Math.max(0, y - rect.y - gap),
  };
};

/**
 * 비율로 나눈 크기를 양쪽의 최소 크기에 맞게 당긴다.
 *
 * 최소 크기 강제는 여기 한 곳에서만 한다. ratio는 사용자가 끌어 놓은 '의도'이고,
 * 그 의도를 화면 크기에 맞춰 실현하는 것은 측정의 일이다. 저장된 배치가 좁은 화면에서
 * 열리는 경우처럼 ratio가 최소 크기를 어기는 상황이 항상 있다.
 *
 * 둘 다 만족할 수 없으면 최소 크기 비례로 나눈다. 한쪽을 온전히 살리고 다른 쪽을
 * 0으로 만드는 것보다, 둘 다 조금씩 부족한 채 각자 안에서 스크롤하는 편이 낫다.
 */
const fitToMinimums = (
  available: number,
  ratio: number,
  minFirst: number,
  minSecond: number,
): number => {
  if (available <= 0) return 0;
  if (minFirst + minSecond > available) {
    const total = minFirst + minSecond;
    return total > 0 ? Math.round((available * minFirst) / total) : Math.round(available / 2);
  }
  const raw = Math.round(available * ratio);
  return Math.min(available - minSecond, Math.max(minFirst, raw));
};

export const measure = (
  root: LayoutNode,
  rect: Rect,
  options: MeasureOptions = {},
): MeasureResult => {
  if (options.stacked) return measureStacked(root, rect, options);

  const gap = options.gap ?? LAYOUT_GAP;
  const panels: PanelRect[] = [];
  const splitters: SplitterRect[] = [];
  const nodeRects = new Map<string, Rect>();

  const walk = (node: LayoutNode, area: Rect): void => {
    nodeRects.set(node.id, area);

    if (isPanelNode(node)) {
      panels.push({ panelId: node.id, ...area });
      return;
    }

    if (node.direction === 'row') {
      // gap을 먼저 떼고 남은 폭을 비율로 나눈다. 반올림 오차는 second가 흡수해
      // 두 패널의 합 + gap이 정확히 area.width가 되게 한다.
      const available = Math.max(0, area.width - gap);
      const firstWidth = fitToMinimums(
        available,
        node.ratio,
        minSizeOf(node.first, 'x', options.panelMeta, gap),
        minSizeOf(node.second, 'x', options.panelMeta, gap),
      );
      const secondWidth = available - firstWidth;
      splitters.push({
        splitId: node.id,
        direction: 'row',
        x: area.x + firstWidth,
        y: area.y,
        width: gap,
        height: area.height,
      });
      walk(node.first, { x: area.x, y: area.y, width: firstWidth, height: area.height });
      walk(node.second, {
        x: area.x + firstWidth + gap,
        y: area.y,
        width: secondWidth,
        height: area.height,
      });
      return;
    }

    const available = Math.max(0, area.height - gap);
    const firstHeight = fitToMinimums(
      available,
      node.ratio,
      minSizeOf(node.first, 'y', options.panelMeta, gap),
      minSizeOf(node.second, 'y', options.panelMeta, gap),
    );
    const secondHeight = available - firstHeight;
    splitters.push({
      splitId: node.id,
      direction: 'column',
      x: area.x,
      y: area.y + firstHeight,
      width: area.width,
      height: gap,
    });
    walk(node.first, { x: area.x, y: area.y, width: area.width, height: firstHeight });
    walk(node.second, {
      x: area.x,
      y: area.y + firstHeight + gap,
      width: area.width,
      height: secondHeight,
    });
  };

  walk(root, rect);
  return { panels, splitters, nodeRects, contentHeight: rect.height };
};
