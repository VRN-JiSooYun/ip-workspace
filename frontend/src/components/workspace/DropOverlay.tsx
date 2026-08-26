import React from 'react';
import type { Rect } from '../../lib/layoutTree';

type Props = {
  rect: Rect | null;
  /** 탭으로 합쳐지는 드롭은 화면이 쪼개지지 않으므로 다르게 표시한다. */
  variant: 'split' | 'merge';
};

/**
 * 드롭 결과 미리보기. pointer-events:none이라 밑에 있는 패널 판정을 가로막지 않는다.
 * 드래그 중에는 elementFromPoint로 탭 자리를 찾는데, 이 오버레이가 포인터를 먹으면
 * 그 조회가 전부 오버레이를 가리킨다.
 */
const DropOverlay: React.FC<Props> = ({ rect, variant }) => {
  if (!rect) return null;
  return (
    <div
      aria-hidden="true"
      className={`lt-drop-overlay lt-drop-overlay-${variant}`}
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
    />
  );
};

export default DropOverlay;
