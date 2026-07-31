import React from 'react';

interface ViewportTableHeightOptions {
  bottomGap?: number;
  enabled?: boolean;
  fitToRegion?: boolean;
  minHeight?: number;
  refreshKey?: unknown;
  reservePaginationSpace?: boolean;
}

export const useViewportTableHeight = ({
  bottomGap = 16,
  enabled = true,
  fitToRegion = false,
  minHeight = 160,
  refreshKey,
  reservePaginationSpace = true,
}: ViewportTableHeightOptions = {}) => {
  const tableRegionRef = React.useRef<HTMLDivElement | null>(null);
  const [tableBodyHeight, setTableBodyHeight] = React.useState<number>();

  React.useLayoutEffect(() => {
    const region = tableRegionRef.current;
    if (!region || !enabled) {
      setTableBodyHeight(undefined);
      return undefined;
    }

    let animationFrame = 0;
    const updateHeight = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const body = region.querySelector<HTMLElement>('.ant-table-body');
        const content = region.querySelector<HTMLElement>('.ant-table-content');
        const rows = region.querySelector<HTMLElement>('.ant-table-tbody');
        const measureElement = body ?? content ?? rows;
        if (!measureElement) return;

        const pagination = region.querySelector<HTMLElement>('.ant-pagination');
        const paginationStyle = pagination ? window.getComputedStyle(pagination) : null;
        const paginationHeight = reservePaginationSpace
          ? pagination
            ? Math.ceil(
                pagination.getBoundingClientRect().height
                + Number.parseFloat(paginationStyle?.marginTop || '0')
                + Number.parseFloat(paginationStyle?.marginBottom || '0')
              )
            : 48
          : 0;
        const availableBottom = fitToRegion
          ? region.getBoundingClientRect().bottom
          : window.innerHeight - bottomGap;
        const nextHeight = Math.max(
          minHeight,
          Math.floor(
            availableBottom
            - measureElement.getBoundingClientRect().top
            - paginationHeight
            - 2
          )
        );

        setTableBodyHeight((current) => current === nextHeight ? current : nextHeight);
      });
    };

    const resizeObserver = new ResizeObserver(updateHeight);
    const mutationObserver = new MutationObserver(updateHeight);
    resizeObserver.observe(region);
    mutationObserver.observe(region, { childList: true, subtree: true });
    window.addEventListener('resize', updateHeight);
    updateHeight();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [
    bottomGap,
    enabled,
    fitToRegion,
    minHeight,
    refreshKey,
    reservePaginationSpace,
  ]);

  const tableRegionStyle = React.useMemo(() => ({
    '--viewport-table-body-height': tableBodyHeight !== undefined
      ? `${tableBodyHeight}px`
      : undefined,
  } as React.CSSProperties), [tableBodyHeight]);

  return {
    tableBodyHeight,
    tableRegionRef,
    tableRegionStyle,
  };
};
