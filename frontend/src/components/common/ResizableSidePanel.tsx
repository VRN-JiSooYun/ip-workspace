import React, { useCallback, useEffect, useRef, useState } from 'react';
import './ResizableSidePanel.css';

/** 문서 뷰어 패널의 공용 기본값. 특허 관리·의견제출통지서 화면이 같은 값을 쓴다. */
export const SIDE_PANEL_MIN_WIDTH = 380;
export const SIDE_PANEL_DEFAULT_WIDTH = 830;
export const SIDE_PANEL_MAX_WIDTH = 1000;
/** 왼쪽 본문에 최소한 남겨 둘 폭. 이만큼은 목록이 살아 있어야 한다. */
export const SIDE_PANEL_MIN_SIBLING_WIDTH = 320;
const RESIZE_STEP = 24;
/**
 * 최소 폭에서 이만큼 더 밀어야 접힌다.
 *
 * 여유 없이 최소 폭을 스치자마자 접으면, 최소 폭 근처로 좁히려던 드래그가 자꾸 패널을
 * 없애 버린다. 반대로 너무 크면 접으려고 화면 끝까지 밀어야 한다.
 */
const COLLAPSE_SLACK = 64;

type Props = {
  min?: number;
  max?: number;
  defaultWidth?: number;
  /** 핸들 왼쪽 형제(본문)에 남겨 둘 최소 폭. */
  minSiblingWidth?: number;
  /** separator의 aria-label. 화면마다 무엇을 조절하는지 밝힌다. */
  label: string;
  /**
   * 폭을 부모가 소유할 때 넘긴다(controlled). 이 값이 있으면 내부 state를 쓰지 않으므로
   * 폭을 저장하거나 항목마다 다르게 둘 수 있다. 없으면 예전처럼 스스로 들고 있다.
   */
  width?: number;
  /** controlled일 때 폭이 바뀔 때마다 부른다. clamp를 통과한 값만 온다. */
  onWidthChange?: (width: number) => void;
  /**
   * 드래그 시작·종료를 알린다. 부르는 쪽이 드래그 중에는 폭 애니메이션을 꺼야 하기
   * 때문이다(전환이 켜져 있으면 패널이 커서를 뒤늦게 따라와 뻣뻣하게 느껴진다).
   */
  onResizingChange?: (resizing: boolean) => void;
  /**
   * 최소 폭보다 더 좁히려고 밀었을 때 부른다. 패널을 접는 것은 부르는 쪽 몫이다
   * (이 컴포넌트는 접힌 상태를 모른다 — 접히면 부모가 아예 렌더하지 않는다).
   *
   * 넘기지 않으면 예전처럼 최소 폭에서 멈춘다.
   */
  onCollapse?: () => void;
  children: React.ReactNode;
};

/**
 * 왼쪽 경계를 끌어 너비를 조절하는 우측 패널.
 *
 * 핸들과 패널을 형제로 렌더하므로 부모가 flex든 grid든 그대로 쓸 수 있다.
 * grid에서는 두 칸을 차지하니 `grid-template-columns`에 핸들 몫(14px)을 함께 선언해야 한다.
 *
 * 너비는 이 컴포넌트가 들고 있다. 저장하지 않으므로 화면을 떠나면 기본값으로 돌아간다.
 */
