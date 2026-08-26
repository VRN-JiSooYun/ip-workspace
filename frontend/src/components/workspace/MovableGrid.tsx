import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_TAB_STRIP_HEIGHT,
  LAYOUT_GAP,
  addTab,
  clampRatio,
  collectMountedTabs,
  collectSplits,
  findPanel,
  measure,
  mergePanel,
  moveTab,
  movePanel,
  moveTabToEdge,
  previewRect,
  removeTab,
  removeTabAnywhere,
  resolveDropTarget,
  setActiveTab,
  setRatio,
  type DropTarget,
  type LayoutNode,
  type PanelMeta,
  type Rect,
} from '../../lib/layoutTree';
import DropOverlay from './DropOverlay';
import PanelFrame from './PanelFrame';
import Splitter from './Splitter';
import { useContainerSize } from './useContainerSize';
import './workspace.css';

/** 이만큼 움직여야 드래그로 본다. 탭을 그냥 누른 것과 구분하기 위한 값. */
const DRAG_THRESHOLD = 5;

export type TabInfo = PanelMeta & {
  title: string;
  closable: boolean;
};

type Props = {
  root: LayoutNode;
  /** null이면 트리가 비었다는 뜻이다. 부르는 쪽이 기본 배치로 되돌려야 한다. */
  onChange: (next: LayoutNode | null) => void;
  /** 이 화면이 가진 패널 타입 전부. '패널 추가' 메뉴에 나열된다. */
  allTabs: readonly string[];
  describeTab: (tabId: string) => TabInfo;
  renderTab: (tabId: string) => React.ReactNode;
  gap?: number;
  /** 이 폭 아래에서는 트리를 접고 세로로 쌓는다. */
  stackBreakpoint?: number;
};

type DragState = {
  /**
   * 무엇을 끌고 있는지. 헤더의 손잡이가 두 개라 구분이 필요하다.
   *   'tab'   → 탭 하나. 다른 패널로 옮기거나 떼어내 새 패널로 만든다
   *   'panel' → 패널 전체. 탭을 전부 데리고 움직이거나 대상 패널에 합쳐진다
   */
  kind: 'tab' | 'panel';
  fromPanelId: string;
  /** kind가 'panel'이면 null. */
  tabId: string | null;
  startClient: { x: number; y: number };
  /** 임계값을 넘겨 실제로 끌고 있는 상태. */
  active: boolean;
  targetPanelId: string | null;
  target: DropTarget | null;
};

/**
 * 이진 트리 레이아웃을 실제 DOM에 그리는 컨테이너.
 *
 * 트리(root)가 유일한 진실이고 좌표는 매 렌더에서 measure로 다시 구하는 파생값이다.
 * 이 컴포넌트는 레이아웃 로직을 갖지 않고 lib/layoutTree의 순수 함수를 호출할 뿐이며,
 * 패널 내용은 renderTab으로 주입받는다(내용과 배치의 분리).
 */
