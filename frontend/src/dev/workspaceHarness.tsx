/**
 * 레이아웃 엔진(lib/layoutTree + components/workspace) 검증용 harness. 개발 전용이고
 * 앱 번들에는 들어가지 않는다 (workspace-harness.html에서만 진입한다).
 *
 * 엔진만 본다. 어떤 화면의 패널도 띄우지 않고 dev/engineLayout.ts의 fixture와 색 블록을
 * 쓴다 — 엔진은 도메인을 모르므로 검증도 특정 화면에 매이면 안 된다(예전에는 특허 관리
 * 화면의 config를 빌려 쓰다가 그 화면이 단순해지자 함께 깨졌다).
 * 지금 이 엔진을 쓰는 화면은 대시보드다(dashboard-harness.html에서 본다).
 *
 * 아래 두 가지를 함께 낸다.
 *   1) 색 블록 패널을 올린 MovableGrid — 손으로 끌고 붙여 보는 용도
 *   2) 순수 함수 단정(assert) 결과 — 경계값은 손으로 재현하기 어려워 코드로 확인한다
 */

import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntApp, Button, ConfigProvider } from 'antd';
import MovableGrid from '../components/workspace/MovableGrid';
import {
  ENGINE_LAYOUT_SCHEMA_VERSION,
  ENGINE_PANEL_META,
  ENGINE_PANEL_TYPES,
  ENGINE_STACK_BREAKPOINT,
  buildDefaultEngineLayout,
  isEnginePanelTypeId,
  readEngineLayout,
  removeEngineLayout,
  writeEngineLayout,
  type EnginePanelTypeId,
} from './engineLayout';
import {
  LAYOUT_GAP,
  collectMountedTabs,
  collectPanels,
  collectSplits,
  clampRatio,
  insertPanel,
  makePanelNode,
  makeSplitNode,
  measure,
  moveTabToEdge,
  normalizeTree,
  mergePanel,
  movePanel,
  removePanel,
  removeTab,
  resolveDropTarget,
  setRatio,
  type LayoutNode,
} from '../lib/layoutTree';
import '../index.css';

const HARNESS_USER = 'harness';
/** 저장 단정은 별도 키를 쓴다. HARNESS_USER를 쓰면 검증이 화면의 배치를 지워 버린다. */
const STORAGE_CHECK_USER = 'harness-storage-check';

// ---- 순수 함수 단정 -------------------------------------------------------

type Check = { name: string; pass: boolean; detail: string };