const ResizableSidePanel: React.FC<Props> = ({
  min = SIDE_PANEL_MIN_WIDTH,
  max = SIDE_PANEL_MAX_WIDTH,
  defaultWidth = SIDE_PANEL_DEFAULT_WIDTH,
  minSiblingWidth = SIDE_PANEL_MIN_SIBLING_WIDTH,
  label,
  width: controlledWidth,
  onWidthChange,
  onResizingChange,
  onCollapse,
  children,
}) => {
  const [uncontrolledWidth, setUncontrolledWidth] = useState(defaultWidth);
  const isControlled = controlledWidth !== undefined;
  const width = isControlled ? controlledWidth : uncontrolledWidth;
  const [isResizing, setIsResizing] = useState(false);

  /**
   * 아래 로직은 전부 `setWidth(다음값 또는 updater)` 형태로 쓰여 있다. controlled에서도
   * 같은 모양을 유지하려고 updater를 여기서 풀어 현재 폭을 넣어 준다.
   */
  const setWidth = useCallback(
    (next: number | ((current: number) => number)) => {
      const resolve = (current: number) => (
        typeof next === 'function' ? (next as (value: number) => number)(current) : next
      );
      if (isControlled) onWidthChange?.(resolve(controlledWidth as number));
      else setUncontrolledWidth((current) => resolve(current));
    },
    [controlledWidth, isControlled, onWidthChange],
  );
  const handleRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  /** 이번 드래그를 시작할 때의 폭. 접을 때 되돌리려고 들고 있는다(아래 collapse 참고). */
  const widthAtDragStart = useRef(width);

  /**
   * 최소 폭 아래로 더 민 결과: 드래그를 끝내고 접는다.
   *
   * 접기 전에 드래그 시작 폭으로 되돌린다. 미는 동안 폭은 최소 폭에 붙어 있어서, 그대로 두면
   * 다시 펼쳤을 때 최소 폭으로 열린다. 사용자가 고른 폭은 밀기 시작하기 전의 그것이지
   * '접으려고 지나친 최소 폭'이 아니다.
   */
  const collapse = useCallback(() => {
    setIsResizing(false);
    setWidth(widthAtDragStart.current);
    onCollapse?.();
  }, [onCollapse, setWidth]);

  /**
   * `max`만으로 자르면 화면이 좁을 때 본문이 0px까지 눌려 목록이 사라진다.
   * 핸들 왼쪽 형제(본문)의 왼쪽 경계를 기준으로 실제 상한을 다시 계산한다.
   */
  const clamp = useCallback(
    (value: number) => {
      const pane = paneRef.current;
      const main = handleRef.current?.previousElementSibling;
      let effectiveMax = max;
      if (pane) {
        // 본문(핸들의 앞 형제)의 왼쪽 경계를 기준으로 삼는다. 우측 레일처럼 핸들이 컨테이너의
        // 첫 자식이면 앞 형제가 없는데, 그때 보호를 건너뛰면 본문을 0까지 밀 수 있다.
        // 그런 자리에서는 viewport 왼쪽을 경계로 써서 보호가 조용히 죽는 일을 막는다
        // (부르는 쪽이 max로 더 좁게 잡을 수 있다).
        const leftBound = main ? main.getBoundingClientRect().left : 0;
        const available =
          pane.getBoundingClientRect().right - leftBound - minSiblingWidth;
        effectiveMax = Math.min(max, available);
      }
      // 상한이 하한보다 작아지는 아주 좁은 화면에서는 하한을 지킨다(세로 배치로 넘어간다).
      return Math.min(Math.max(min, effectiveMax), Math.max(min, value));
    },
    [max, min, minSiblingWidth],
  );

  /**
   * 창이 줄어들면 저장된 폭이 현재 레이아웃보다 커질 수 있어 다시 맞춘다.
   *
   * 드래그 중에는 건너뛴다. 관찰 대상(부모)이 이 패널의 폭에 따라 함께 커지는 자리
   * (우측 레일)에서는 폭 변경 → 옵저버 → 재클램프 → 폭 변경의 되먹임이 생겨, 이동 한 번에
   * 렌더가 두 번씩 일어난다. 드래그 중의 클램프는 mousemove가 이미 하고 있다.
   */
  useEffect(() => {
    const parent = paneRef.current?.parentElement;
    if (!parent || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      if (isResizing) return;
      setWidth((current) => clamp(current));
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, [clamp, isResizing, setWidth]);

  useEffect(() => {
    onResizingChange?.(isResizing);
    // 콜백만 바뀌었다고 다시 알릴 이유는 없다. isResizing이 바뀔 때만 통지한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResizing]);

  useEffect(() => {
    if (!isResizing) return undefined;

    const handleMouseMove = (event: MouseEvent) => {
      const pane = paneRef.current;
      if (!pane) return;
      // 패널의 오른쪽 경계는 리사이즈 중에도 고정이다(레이아웃이 왼쪽으로 자란다).
      // 그래서 그 경계와 포인터의 거리가 곧 새 너비다.
      const desired = pane.getBoundingClientRect().right - event.clientX;
      // clamp를 거치기 전에 본다. clamp는 최소 폭에서 잘라 버려서 '더 밀었다'가 사라진다.
      if (onCollapse && desired < min - COLLAPSE_SLACK) {
        collapse();
        return;
      }
      setWidth(clamp(desired));
    };
    const handleMouseUp = () => setIsResizing(false);
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    // 드래그 중 텍스트가 선택되면 조작이 끊긴다.
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
    // setWidth·collapse는 폭이 바뀔 때마다 새로 만들어진다. 의존성에 넣으면 mousemove마다
    // 리스너를 떼었다 붙이게 된다. 둘 다 값을 넘겨 부르는 용도라 드래그 시작 시점의 것으로 족하다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamp, collapse, isResizing, min, onCollapse]);

  /** 마우스 없이도 조절할 수 있어야 한다. 왼쪽=넓히기(패널이 왼쪽으로 자란다). */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const keyed: Record<string, () => void> = {
        ArrowLeft: () => setWidth((current) => clamp(current + RESIZE_STEP)),
        // 이미 최소 폭인데 한 번 더 좁히려는 것은 마우스로 최소 폭 아래로 미는 것과 같은 뜻이다.
        ArrowRight: () => (
          onCollapse && width <= min
            ? onCollapse()
            : setWidth((current) => clamp(current - RESIZE_STEP))
        ),
        Home: () => setWidth(min),
        // max로 바로 가더라도 본문 최소 폭은 지켜야 하므로 clamp를 거친다.
        End: () => setWidth(clamp(max)),
        Enter: () => setWidth(clamp(defaultWidth)),
        ' ': () => setWidth(clamp(defaultWidth)),
      };
      const action = keyed[event.key];
      if (!action) return;
      event.preventDefault();
      action();
    },
    [clamp, defaultWidth, max, min, onCollapse, width],
  );

  return (
    <>
      <div
        ref={handleRef}
        className={`resizable-side-panel-handle${isResizing ? ' is-resizing' : ''}`}
        role="separator"
        aria-label={label}
        aria-orientation="vertical"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={width}
        tabIndex={0}
        onMouseDown={(event) => {
          event.preventDefault();
          widthAtDragStart.current = width;
          setIsResizing(true);
        }}
        onKeyDown={handleKeyDown}
      >
        <div className="resizable-side-panel-handle-bar" />
      </div>
      <div
        ref={paneRef}
        className="resizable-side-panel-pane"
        style={{ width, minWidth: min }}
      >
        {children}
      </div>
    </>
  );
};

export default ResizableSidePanel;