const MovableGrid: React.FC<Props> = ({
  root,
  onChange,
  allTabs,
  describeTab,
  renderTab,
  gap = LAYOUT_GAP,
  stackBreakpoint = 0,
}) => {
  const { ref, size, measured } = useContainerSize<HTMLDivElement>();
  const [dragView, setDragView] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const setDrag = useCallback((next: DragState | null) => {
    dragRef.current = next;
    setDragView(next);
  }, []);

  const panelMeta = useCallback((tabId: string): PanelMeta => {
    const info = describeTab(tabId);
    return { minWidth: info.minWidth, minHeight: info.minHeight };
  }, [describeTab]);

  const stacked = stackBreakpoint > 0 && size.width > 0 && size.width < stackBreakpoint;
  const containerRect = useMemo<Rect>(
    () => ({ x: 0, y: 0, width: size.width, height: size.height }),
    [size.width, size.height],
  );

  const layout = useMemo(
    () => measure(root, containerRect, { gap, stacked, panelMeta }),
    [root, containerRect, gap, stacked, panelMeta],
  );

  const mountedTabs = useMemo(() => collectMountedTabs(root), [root]);
  const panelRectById = useMemo(
    () => new Map(layout.panels.map((panel) => [panel.panelId, panel])),
    [layout],
  );

  /**
   * window 리스너와 콜백이 최신 값을 보게 하는 상자. 리스너를 드래그마다 다시 붙이지
   * 않으려면(붙였다 떼는 사이에 이벤트가 새는 것을 막으려면) 이 방식이 필요하다.
   */
  const latest = useRef({ root, layout, gap, onChange, containerRect, panelMeta, stacked });
  latest.current = { root, layout, gap, onChange, containerRect, panelMeta, stacked };

  // ---- 리사이즈 ----------------------------------------------------------

  const applyRatio = useCallback((splitId: string, rawRatio: number) => {
    const current = latest.current;
    const next = clampRatio(current.root, splitId, current.containerRect, rawRatio, {
      panelMeta: current.panelMeta,
      gap: current.gap,
    });
    current.onChange(setRatio(current.root, splitId, next));
  }, []);

  const handleSplitterDrag = useCallback((splitId: string, client: { x: number; y: number }) => {
    const container = ref.current;
    if (!container) return;
    const current = latest.current;
    const split = collectSplits(current.root).find((node) => node.id === splitId);
    const area = current.layout.nodeRects.get(splitId);
    if (!split || !area) return;

    const base = container.getBoundingClientRect();
    const available = (split.direction === 'row' ? area.width : area.height) - current.gap;
    if (available <= 0) return;

    // 분할선의 중심이 커서에 오도록, gap의 절반을 보정해 비율을 구한다.
    const offset = split.direction === 'row'
      ? client.x - base.left - area.x - current.gap / 2
      : client.y - base.top - area.y - current.gap / 2;
    applyRatio(splitId, offset / available);
  }, [applyRatio, ref]);

  const handleSplitterNudge = useCallback((splitId: string, deltaPx: number) => {
    const current = latest.current;
    const split = collectSplits(current.root).find((node) => node.id === splitId);
    const area = current.layout.nodeRects.get(splitId);
    if (!split || !area) return;
    const available = (split.direction === 'row' ? area.width : area.height) - current.gap;
    if (available <= 0) return;
    applyRatio(splitId, split.ratio + deltaPx / available);
  }, [applyRatio]);

  // ---- 탭 조작 ------------------------------------------------------------

  const handleActivate = useCallback((panelId: string, tabId: string) => {
    const current = latest.current;
    const panel = findPanel(current.root, panelId);
    if (!panel || panel.activeTab === tabId) return;
    current.onChange(setActiveTab(current.root, panelId, tabId));
  }, []);

  const handleClose = useCallback((panelId: string, tabId: string) => {
    const current = latest.current;
    current.onChange(removeTab(current.root, panelId, tabId));
  }, []);

  const handleAdd = useCallback((panelId: string, tabId: string) => {
    const current = latest.current;
    // 타입당 하나만 둔다. 메뉴에서 이미 열린 항목은 비활성이지만 방어적으로 한 번 더 뗀다.
    const detached = removeTabAnywhere(current.root, tabId) ?? current.root;
    // 뗀 결과로 대상 패널까지 사라졌다면 붙일 곳이 없다.
    if (!findPanel(detached, panelId)) return;
    current.onChange(addTab(detached, panelId, tabId));
  }, []);

  // ---- 탭 드래그 ----------------------------------------------------------

  const handleTabPointerDown = useCallback((
    panelId: string,
    tabId: string,
    event: React.PointerEvent,
  ) => {
    if (event.button !== 0) return;
    setDrag({
      kind: 'tab',
      fromPanelId: panelId,
      tabId,
      startClient: { x: event.clientX, y: event.clientY },
      active: false,
      targetPanelId: null,
      target: null,
    });
  }, [setDrag]);

  /** 좌측 그립. 탭 드래그와 같은 추적을 쓰지만 옮기는 대상이 패널 전체다. */
  const handlePanelPointerDown = useCallback((panelId: string, event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    setDrag({
      kind: 'panel',
      fromPanelId: panelId,
      tabId: null,
      startClient: { x: event.clientX, y: event.clientY },
      active: false,
      targetPanelId: null,
      target: null,
    });
  }, [setDrag]);

  /** 드롭 대상 탭 스트립의 탭 사각형들. 몇 번째 자리에 끼울지 판정에 쓴다. */
  const tabRectsOf = useCallback((panelId: string): Rect[] => {
    const container = ref.current;
    if (!container) return [];
    const base = container.getBoundingClientRect();
    return Array.from(
      container.querySelectorAll<HTMLElement>(`[data-panel-id="${panelId}"] [data-tab-id]`),
    ).map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.left - base.left,
        y: rect.top - base.top,
        width: rect.width,
        height: rect.height,
      };
    });
  }, [ref]);

  const isDragging = dragView !== null;

  useEffect(() => {
    if (!isDragging) return;
    const container = ref.current;
    if (!container) return;

    const handleMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const moved = Math.hypot(
        event.clientX - drag.startClient.x,
        event.clientY - drag.startClient.y,
      );
      if (moved < DRAG_THRESHOLD) return;

      const base = container.getBoundingClientRect();
      const local = { x: event.clientX - base.left, y: event.clientY - base.top };
      const hit = latest.current.layout.panels.find((panel) => (
        local.x >= panel.x && local.x <= panel.x + panel.width &&
        local.y >= panel.y && local.y <= panel.y + panel.height
      ));

      // 패널을 자기 자신 위에 놓는 것은 아무 일도 아니다. 미리보기도 띄우지 않는다.
      if (!hit || (drag.kind === 'panel' && hit.panelId === drag.fromPanelId)) {
        setDrag({ ...drag, active: true, targetPanelId: null, target: null });
        return;
      }
      const target = resolveDropTarget(local, hit, {
        tabStripHeight: DEFAULT_TAB_STRIP_HEIGHT,
        tabRects: tabRectsOf(hit.panelId),
      });
      setDrag({ ...drag, active: true, targetPanelId: hit.panelId, target });
    };

    const commit = () => {
      const drag = dragRef.current;
      setDrag(null);
      if (!drag?.active || !drag.target || !drag.targetPanelId) return;

      const { root: currentRoot, onChange: emit } = latest.current;
      const { kind, fromPanelId, tabId, targetPanelId, target } = drag;

      if (kind === 'panel') {
        // 방향이 있으면 패널을 그 자리로 옮기고, 가운데·탭 스트립이면 대상에 합친다.
        emit(target.kind === 'edge'
          ? movePanel(currentRoot, fromPanelId, targetPanelId, target.edge)
          : mergePanel(
            currentRoot,
            fromPanelId,
            targetPanelId,
            target.kind === 'tab' ? target.index : undefined,
          ));
        return;
      }

      if (!tabId) return;

      if (target.kind === 'edge') {
        emit(moveTabToEdge(currentRoot, fromPanelId, tabId, targetPanelId, target.edge));
        return;
      }
      if (target.kind === 'center') {
        emit(moveTab(currentRoot, fromPanelId, tabId, targetPanelId));
        return;
      }

      // 탭 스트립 드롭. DOM에서 센 index는 끌고 있는 탭이 아직 목록에 있는 상태의
      // 자리라, 같은 패널 안에서 뒤쪽으로 옮길 때는 하나를 빼야 제자리에 놓인다.
      const source = findPanel(currentRoot, fromPanelId);
      const from = source?.tabs.indexOf(tabId) ?? -1;
      const index = fromPanelId === targetPanelId && from >= 0 && target.index > from
        ? target.index - 1
        : target.index;
      emit(moveTab(currentRoot, fromPanelId, tabId, targetPanelId, index));
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrag(null);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', commit);
    window.addEventListener('pointercancel', commit);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', commit);
      window.removeEventListener('pointercancel', commit);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDragging, ref, setDrag, tabRectsOf]);

  // ---- 렌더 --------------------------------------------------------------

  const overlay = useMemo(() => {
    if (!dragView?.active || !dragView.target || !dragView.targetPanelId) return null;
    const hit = panelRectById.get(dragView.targetPanelId);
    if (!hit) return null;
    return {
      rect: previewRect(dragView.target, hit, { tabStripHeight: DEFAULT_TAB_STRIP_HEIGHT }),
      variant: dragView.target.kind === 'edge' ? ('split' as const) : ('merge' as const),
    };
  }, [dragView, panelRectById]);

  const describeSplitter = useCallback((splitId: string): string => {
    const split = collectSplits(root).find((node) => node.id === splitId);
    return split?.direction === 'row' ? '좌우 패널 크기 조절' : '위아래 패널 크기 조절';
  }, [root]);

  return (
    <div
      ref={ref}
      className={`lt-grid${stacked ? ' lt-grid-stacked' : ''}${dragView?.active ? ' lt-grid-dragging' : ''}`}
    >
      {/* 폭을 재기 전에 그리면 모든 패널이 0px로 한 번 깜빡인다. */}
      {measured && size.width > 0 && (
        <div
          className="lt-grid-canvas"
          style={{ height: stacked ? layout.contentHeight : '100%' }}
        >
          {layout.panels.map((rect) => {
            const panel = findPanel(root, rect.panelId);
            if (!panel) return null;
            return (
              <div
                key={panel.id}
                className="lt-panel-slot"
                style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
              >
                <PanelFrame
                  panel={panel}
                  describeTab={describeTab}
                  renderTab={renderTab}
                  allTabs={allTabs}
                  mountedTabs={mountedTabs}
                  onActivate={handleActivate}
                  onClose={handleClose}
                  onAdd={handleAdd}
                  onTabPointerDown={handleTabPointerDown}
                  onPanelPointerDown={handlePanelPointerDown}
                  draggingTab={
                    dragView?.active && dragView.kind === 'tab' && dragView.fromPanelId === panel.id
                      ? dragView.tabId
                      : null
                  }
                  draggingPanel={
                    dragView?.active === true &&
                    dragView.kind === 'panel' &&
                    dragView.fromPanelId === panel.id
                  }
                  interactive={!stacked}
                />
              </div>
            );
          })}

          {layout.splitters.map((rect) => (
            <Splitter
              key={rect.splitId}
              rect={rect}
              onDragMove={handleSplitterDrag}
              onDragEnd={() => undefined}
              onNudge={handleSplitterNudge}
              label={describeSplitter(rect.splitId)}
            />
          ))}

          <DropOverlay rect={overlay?.rect ?? null} variant={overlay?.variant ?? 'split'} />
        </div>
      )}
    </div>
  );
};

export default MovableGrid;
