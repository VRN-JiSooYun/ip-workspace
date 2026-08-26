import { useEffect, useRef, useState } from 'react';

/**
 * 요소의 폭과 높이를 함께 관측한다.
 *
 * react-grid-layout의 useContainerWidth는 폭만 주고 그 라이브러리에 묶여 있다.
 * 트리 레이아웃은 높이도 비율로 나눠야 해서 둘 다 필요하다.
 */
export const useContainerSize = <T extends HTMLElement = HTMLDivElement>() => {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [measured, setMeasured] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const apply = (width: number, height: number) => {
      setSize((current) => (
        // 소수점 흔들림으로 매 프레임 리렌더되는 것을 막는다.
        Math.abs(current.width - width) < 0.5 && Math.abs(current.height - height) < 0.5
          ? current
          : { width, height }
      ));
      setMeasured(true);
    };

    const rect = node.getBoundingClientRect();
    apply(rect.width, rect.height);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const box = entry.contentRect;
      apply(box.width, box.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, size, measured };
};
