/**
 * 드롭 방향 판정.
 *
 * 토스 기사와 같은 기하 로직이다. 패널 사각형의 두 대각선이 만드는 네 개의 삼각형 중
 * 커서가 어느 삼각형에 있는지로 붙일 방향을 정한다. 사각형을 정규 좌표(0~1)로 옮기면
 * 두 대각선은 v = u 와 v = 1 - u 두 직선이 되고, 판정은 부등호 두 번으로 끝난다.
 *
 *   v < u  &&  v < 1-u   →  top
 *   v > u  &&  v > 1-u   →  bottom
 *   v >= u &&  v <= 1-u  →  left
 *   그 외                →  right
 *
 * 여기에 두 가지를 더했다. 탭 스트립 위에서는 방향이 아니라 '몇 번째 탭 자리'를 내고,
 * 가운데 작은 영역에서는 화면을 쪼개지 않고 대상 패널의 탭으로 합친다.
 */

import type { Edge, Rect } from './types';

export type DropTarget =
  /** 탭 스트립 위. index 자리에 탭을 끼운다. */
  | { kind: 'tab'; index: number }
  /** 네 삼각형 중 하나. 그 방향으로 화면을 쪼갠다. */
  | { kind: 'edge'; edge: Edge }
  /** 가운데. 대상 패널의 탭으로 합친다. */
  | { kind: 'center' };

export type DropZoneOptions = {
  /** 탭 스트립 높이(px). 이 안쪽은 방향이 아니라 탭 자리로 본다. */
  tabStripHeight?: number;
  /** 가운데 '합치기' 영역의 비율. 0이면 끄고 네 삼각형만 쓴다. */
  centerRatio?: number;
  /** 탭 스트립 판정에 쓸 각 탭의 사각형. 없으면 index 0을 낸다. */
  tabRects?: Rect[];
};

/** 헤더 높이. workspace.css의 .lt-tabstrip과 반드시 같은 값이어야 한다. */
export const DEFAULT_TAB_STRIP_HEIGHT = 40;
export const DEFAULT_CENTER_RATIO = 0.2;

/** 탭 스트립 안에서, 커서가 어느 탭 '사이'에 있는지. 탭 중앙을 경계로 본다. */
const resolveTabIndex = (pointerX: number, tabRects: Rect[]): number => {
  for (let index = 0; index < tabRects.length; index += 1) {
    const tab = tabRects[index];
    if (pointerX < tab.x + tab.width / 2) return index;
  }
  return tabRects.length;
};

export const resolveDropTarget = (
  pointer: { x: number; y: number },
  rect: Rect,
  options: DropZoneOptions = {},
): DropTarget | null => {
  if (rect.width <= 0 || rect.height <= 0) return null;
  if (
    pointer.x < rect.x || pointer.x > rect.x + rect.width ||
    pointer.y < rect.y || pointer.y > rect.y + rect.height
  ) {
    return null;
  }

  const tabStripHeight = options.tabStripHeight ?? DEFAULT_TAB_STRIP_HEIGHT;
  if (pointer.y <= rect.y + tabStripHeight) {
    return {
      kind: 'tab',
      index: options.tabRects ? resolveTabIndex(pointer.x, options.tabRects) : 0,
    };
  }

  // 탭 스트립을 뺀 본문 영역만 네 삼각형으로 나눈다. 스트립을 포함해 나누면
  // 위쪽 삼각형이 스트립에 먹혀 'top' 드롭이 거의 불가능해진다.
  const bodyTop = rect.y + tabStripHeight;
  const bodyHeight = rect.height - tabStripHeight;
  if (bodyHeight <= 0) return { kind: 'center' };

  const u = (pointer.x - rect.x) / rect.width;
  const v = (pointer.y - bodyTop) / bodyHeight;

  const centerRatio = options.centerRatio ?? DEFAULT_CENTER_RATIO;
  if (centerRatio > 0) {
    const half = centerRatio / 2;
    if (Math.abs(u - 0.5) <= half && Math.abs(v - 0.5) <= half) {
      return { kind: 'center' };
    }
  }

  if (v < u && v < 1 - u) return { kind: 'edge', edge: 'top' };
  if (v > u && v > 1 - u) return { kind: 'edge', edge: 'bottom' };
  if (v >= u && v <= 1 - u) return { kind: 'edge', edge: 'left' };
  return { kind: 'edge', edge: 'right' };
};

/** 드롭 결과를 미리 보여 줄 하이라이트 사각형. */
export const previewRect = (
  target: DropTarget,
  rect: Rect,
  options: { tabStripHeight?: number } = {},
): Rect => {
  const tabStripHeight = options.tabStripHeight ?? DEFAULT_TAB_STRIP_HEIGHT;
  if (target.kind === 'tab') {
    return { x: rect.x, y: rect.y, width: rect.width, height: tabStripHeight };
  }
  if (target.kind === 'center') return rect;

  const half = { width: rect.width / 2, height: rect.height / 2 };
  switch (target.edge) {
    case 'left':
      return { x: rect.x, y: rect.y, width: half.width, height: rect.height };
    case 'right':
      return { x: rect.x + half.width, y: rect.y, width: half.width, height: rect.height };
    case 'top':
      return { x: rect.x, y: rect.y, width: rect.width, height: half.height };
    case 'bottom':
      return { x: rect.x, y: rect.y + half.height, width: rect.width, height: half.height };
  }
};
