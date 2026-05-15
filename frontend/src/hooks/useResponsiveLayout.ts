import { useState, useEffect, useMemo } from 'react';
import { getPatentAnalysisLayoutPreset, PatentAnalysisLayoutPreset } from '../config/patentAnalysisLayout';

/**
 * VORA 플랫폼 전용 반응형 레이아웃 훅
 * 모든 페이지에서 일관된 maxWidth, sidePadding, splitRatio를 유지하기 위해 사용합니다.
 */
export const useResponsiveLayout = () => {
  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 1920;
    return window.innerWidth;
  });

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const layoutPreset = useMemo(() => getPatentAnalysisLayoutPreset(viewportWidth), [viewportWidth]);

  return {
    viewportWidth,
    layoutPreset,
    isExtraLarge: viewportWidth >= 2560,
    isLarge: viewportWidth >= 1920,
    isMedium: viewportWidth >= 1440,
    isSmall: viewportWidth < 1200
  };
};
