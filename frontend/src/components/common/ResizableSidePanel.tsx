import React, { useCallback, useEffect, useRef, useState } from 'react';
import './ResizableSidePanel.css';

/** 문서 뷰어 패널의 공용 기본값. 특허 관리·의견제출통지서 화면이 같은 값을 쓴다. */
export const SIDE_PANEL_MIN_WIDTH = 380;
export const SIDE_PANEL_DEFAULT_WIDTH = 520;
export const SIDE_PANEL_MAX_WIDTH = 1000;
/** 왼쪽 본문에 최소한 남겨 둘 폭. 이만큼은 목록이 살아 있어야 한다. */
export const SIDE_PANEL_MIN_SIBLING_WIDTH = 320;
const RESIZE_STEP = 24;

type Props = {
  min?: number;
  max?: number;
  defaultWidth?: number;
  /** 핸들 왼쪽 형제(본문)에 남겨 둘 최소 폭. */
  minSiblingWidth?: number;
  /** separator의 aria-label. 화면마다 무엇을 조절하는지 밝힌다. */
  label: string;
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
  children,
}) => {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const handleRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);

  /**
   * `max`만으로 자르면 화면이 좁을 때 본문이 0px까지 눌려 목록이 사라진다.
   * 핸들 왼쪽 형제(본문)의 왼쪽 경계를 기준으로 실제 상한을 다시 계산한다.
   */
  const clamp = useCallback(
    (value: number) => {
      const pane = paneRef.current;
      const main = handleRef.current?.previousElementSibling;
      let effectiveMax = max;
      if (pane && main) {
        const available =
          pane.getBoundingClientRect().right -
          main.getBoundingClientRect().left -
          minSiblingWidth;
        effectiveMax = Math.min(max, available);
      }
      // 상한이 하한보다 작아지는 아주 좁은 화면에서는 하한을 지킨다(세로 배치로 넘어간다).
      return Math.min(Math.max(min, effectiveMax), Math.max(min, value));
    },
    [max, min, minSiblingWidth],
  );

  /** 창이 줄어들면 저장된 폭이 현재 레이아웃보다 커질 수 있어 다시 맞춘다. */
  useEffect(() => {
    const parent = paneRef.current?.parentElement;
    if (!parent || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      setWidth((current) => clamp(current));
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, [clamp]);

  useEffect(() => {
    if (!isResizing) return undefined;

    const handleMouseMove = (event: MouseEvent) => {
      const pane = paneRef.current;
      if (!pane) return;
      // 패널의 오른쪽 경계는 리사이즈 중에도 고정이다(레이아웃이 왼쪽으로 자란다).
      // 그래서 그 경계와 포인터의 거리가 곧 새 너비다.
      setWidth(clamp(pane.getBoundingClientRect().right - event.clientX));
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
  }, [clamp, isResizing]);

  /** 마우스 없이도 조절할 수 있어야 한다. 왼쪽=넓히기(패널이 왼쪽으로 자란다). */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const keyed: Record<string, () => void> = {
        ArrowLeft: () => setWidth((current) => clamp(current + RESIZE_STEP)),
        ArrowRight: () => setWidth((current) => clamp(current - RESIZE_STEP)),
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
    [clamp, defaultWidth, max, min],
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
