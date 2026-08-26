import React, { useCallback, useRef, useState } from 'react';
import type { SplitterRect } from '../../lib/layoutTree';

/** 방향키 한 번에 움직이는 폭. ResizableSidePanel의 RESIZE_STEP과 같은 값이다. */
const KEYBOARD_STEP = 24;

type Props = {
  rect: SplitterRect;
  /** 화면 좌표를 그대로 넘긴다. 비율 계산은 그리드가 한다(컨테이너 기준을 아는 쪽이라서). */
  onDragMove: (splitId: string, client: { x: number; y: number }) => void;
  onDragEnd: () => void;
  /** 방향키. px 단위 증감. */
  onNudge: (splitId: string, deltaPx: number) => void;
  disabled?: boolean;
  label: string;
};

/**
 * 두 패널 사이의 분할선. 끌면 부모 SplitNode의 ratio만 바뀐다.
 *
 * Pointer Events를 쓴다. 태블릿 터치를 지원해야 하고, setPointerCapture로 잡아 두면
 * 커서가 iframe이나 다른 요소 위로 넘어가도 이동 이벤트를 계속 받는다.
 */
const Splitter: React.FC<Props> = ({ rect, onDragMove, onDragEnd, onNudge, disabled, label }) => {
  const [dragging, setDragging] = useState(false);
  const pointerId = useRef<number | null>(null);
  const isRow = rect.direction === 'row';

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerId.current = event.pointerId;
    setDragging(true);
  }, [disabled]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== event.pointerId) return;
    onDragMove(rect.splitId, { x: event.clientX, y: event.clientY });
  }, [onDragMove, rect.splitId]);

  const finish = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointerId.current = null;
    setDragging(false);
    onDragEnd();
  }, [onDragEnd]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const back = isRow ? 'ArrowLeft' : 'ArrowUp';
    const forward = isRow ? 'ArrowRight' : 'ArrowDown';
    if (event.key !== back && event.key !== forward) return;
    event.preventDefault();
    onNudge(rect.splitId, event.key === back ? -KEYBOARD_STEP : KEYBOARD_STEP);
  }, [disabled, isRow, onNudge, rect.splitId]);

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={isRow ? 'vertical' : 'horizontal'}
      tabIndex={disabled ? -1 : 0}
      className={[
        'lt-splitter',
        isRow ? 'lt-splitter-row' : 'lt-splitter-column',
        dragging ? 'lt-splitter-dragging' : '',
      ].filter(Boolean).join(' ')}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onKeyDown={handleKeyDown}
    >
      <span className="lt-splitter-line" aria-hidden="true" />
    </div>
  );
};

export default Splitter;