const runChecks = (): Check[] => {
  const checks: Check[] = [];
  const expect = (name: string, pass: boolean, detail = '') => {
    checks.push({ name, pass, detail });
  };
  const meta = (tabId: string) => (
    isEnginePanelTypeId(tabId) ? ENGINE_PANEL_META[tabId] : undefined
  );

  // measure: 패널 + gap의 합이 컨테이너와 정확히 맞아야 한다(빈틈·겹침 없음).
  {
    const tree = makeSplitNode('row', 0.3, makePanelNode(['targets']), makePanelNode(['patentList']));
    const rect = { x: 0, y: 0, width: 1000, height: 600 };
    const { panels } = measure(tree, rect, { gap: LAYOUT_GAP, panelMeta: meta });
    const total = panels.reduce((sum, panel) => sum + panel.width, 0) + LAYOUT_GAP;
    expect('measure: 폭 합 + gap == 컨테이너 폭', total === 1000, `${total} vs 1000`);
    expect(
      'measure: 두 번째 패널이 첫 패널 + gap 뒤에서 시작',
      panels[1].x === panels[0].width + LAYOUT_GAP,
      `${panels[1].x} vs ${panels[0].width + LAYOUT_GAP}`,
    );
    expect('measure: 높이는 분할 방향과 무관', panels[0].height === 600 && panels[1].height === 600);
  }

  // measure: 3중 중첩에서도 총합이 보존되는지 (반올림 오차 누적 확인)
  {
    const tree = buildDefaultEngineLayout();
    const rect = { x: 0, y: 0, width: 1437, height: 803 };
    const { panels } = measure(tree, rect, { gap: LAYOUT_GAP, panelMeta: meta });
    const outOfBounds = panels.filter((panel) => (
      panel.x < 0 || panel.y < 0 ||
      panel.x + panel.width > rect.width + 0.5 ||
      panel.y + panel.height > rect.height + 0.5
    ));
    expect('measure: 기본 트리 4패널이 모두 컨테이너 안에', outOfBounds.length === 0,
      outOfBounds.map((panel) => panel.panelId).join(', '));
    // 일정·To-do·문서 뷰어가 우측 레일로 옮겨가 4패널이 되었다.
    expect('measure: 기본 트리 패널 수 = 4', panels.length === 4, `${panels.length}`);
  }

  // measure: ratio가 최소 크기를 어기면 측정 단계에서 당겨 준다.
  {
    const split = makeSplitNode(
      'row', 0.1, makePanelNode(['filters']), makePanelNode(['stagePipeline']),
    );
    // 여유가 있는 폭(600) — 좌측을 0.1로 눌러도 minWidth 280은 지켜야 한다.
    const roomy = measure(split, { x: 0, y: 0, width: 600, height: 400 },
      { gap: LAYOUT_GAP, panelMeta: meta });
    expect('measure: ratio가 작아도 minWidth를 지킨다',
      roomy.panels[0].width === 280, `${roomy.panels[0].width}`);
    expect('measure: 나머지는 두 번째가 받는다',
      roomy.panels[0].width + LAYOUT_GAP + roomy.panels[1].width === 600,
      `${roomy.panels[1].width}`);

    // 최소 폭 합(520)보다 좁은 폭(400) — 둘 다 만족 못 하면 최소 크기 비례로 나눈다.
    const tight = measure(split, { x: 0, y: 0, width: 400, height: 400 },
      { gap: LAYOUT_GAP, panelMeta: meta });
    expect('measure: 최소 폭 합보다 좁으면 비례 분배',
      tight.panels[0].width === Math.round(392 * 280 / 520), `${tight.panels[0].width}`);
    expect('measure: 비례 분배에서도 합 + gap 보존',
      tight.panels[0].width + LAYOUT_GAP + tight.panels[1].width === 400);
  }

  // measure: 기본 배치가 1240x740에서 모든 패널의 최소 크기를 만족한다.
  {
    const tree = buildDefaultEngineLayout();
    const { panels } = measure(tree, { x: 0, y: 0, width: 1240, height: 740 },
      { gap: LAYOUT_GAP, panelMeta: meta });
    const undersized = panels.filter((panel) => {
      const tab = collectPanels(tree).find((node) => node.id === panel.panelId)?.tabs[0];
      const size = tab && isEnginePanelTypeId(tab) ? ENGINE_PANEL_META[tab] : null;
      return size ? panel.width < size.minWidth || panel.height < size.minHeight : false;
    });
    expect('measure: 기본 배치가 1240x740에서 최소 크기를 모두 만족',
      undersized.length === 0,
      undersized.map((panel) => `${panel.panelId} ${panel.width}x${panel.height}`).join(', '));
  }

  // clampRatio: 최소 폭을 침범하지 못한다.
  {
    // filters(280) | patentList(320) — 800px 안에서 좌측을 0으로 끌어 본다.
    const split = makeSplitNode(
      'row', 0.5, makePanelNode(['filters']), makePanelNode(['patentList']),
    );
    const rect = { x: 0, y: 0, width: 800, height: 600 };
    const low = clampRatio(split, split.id, rect, 0, { panelMeta: meta, gap: LAYOUT_GAP });
    const high = clampRatio(split, split.id, rect, 1, { panelMeta: meta, gap: LAYOUT_GAP });
    const available = 800 - LAYOUT_GAP;
    expect('clampRatio: 하한이 좌측 최소폭(280) 이상', low * available >= 280 - 1,
      `${(low * available).toFixed(1)}px`);
    expect('clampRatio: 상한이 우측 최소폭(320)을 남김', (1 - high) * available >= 320 - 1,
      `${((1 - high) * available).toFixed(1)}px`);
    expect('clampRatio: 하한 <= 상한', low <= high, `${low.toFixed(3)} / ${high.toFixed(3)}`);
  }

  // clampRatio: 둘 다 만족 못 하는 좁은 폭에서는 반반.
  {
    const split = makeSplitNode(
      'row', 0.5, makePanelNode(['documentViewer']), makePanelNode(['patentList']),
    );
    const rect = { x: 0, y: 0, width: 400, height: 600 };
    const value = clampRatio(split, split.id, rect, 0.1, { panelMeta: meta, gap: LAYOUT_GAP });
    expect('clampRatio: 최소폭 합보다 좁으면 0.5', value === 0.5, `${value}`);
  }

  // dropZone: 네 삼각형 + 가운데 + 헤더.
  {
    // 헤더 높이는 DEFAULT_TAB_STRIP_HEIGHT(40) = workspace.css의 .lt-tabstrip 높이.
    const rect = { x: 0, y: 0, width: 400, height: 340 }; // 본문 300px + 헤더 40px
    const at = (x: number, y: number) => resolveDropTarget({ x, y }, rect, { tabRects: [] });
    expect('dropZone: 헤더 안 → tab', at(200, 10)?.kind === 'tab');
    expect('dropZone: 헤더 경계(40) 바로 아래는 본문',
      at(200, 41)?.kind === 'edge', JSON.stringify(at(200, 41)));
    expect('dropZone: 본문 위쪽 → top',
      JSON.stringify(at(200, 60)) === JSON.stringify({ kind: 'edge', edge: 'top' }),
      JSON.stringify(at(200, 60)));
    expect('dropZone: 본문 아래쪽 → bottom',
      JSON.stringify(at(200, 335)) === JSON.stringify({ kind: 'edge', edge: 'bottom' }),
      JSON.stringify(at(200, 335)));
    expect('dropZone: 왼쪽 → left',
      JSON.stringify(at(10, 190)) === JSON.stringify({ kind: 'edge', edge: 'left' }),
      JSON.stringify(at(10, 190)));
    expect('dropZone: 오른쪽 → right',
      JSON.stringify(at(390, 190)) === JSON.stringify({ kind: 'edge', edge: 'right' }),
      JSON.stringify(at(390, 190)));
    expect('dropZone: 가운데 → center', at(200, 190)?.kind === 'center', JSON.stringify(at(200, 190)));
    expect('dropZone: 사각형 밖 → null', at(500, 500) === null);
  }

  // dropZone: 탭 자리 index는 탭 중앙을 경계로 센다.
  {
    const rect = { x: 0, y: 0, width: 400, height: 340 };
    const tabRects = [
      { x: 0, y: 0, width: 80, height: 34 },
      { x: 80, y: 0, width: 80, height: 34 },
    ];
    const at = (x: number) => resolveDropTarget({ x, y: 10 }, rect, { tabRects });
    expect('dropZone: 첫 탭 왼쪽 절반 → index 0',
      JSON.stringify(at(10)) === JSON.stringify({ kind: 'tab', index: 0 }), JSON.stringify(at(10)));
    expect('dropZone: 첫 탭 오른쪽 절반 → index 1',
      JSON.stringify(at(70)) === JSON.stringify({ kind: 'tab', index: 1 }), JSON.stringify(at(70)));
    expect('dropZone: 마지막 탭 뒤 → index 2',
      JSON.stringify(at(300)) === JSON.stringify({ kind: 'tab', index: 2 }), JSON.stringify(at(300)));
  }

  // removePanel / removeTab: 부모 split이 형제로 대체되는지 (빈 공간이 남으면 안 된다).
  {
    const left = makePanelNode(['targets']);
    const right = makePanelNode(['patentList']);
    const tree = makeSplitNode('row', 0.3, left, right);
    const after = removePanel(tree, left.id);
    expect('removePanel: 형제가 분할을 물려받음', after?.id === right.id, after?.kind);
    expect('removePanel: 분할이 남지 않음', after ? collectSplits(after).length === 0 : false);
    expect('removePanel: 마지막 패널 제거 → null', removePanel(right, right.id) === null);
  }

  {
    const panel = makePanelNode(['schedule', 'todo']);
    const tree = makeSplitNode('row', 0.5, panel, makePanelNode(['patentList']));
    const one = removeTab(tree, panel.id, 'schedule');
    expect('removeTab: 탭만 빠지고 패널은 남음',
      one ? collectMountedTabs(one).join(',') === 'todo,patentList' : false,
      one ? collectMountedTabs(one).join(',') : 'null');
    const none = one ? removeTab(one, panel.id, 'todo') : null;
    expect('removeTab: 마지막 탭 제거 → 패널까지 사라짐',
      none ? collectPanels(none).length === 1 && collectSplits(none).length === 0 : false);
  }

  // removeTab: 보고 있던 탭을 닫으면 이웃 탭으로 넘어간다.
  {
    const panel = makePanelNode(['filters', 'schedule', 'todo'], 'schedule');
    const after = removeTab(panel, panel.id, 'schedule');
    const nextActive = after && after.kind === 'panel' ? after.activeTab : null;
    expect('removeTab: 활성 탭을 닫으면 이웃으로 이동', nextActive === 'todo', `${nextActive}`);
  }

  // insertPanel: edge에 따라 방향과 순서가 정해진다.
  {
    const target = makePanelNode(['patentList']);
    const added = makePanelNode(['documentViewer']);
    const right = insertPanel(target, target.id, 'right', added);
    expect('insertPanel: right → row 분할, 대상이 first',
      right.kind === 'split' && right.direction === 'row' && right.first.id === target.id);
    const top = insertPanel(target, target.id, 'top', added);
    expect('insertPanel: top → column 분할, 새 패널이 first',
      top.kind === 'split' && top.direction === 'column' && top.first.id === added.id);
  }

  // moveTabToEdge: 탭을 떼어 새 패널을 만든다.
  {
    const source = makePanelNode(['schedule', 'todo']);
    const target = makePanelNode(['patentList']);
    const tree = makeSplitNode('row', 0.5, source, target);
    const after = moveTabToEdge(tree, source.id, 'todo', target.id, 'bottom');
    expect('moveTabToEdge: 패널 수 2 → 3', collectPanels(after).length === 3,
      `${collectPanels(after).length}`);
    expect('moveTabToEdge: 탭 총수는 그대로', collectMountedTabs(after).length === 3,
      collectMountedTabs(after).join(','));
    const single = makePanelNode(['todo']);
    expect('moveTabToEdge: 탭 하나뿐인 패널을 자기 자신에 → 무시',
      moveTabToEdge(single, single.id, 'todo', single.id, 'left') === single);
  }

  // setRatio: MIN/MAX_RATIO 안전판.
  {
    const split = makeSplitNode('row', 0.5, makePanelNode(['targets']), makePanelNode(['patentList']));
    const low = setRatio(split, split.id, -1);
    const high = setRatio(split, split.id, 5);
    expect('setRatio: 하한 클램프',
      low.kind === 'split' && low.ratio >= 0.05, low.kind === 'split' ? `${low.ratio}` : '');
    expect('setRatio: 상한 클램프',
      high.kind === 'split' && high.ratio <= 0.95, high.kind === 'split' ? `${high.ratio}` : '');
  }

  // movePanel / mergePanel: 그립으로 패널을 통째로 옮기는 경로(탭 이동과 별개).
  {
    const left = makePanelNode(['filters', 'stagePipeline'], 'stagePipeline');
    const middle = makePanelNode(['targets']);
    const right = makePanelNode(['patentList']);
    const tree = makeSplitNode('row', 0.3, left, makeSplitNode('row', 0.5, middle, right));

    // 방향 드롭 → 대상 옆으로 이동. 패널 수는 그대로고 탭도 함께 따라간다.
    const moved = movePanel(tree, left.id, right.id, 'bottom');
    expect('movePanel: 패널 수 유지', collectPanels(moved).length === 3,
      `${collectPanels(moved).length}`);
    expect('movePanel: 탭을 전부 데리고 간다',
      collectMountedTabs(moved).length === 4, collectMountedTabs(moved).join(','));
    expect('movePanel: 대상 아래(column)로 들어간다', (() => {
      const parent = collectSplits(moved).find(
        (split) => split.first.id === right.id && split.second.id === left.id,
      );
      return parent?.direction === 'column';
    })());
    expect('movePanel: 떠난 자리의 분할이 정리된다', (() => {
      // left가 빠지면 루트 분할은 남은 형제(middle|right 분할)로 대체돼야 한다.
      const splits = collectSplits(moved);
      return splits.length === 2;
    })(), `${collectSplits(moved).length}`);
    expect('movePanel: 자기 자신에게 놓으면 무시',
      movePanel(tree, left.id, left.id, 'left') === tree);

    // 가운데/헤더 드롭 → 대상 패널에 합쳐지고 소스 노드는 사라진다.
    const merged = mergePanel(tree, left.id, right.id);
    expect('mergePanel: 패널 3 → 2', collectPanels(merged).length === 2,
      `${collectPanels(merged).length}`);
    expect('mergePanel: 탭 총수는 그대로',
      collectMountedTabs(merged).length === 4, collectMountedTabs(merged).join(','));
    const holder = collectPanels(merged).find((panel) => panel.tabs.includes('patentList'));
    expect('mergePanel: 소스의 탭 순서를 지킨다',
      holder?.tabs.join(',') === 'patentList,filters,stagePipeline', holder?.tabs.join(','));
    expect('mergePanel: 보고 있던 탭을 유지한다',
      holder?.activeTab === 'stagePipeline', `${holder?.activeTab}`);

    // 헤더의 index 자리에 끼워 넣는 경로.
    const mergedAt = mergePanel(tree, left.id, right.id, 0);
    const holderAt = collectPanels(mergedAt).find((panel) => panel.tabs.includes('patentList'));
    expect('mergePanel: index를 주면 그 자리부터 끼운다',
      holderAt?.tabs.join(',') === 'filters,stagePipeline,patentList', holderAt?.tabs.join(','));
    expect('mergePanel: 자기 자신에게 합치면 무시',
      mergePanel(tree, left.id, left.id) === tree);
  }

  // 문서 뷰어는 우측 상시 레일로 옮겨갔다(components/layout/RightSidebar). 이 화면의
  // 트리에 뷰어 자리를 만들던 withDocumentViewer 단정은 그래서 함께 지웠다.

  // 목록 패널이 없는 저장값은 못 쓰는 화면이라 기본 배치로 되돌린다.
  {
    window.localStorage.setItem(
      `patent-workspace-layout:${STORAGE_CHECK_USER}:v${ENGINE_LAYOUT_SCHEMA_VERSION}`,
      JSON.stringify({
        schemaVersion: ENGINE_LAYOUT_SCHEMA_VERSION,
        tree: { kind: 'panel', id: 'p', tabs: ['filters'], activeTab: 'filters' },
      }),
    );
    const recovered = readEngineLayout(STORAGE_CHECK_USER);
    expect('storage: 목록 패널이 없는 저장값 → 기본 배치',
      collectPanels(recovered).length === 4, `${collectPanels(recovered).length}`);
    removeEngineLayout(STORAGE_CHECK_USER);
  }

  // normalizeTree: 왕복 + 손상 입력 복구.
  {
    const tree = buildDefaultEngineLayout();
    const round = normalizeTree(JSON.parse(JSON.stringify(tree)), isEnginePanelTypeId);
    expect('normalizeTree: 왕복 후 구조 동일',
      JSON.stringify(round) === JSON.stringify(tree));
    expect('normalizeTree: 모르는 탭 id는 버림',
      normalizeTree({ kind: 'panel', id: 'a', tabs: ['nope'], activeTab: 'nope' }, isEnginePanelTypeId) === null);
    expect('normalizeTree: 완전 쓰레기 → null',
      normalizeTree({ kind: 'wat' }, isEnginePanelTypeId) === null);
    expect('normalizeTree: null → null', normalizeTree(null, isEnginePanelTypeId) === null);

    // 자식이 하나만 유효한 split은 접힌다.
    const halfBroken = normalizeTree({
      kind: 'split',
      id: 's',
      direction: 'row',
      ratio: 0.5,
      first: { kind: 'panel', id: 'p1', tabs: ['patentList'], activeTab: 'patentList' },
      second: { kind: 'panel', id: 'p2', tabs: ['unknown'], activeTab: 'unknown' },
    }, isEnginePanelTypeId);
    expect('normalizeTree: 반쪽 split은 살아남은 자식으로 접힘',
      halfBroken?.kind === 'panel', halfBroken?.kind);

    // 같은 탭이 두 곳에 있으면 처음 것만 남는다.
    const duplicated = normalizeTree({
      kind: 'split',
      id: 's',
      direction: 'row',
      ratio: 2,
      first: { kind: 'panel', id: 'p', tabs: ['filters'], activeTab: 'filters' },
      second: { kind: 'panel', id: 'p', tabs: ['filters'], activeTab: 'filters' },
    }, isEnginePanelTypeId);
    expect('normalizeTree: 중복 탭 제거 → 분할 접힘',
      duplicated?.kind === 'panel' && collectMountedTabs(duplicated).join(',') === 'filters',
      duplicated ? collectMountedTabs(duplicated).join(',') : 'null');
    const ratioClamped = normalizeTree({
      kind: 'split', id: 's', direction: 'row', ratio: 99,
      first: { kind: 'panel', id: 'p1', tabs: ['filters'], activeTab: 'filters' },
      second: { kind: 'panel', id: 'p2', tabs: ['targets'], activeTab: 'targets' },
    }, isEnginePanelTypeId);
    expect('normalizeTree: 범위 밖 ratio 클램프',
      ratioClamped?.kind === 'split' && ratioClamped.ratio === 0.95,
      ratioClamped?.kind === 'split' ? `${ratioClamped.ratio}` : '');
  }

  // 노드 id 중복은 새 id로 갈아 끼운다(React key 충돌 방지).
  {
    const tree = normalizeTree({
      kind: 'split', id: 'dup', direction: 'row', ratio: 0.5,
      first: { kind: 'panel', id: 'dup', tabs: ['filters'], activeTab: 'filters' },
      second: { kind: 'panel', id: 'dup', tabs: ['targets'], activeTab: 'targets' },
    }, isEnginePanelTypeId);
    const ids = tree ? [tree.id, ...collectPanels(tree).map((panel) => panel.id)] : [];
    expect('normalizeTree: 중복 노드 id 재발급', new Set(ids).size === ids.length, ids.join(','));
  }

  // localStorage 왕복 + 손상 값 폴백.
  {
    const tree = buildDefaultEngineLayout();
    writeEngineLayout(STORAGE_CHECK_USER, tree);
    const read = readEngineLayout(STORAGE_CHECK_USER);
    expect('storage: 저장 후 읽기 왕복', JSON.stringify(read) === JSON.stringify(tree));

    window.localStorage.setItem(
      `patent-workspace-layout:${STORAGE_CHECK_USER}:v${ENGINE_LAYOUT_SCHEMA_VERSION}`,
      '{ this is not json',
    );
    const recovered = readEngineLayout(STORAGE_CHECK_USER);
    expect('storage: 깨진 JSON → 기본 배치', collectPanels(recovered).length === 4,
      `${collectPanels(recovered).length}`);

    window.localStorage.setItem(
      `patent-workspace-layout:${STORAGE_CHECK_USER}:v${ENGINE_LAYOUT_SCHEMA_VERSION}`,
      JSON.stringify({ schemaVersion: 99, tree }),
    );
    expect('storage: 다른 schemaVersion → 기본 배치',
      collectPanels(readEngineLayout(STORAGE_CHECK_USER)).length === 4);
    removeEngineLayout(STORAGE_CHECK_USER);
  }

  return checks;
};

