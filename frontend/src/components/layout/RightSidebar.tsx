import React from 'react';
import {
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  ListChecks,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import ResizableSidePanel from '../common/ResizableSidePanel';
import DocumentRailPanel from './rail/DocumentRailPanel';
import ScheduleRailPanel from './rail/ScheduleRailPanel';
import TodoRailPanel from './rail/TodoRailPanel';
import {
  RAIL_MAX_WIDTH,
  RAIL_MIN_WIDTH,
  RAIL_WIDTH,
  RIGHT_RAIL_ITEMS,
  useRightSidebarStore,
  type RightRailItemId,
} from '../../store/useRightSidebarStore';
import './rightSidebar.css';

/**
 * 레일을 아무리 넓혀도 본문에 남겨 둘 폭.
 *
 * ResizableSidePanel의 minSiblingWidth는 '핸들의 앞 형제'를 기준으로 재는데, 레일에서는
 * 핸들이 컨테이너의 첫 자식이라 그 기준이 없다. 그래서 상한을 여기서 창 폭으로 직접 잡는다.
 */
const MIN_MAIN_WIDTH = 480;

/** 폭 조절 핸들이 먹는 폭. ResizableSidePanel.css의 `flex: 0 0 14px`과 같은 값이어야 한다. */
const HANDLE_WIDTH = 14;

/** 열기·닫기 전환 시간. rightSidebar.css의 `.rs-shell` transition과 같은 값이어야 한다. */
const PANEL_ANIMATION_MS = 200;

const computeMaxWidth = (): number => {
  if (typeof window === 'undefined') return RAIL_MAX_WIDTH;
  return Math.max(0, Math.min(
    RAIL_MAX_WIDTH,
    window.innerWidth - RAIL_WIDTH - HANDLE_WIDTH - MIN_MAIN_WIDTH,
  ));
};

type RailItem = {
  id: RightRailItemId;
  label: string;
  icon: React.ReactNode;
  Panel: React.ComponentType;
};

const RAIL_ITEMS: RailItem[] = [
  { id: 'documents', label: '문서', icon: <FileText size={19} />, Panel: DocumentRailPanel },
  { id: 'schedule', label: '일정', icon: <CalendarDays size={19} />, Panel: ScheduleRailPanel },
  { id: 'todo', label: 'To-do', icon: <ListChecks size={19} />, Panel: TodoRailPanel },
];

const ITEM_BY_ID = new Map(RAIL_ITEMS.map((item) => [item.id, item]));

/**
 * 우측 상시 레일.
 *
 * 아이콘 레일은 항상 보이고, 그 왼쪽에 고른 항목의 내용 패널이 붙는다. 같은 아이콘을 다시
 * 누르면 접히고, 레일 맨 위 화살표로도 접었다 펼 수 있다. 토스증권 우측 사이드바와 같은
 * 모델이다.
 *
 * **왜 트리(MovableGrid)가 아니라 레일인가**: 문서 뷰어·일정·To-do는 특정 화면의 내용이
 * 아니라 어느 화면에서든 곁에 두고 보는 도구다. 트리에 넣으면 화면마다 배치를 따로
 * 만들어야 하고, 화면을 옮기면 사라진다. 레일은 화면 밖에 있어 그대로 남는다.
 *
 * 폭은 **항목마다 따로** 갖는다. 하나의 고정폭을 쓸 수 없다 — 문서 뷰어는 PDF가 읽혀야
 * 해서 넓어야 하고, 일정·To-do는 좁아도 된다. 조절한 값은 저장된다.
 */
const RightSidebar: React.FC = () => {
  const activeItem = useRightSidebarStore((state) => state.activeItem);
  const widths = useRightSidebarStore((state) => state.widths);
  const toggleItem = useRightSidebarStore((state) => state.toggleItem);
  const toggleCollapsed = useRightSidebarStore((state) => state.toggleCollapsed);
  const collapse = useRightSidebarStore((state) => state.collapse);
  const setWidth = useRightSidebarStore((state) => state.setWidth);
  const hasDocuments = useRightSidebarStore((state) => state.documentContext !== null);
  /**
   * 문서 패널 머리줄 부제. 어느 특허의 문서를 보고 있는지가 안 보이면 화면을 옮긴 뒤 헷갈린다.
   *
   * 보여 주는 값은 지금 고른 통지 건의 출원번호다. 내부관리번호(`context.label`)는 조직 안에서만
   * 통하는 이름이라, 문서를 남에게 짚어 줄 때 쓰는 번호를 부제로 둔다. 출원번호가 없는 건
   * (검색 결과에서 온 문서)에만 label로 물러난다.
   */
  const documentSubtitle = useRightSidebarStore((state) => {
    const context = state.documentContext;
    if (!context) return null;
    const activeDocument = context.items.find(
      (item) => item.officeActionId === context.activeId,
    ) ?? context.items[0];
    return activeDocument?.applicationNumber ?? context.label;
  });

  const active = activeItem ? ITEM_BY_ID.get(activeItem) : undefined;

  const handleWidthChange = React.useCallback((next: number) => {
    if (activeItem) setWidth(activeItem, next);
  }, [activeItem, setWidth]);

  /** 창이 바뀌면 상한도 '넓게 보기' 폭도 바뀐다. 드래그 중에는 mousemove가 이미 클램프한다. */
  const [maxWidth, setMaxWidth] = React.useState(computeMaxWidth);
  const [viewportWidth, setViewportWidth] = React.useState(
    () => (typeof window === 'undefined' ? 0 : window.innerWidth),
  );
  React.useEffect(() => {
    const onResize = () => {
      setMaxWidth(computeMaxWidth());
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /**
   * 넓게 보기.
   *
   * 본문 최소 폭(MIN_MAIN_WIDTH)은 극단 드래그로 본문이 129px까지 짓눌리던 것을 막는
   * 방어선이라 풀지 않는다. 대신 이 모드에서는 패널을 **본문 위로 띄운다** — 본문을
   * 밀어내는 것이 아니라 덮으므로 보호를 깨지 않고도 화면 가득 문서를 볼 수 있다.
   * 자세한 배치는 rightSidebar.css의 `.rs-shell-wide`에 있다.
   *
   * 저장하지 않는다. 읽는 동안만 쓰는 모드라, 새로고침했더니 본문이 가려진 채 시작하는
   * 편보다 꺼진 채 시작하는 편이 덜 놀랍다(화면 이동으로는 유지된다).
   */
  const [wide, setWide] = React.useState(false);

  /** 이 항목이 지금 화면에서 가질 수 있는 최대 폭. 최소 폭보다 작아지지는 않는다. */
  const effectiveMax = React.useCallback((item: RightRailItemId) => (
    Math.max(RAIL_MIN_WIDTH[item], maxWidth)
  ), [maxWidth]);

  /**
   * 드래그 중에는 폭 전환을 끈다. 전환이 켜져 있으면 패널이 커서를 뒤늦게 따라와
   * 뻣뻣하게 느껴진다 — 바로 이 화면에서 실제로 겪은 문제다.
   */
  const [isResizing, setIsResizing] = React.useState(false);

  /** 레일을 접으면 넓게 보기도 끝난다. 다시 펼 때 화면이 덮인 채로 열리면 놀란다. */
  React.useEffect(() => {
    if (!activeItem) setWide(false);
  }, [activeItem]);

  /** 덮고 있는 모드는 Esc로 빠져나갈 수 있어야 한다. */
  React.useEffect(() => {
    if (!wide) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWide(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [wide]);

  /**
   * 접히는 동안에도 내용을 남겨 둘 항목.
   *
   * `active`가 null이 되는 순간 언마운트하면 슬라이드가 빈 칸을 접는 모양이 된다. 전환이
   * 끝난 뒤에 치운다. transitionend가 아니라 타이머를 쓰는 이유: 전환이 꺼진 환경
   * (prefers-reduced-motion)에서는 그 이벤트가 오지 않아 내용이 영원히 남는다.
   */
  const [mounted, setMounted] = React.useState<RailItem | undefined>(active);
  React.useEffect(() => {
    if (active) setMounted(active);
  }, [active]);
  React.useEffect(() => {
    if (activeItem) return undefined;
    const timer = window.setTimeout(() => setMounted(undefined), PANEL_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [activeItem]);

  /**
   * 패널 본문. 마운트된 항목이 바뀔 때만 새로 만든다.
   *
   * 폭이 바뀔 때마다 `<Panel />`을 새로 그리면 달력 42칸·To-do 목록이 mousemove마다
   * 리컨실된다. 엘리먼트 참조를 고정해 두면 React가 그 subtree를 건너뛴다.
   */
  const panelBody = React.useMemo(
    () => (mounted ? <mounted.Panel /> : null),
    [mounted],
  );

  // 펼쳐져 있으면 패널 + 핸들 폭, 접혀 있으면 0. 이 값이 전환의 대상이다.
  const expanded = Boolean(active);
  const shellWidth = active
    ? Math.min(widths[active.id], effectiveMax(active.id)) + HANDLE_WIDTH
    : 0;
  /**
   * 넓게 보기의 폭. 아이콘 레일 자리는 남긴다 — 그 자리가 없으면 이 모드를 끌 길이 화면에서
   * 사라진다(패널 머리줄의 토글과 Esc가 남지만, 눈에 보이는 출구가 있어야 한다).
   */
  const wideWidth = Math.max(shellWidth, viewportWidth - RAIL_WIDTH);

  return (
    <div className="rs-root">
      <div
        className={
          `rs-shell${isResizing ? ' rs-shell-instant' : ''}${wide ? ' rs-shell-wide' : ''}`
        }
        style={{ width: wide ? wideWidth : shellWidth }}
        // 접힌 뒤에는 안의 내용이 키보드·스크린리더에 잡히지 않아야 한다.
        aria-hidden={!expanded}
      >
        {mounted ? (
          <ResizableSidePanel
            label={`${mounted.label} 패널 너비 조절`}
            min={RAIL_MIN_WIDTH[mounted.id]}
            max={effectiveMax(mounted.id)}
            // 저장된 값은 '사용자가 원한 폭'이고, 그릴 때는 '지금 들어가는 폭'으로 자른다.
            // ResizeObserver가 나중에 바로잡아 주기를 기다리지 않는다 — 넓은 화면에서 저장한
            // 폭으로 좁은 화면에서 열면 한 프레임이라도 본문을 짓누르고 시작한다.
            width={Math.min(widths[mounted.id], effectiveMax(mounted.id))}
            onWidthChange={handleWidthChange}
            onResizingChange={setIsResizing}
            // 최소 폭보다 더 좁히려고 밀면 접는다. 레일 아이콘이 남으므로 다시 열 길은 있다.
            onCollapse={collapse}
            // 상한보다 더 넓히려고 밀면 넓게 보기로 넘어간다. 상한에서 막히기만 하면
            // '왜 안 늘어나지'로 끝나는데, 그때 원하는 것이 바로 이 모드다.
            onExpandBeyondMax={() => setWide(true)}
          >
            <div className="rs-panel">
              <div className="rs-panel-head">
                <span className="rs-panel-title">{mounted.label}</span>
                {mounted.id === 'documents' && documentSubtitle ? (
                  <span className="rs-panel-subtitle" title={documentSubtitle}>
                    {documentSubtitle}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="rs-panel-wide"
                  aria-pressed={wide}
                  aria-label={wide ? '넓게 보기 끄기' : '넓게 보기'}
                  title={wide ? '넓게 보기 끄기 (Esc)' : '넓게 보기'}
                  onClick={() => setWide((current) => !current)}
                >
                  {wide ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
              </div>
              <div className="rs-panel-body">{panelBody}</div>
            </div>
          </ResizableSidePanel>
        ) : null}
      </div>

      {/* 넓게 보기에서 셸이 흐름 밖으로 나가면 본문이 그만큼 넓어졌다가 모드를 끌 때 되돌아온다.
          가려진 채로 본문을 두 번 다시 배치하는 셈이라, 셸이 쓰던 자리를 그대로 잡아 둔다. */}
      {wide && (
        <div className="rs-shell-spacer" style={{ width: shellWidth }} aria-hidden="true" />
      )}

      <nav className="rs-rail" aria-label="우측 사이드바">
        {/*
          맨 위 화살표. 접혔는지 펼쳐졌는지와 "누르면 어느 쪽으로 움직이는지"를 방향으로
          알린다(펼쳐져 있으면 오른쪽=닫기, 접혀 있으면 왼쪽=열기). 접힌 상태에서 누르면
          마지막으로 보던 항목이 다시 열린다(store의 lastItem).
        */}
        <button
          type="button"
          className="rs-rail-toggle"
          aria-label={expanded ? '사이드바 접기' : '사이드바 펼치기'}
          aria-expanded={expanded}
          title={expanded ? '사이드바 접기' : '사이드바 펼치기'}
          onClick={toggleCollapsed}
        >
          {expanded ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        </button>

        <span className="rs-rail-divider" aria-hidden="true" />

        {/*
          레일 항목에는 tooltip을 달지 않는다. 아이콘 아래에 라벨이 이미 보이므로 같은 글자를
          한 번 더 띄우는 것이고, 무엇보다 hover tooltip은 눌러서 레이아웃이 바뀌는 버튼에서
          빠져나오지 못하고 화면에 남는다(mouseleave를 놓친다). 문서가 비어 있을 때의 안내는
          패널 본문이 직접 말한다(DocumentRailPanel의 빈 상태).
        */}
        {RAIL_ITEMS.map((item) => {
          const isActive = activeItem === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`rs-rail-item${isActive ? ' rs-rail-item-active' : ''}`}
              aria-label={item.label}
              aria-pressed={isActive}
              onClick={() => toggleItem(item.id)}
            >
              <span className="rs-rail-icon">{item.icon}</span>
              <span className="rs-rail-label">{item.label}</span>
              {/* 문서가 올라와 있는데 접혀 있으면 볼 것이 있다는 표시를 남긴다. */}
              {item.id === 'documents' && hasDocuments && !isActive ? (
                <span className="rs-rail-dot" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export { RIGHT_RAIL_ITEMS };
export default RightSidebar;
