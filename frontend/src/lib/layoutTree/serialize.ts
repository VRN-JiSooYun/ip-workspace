/**
 * 저장된 트리를 믿지 않고 다시 세우는 정규화.
 *
 * localStorage 값은 사용자가 고칠 수 있고, 스키마가 바뀌면 예전 모양이 남아 있다.
 * 여기서는 "어떻게든 쓸 수 있는 트리"로 복구하는 쪽을 택한다 — 알 수 없는 탭은 버리고,
 * 자식이 하나만 남은 분할은 접고, 그래도 아무것도 남지 않으면 null을 돌려준다.
 * null을 받은 쪽이 기본 레이아웃으로 되돌린다.
 *
 * 도메인 지식(어떤 탭 id가 유효한지)은 isValidTab으로 주입받는다.
 */

import { MAX_RATIO, MIN_RATIO } from './operations';
import {
  makeNodeId,
  type LayoutNode,
  type PanelNode,
  type SplitNode,
  type TabId,
} from './types';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null
);

const clampRatioValue = (value: unknown): number => {
  const ratio = Number(value);
  if (!Number.isFinite(ratio)) return 0.5;
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));
};

export const normalizeTree = (
  value: unknown,
  isValidTab: (tabId: string) => boolean,
): LayoutNode | null => {
  // 같은 탭이 두 패널에 있으면 어느 쪽을 보여 줄지 정할 수 없다. 처음 만난 것만 남긴다.
  const seenTabs = new Set<TabId>();
  // 노드 id가 겹치면 React key가 충돌하고 조작이 엉뚱한 노드에 걸린다.
  const usedIds = new Set<string>();

  const takeId = (raw: unknown): string => {
    if (typeof raw === 'string' && raw.length > 0 && !usedIds.has(raw)) {
      usedIds.add(raw);
      return raw;
    }
    const generated = makeNodeId();
    usedIds.add(generated);
    return generated;
  };

  const walk = (raw: unknown): LayoutNode | null => {
    if (!isRecord(raw)) return null;

    if (raw.kind === 'panel') {
      if (!Array.isArray(raw.tabs)) return null;
      const tabs = raw.tabs.filter((tab): tab is TabId => (
        typeof tab === 'string' && isValidTab(tab) && !seenTabs.has(tab)
      ));
      if (tabs.length === 0) return null;
      tabs.forEach((tab) => seenTabs.add(tab));

      const panel: PanelNode = {
        kind: 'panel',
        id: takeId(raw.id),
        tabs,
        activeTab: typeof raw.activeTab === 'string' && tabs.includes(raw.activeTab)
          ? raw.activeTab
          : tabs[0],
      };
      return panel;
    }

    if (raw.kind === 'split') {
      const first = walk(raw.first);
      const second = walk(raw.second);
      // 한쪽만 살아남으면 분할은 필요 없다. 살아남은 쪽을 그대로 올린다.
      if (!first) return second;
      if (!second) return first;

      const split: SplitNode = {
        kind: 'split',
        id: takeId(raw.id),
        direction: raw.direction === 'column' ? 'column' : 'row',
        ratio: clampRatioValue(raw.ratio),
        first,
        second,
      };
      return split;
    }

    return null;
  };

  return walk(value);
};

/** JSON 문자열까지 한 번에. 파싱 실패도 null로 흡수한다. */
export const parseTree = (
  json: string,
  isValidTab: (tabId: string) => boolean,
): LayoutNode | null => {
  try {
    return normalizeTree(JSON.parse(json), isValidTab);
  } catch {
    return null;
  }
};