// ---- 화면 ----------------------------------------------------------------

const PANEL_TINT: Record<EnginePanelTypeId, string> = {
  filters: '#5B8FF9',
  stagePipeline: '#5AD8A6',
  targets: '#6DC8EC',
  patentList: '#9270CA',
};


const Harness: React.FC = () => {
  const [root, setRoot] = useState<LayoutNode>(() => readEngineLayout(HARNESS_USER));
  const checks = useMemo(runChecks, []);
  const failed = checks.filter((check) => !check.pass);
  const today = useMemo(() => new Date(), []);

  const apply = (next: LayoutNode | null) => {
    const tree = next ?? buildDefaultEngineLayout();
    setRoot(tree);
    writeEngineLayout(HARNESS_USER, tree);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: 12, gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto' }}>
        <strong style={{ fontSize: 14 }}>Layout engine harness</strong>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            color: '#fff',
            background: failed.length === 0 ? '#52c41a' : '#ff4d4f',
          }}
        >
          {failed.length === 0 ? `${checks.length} checks passed` : `${failed.length} / ${checks.length} failed`}
        </span>
        <Button
          size="small"
          onClick={() => {
            removeEngineLayout(HARNESS_USER);
            setRoot(buildDefaultEngineLayout());
          }}
        >
          배치 초기화
        </Button>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          탭을 끌어 다른 패널의 위/아래/좌/우 또는 가운데에 놓아 보세요. 새로고침하면 배치가 유지됩니다.
        </span>
      </div>

      <MovableGrid
        root={root}
        onChange={apply}
        allTabs={ENGINE_PANEL_TYPES}
        describeTab={(tabId) => {
          const meta = isEnginePanelTypeId(tabId) ? ENGINE_PANEL_META[tabId] : undefined;
          return meta ?? { title: tabId, closable: true, minWidth: 200, minHeight: 120 };
        }}
        renderTab={(tabId) => {
          if (!isEnginePanelTypeId(tabId)) return null;
          return (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 4,
                background: `${PANEL_TINT[tabId]}22`,
                color: PANEL_TINT[tabId],
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <span>{tabId}</span>
              <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>
                min {ENGINE_PANEL_META[tabId].minWidth}×{ENGINE_PANEL_META[tabId].minHeight}
              </span>
            </div>
          );
        }}
        stackBreakpoint={ENGINE_STACK_BREAKPOINT}
      />

      <details style={{ flex: '0 0 auto', maxHeight: '30vh', overflow: 'auto', fontSize: 12 }} open={failed.length > 0}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>순수 함수 단정 결과</summary>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>
          {checks.map((check) => (
            <li key={check.name} style={{ color: check.pass ? '#52c41a' : '#ff4d4f' }}>
              {check.pass ? 'PASS' : 'FAIL'} — {check.name}
              {check.detail && !check.pass ? ` (${check.detail})` : ''}
            </li>
          ))}
        </ul>
      </details>
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
