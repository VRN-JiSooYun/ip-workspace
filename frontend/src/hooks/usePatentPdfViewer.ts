import React from 'react';
import type { PdfHighlighterUtils } from 'react-pdf-highlighter-plus';
import { getPdfHighlightScale } from '../config/pdfHighlight';

const HIGHLIGHT_PADDING_X = 8;
const HIGHLIGHT_PADDING_Y = 10;
const SEARCH_HIGHLIGHT_PADDING_X = 2;
const SEARCH_HIGHLIGHT_PADDING_Y = 1.5;
const ENABLE_HIGHLIGHT_DEBUG_LOG = false;
const ENABLE_SEARCH_HIGHLIGHT_TRACE_LOG = true;

type PdfHighlightTarget = {
  pageNumber: number;
  rect: number[];
};

type PdfPageSize = {
  width: number;
  height: number;
};

type PdfPageReferenceGeometry = {
  rect: DOMRect;
  source: string;
};

type PdfSearchCharRef = {
  span: HTMLElement;
  offset: number;
} | null;

type PdfSearchMatch = {
  id: string;
  pageNumber: number;
  text: string;
  position: PdfHighlightPosition | null;
  debugInfo: PdfSearchMatchDebugInfo;
};

type PdfHighlightPosition = {
  boundingRect: PdfScaledRect;
  rects: PdfScaledRect[];
  pageNumber: number;
};

type PdfScaledRect = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
  pageNumber: number;
};

export type PdfSearchMatchDebugInfo = {
  index: number;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  scaledX1?: number;
  scaledY1?: number;
  scaledX2?: number;
  scaledY2?: number;
  positionStatus?: 'ready' | 'missing-reference' | 'page-size-pending' | 'invalid-scaled-rect';
  positionReason?: string;
  referenceSource?: string;
};

type UsePatentPdfViewerOptions = {
  patentNumber?: string;
  currentHighlights: any[];
  dataHighlightTargets?: Array<{
    id: string;
    pageNumber: number;
    rect: number[];
    source?: Record<string, unknown>;
  }>;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const roundRectValue = (value: number) => Math.round(value * 100) / 100;

const getTextNode = (element: HTMLElement): Text | null => {
  const node = element.firstChild;
  return node?.nodeType === Node.TEXT_NODE ? node as Text : null;
};

const unionClientRects = (rects: DOMRect[]): DOMRect | null => {
  if (rects.length === 0) return null;

  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));

  return new DOMRect(left, top, right - left, bottom - top);
};

const shouldInsertSyntheticSpace = (currentSpan: HTMLElement, nextSpan: HTMLElement) => {
  const currentRect = currentSpan.getBoundingClientRect();
  const nextRect = nextSpan.getBoundingClientRect();
  if (
    currentRect.width <= 0 ||
    currentRect.height <= 0 ||
    nextRect.width <= 0 ||
    nextRect.height <= 0
  ) {
    return false;
  }

  const currentCenterY = currentRect.top + (currentRect.height / 2);
  const nextCenterY = nextRect.top + (nextRect.height / 2);
  const lineThreshold = Math.max(currentRect.height, nextRect.height) * 0.6;
  if (Math.abs(currentCenterY - nextCenterY) > lineThreshold) {
    return true;
  }

  const visualGap = nextRect.left - currentRect.right;
  const averageCharWidth = currentRect.width / Math.max(currentSpan.textContent?.length ?? 1, 1);
  return visualGap > Math.max(averageCharWidth * 0.55, 2);
};

export const usePatentPdfViewer = ({
  patentNumber,
  currentHighlights,
  dataHighlightTargets = [],
}: UsePatentPdfViewerOptions) => {
  const highlighterUtilsRef = React.useRef<PdfHighlighterUtils | null>(null);
  const pdfDocumentRef = React.useRef<any | null>(null);
  const pdfViewerContainerRef = React.useRef<HTMLDivElement | null>(null);
  const pdfSearchMatchesRef = React.useRef<PdfSearchMatch[]>([]);
  const lastSearchBuildLogRef = React.useRef('');
  const searchTraceLogKeysRef = React.useRef<Set<string>>(new Set());
  const isRebumpingRef = React.useRef(false);
  const lastRebumpTargetRef = React.useRef<string>('');
  const pdfNavigationFrameRef = React.useRef<number | null>(null);
  const pdfNavigationTimeoutsRef = React.useRef<number[]>([]);
  const pdfHighlightCenterRequestRef = React.useRef(0);
  const pdfHighlightCenterTimersRef = React.useRef<number[]>([]);
  const highlightLayoutTimerRef = React.useRef<number | null>(null);
  const pdfPageSizeRequestsRef = React.useRef<Map<number, any>>(new Map());

  const [pdfCurrentPage, setPdfCurrentPage] = React.useState<number>(1);
  const [pdfTotalPages, setPdfTotalPages] = React.useState<number>(0);
  const [pdfRotation, setPdfRotation] = React.useState<number>(0);
  const [isPdfDocumentReady, setIsPdfDocumentReady] = React.useState(false);
  const [isHighlighterReady, setIsHighlighterReady] = React.useState(false);

  // -- Library Standard Search State --
  const [searchQuery, setSearchQuery] = React.useState('');
  const [matchCount, setMatchCount] = React.useState({ current: 0, total: 0 });

  const [activeBBox, setActiveBBox] = React.useState<PdfHighlightTarget | null>(null);
  const [selectedDataHighlightId, setSelectedDataHighlightId] = React.useState<string | null>(null);
  const [pendingHighlight, setPendingHighlight] = React.useState<PdfHighlightTarget | null>(null);
  const [activeHighlightRevision, setActiveHighlightRevision] = React.useState(0);
  // 페이지 폭/스케일이 확정·변경될 때 하이라이트를 다시 레이아웃하기 위한 리비전.
  const [highlightLayoutRevision, setHighlightLayoutRevision] = React.useState(0);
  const [pdfPageSizes, setPdfPageSizes] = React.useState<Record<number, PdfPageSize>>({});

  const debugLog = React.useCallback((event: string, payload: Record<string, unknown>) => {
    if (!ENABLE_HIGHLIGHT_DEBUG_LOG) return;
    console.log('[PDFHighlightDebug]', event, payload);
  }, []);

  // -- Highlight Management (User Annotations vs System Highlights) --
  const [userHighlights, setUserHighlights] = React.useState<any[]>([]);
  const [systemHighlights, setSystemHighlights] = React.useState<any[]>([]);

  const highlightScale = React.useMemo(
    () => getPdfHighlightScale(patentNumber),
    [patentNumber]
  );

  const ensurePdfPageSize = React.useCallback((pageNumber: number) => {
    const pdfDocument = pdfDocumentRef.current;
    if (
      !pageNumber
      || pdfPageSizes[pageNumber]
      || !pdfDocument
      || pdfPageSizeRequestsRef.current.get(pageNumber) === pdfDocument
    ) {
      return;
    }

    pdfPageSizeRequestsRef.current.set(pageNumber, pdfDocument);
    pdfDocument.getPage(pageNumber).then((page: any) => {
      if (pdfDocumentRef.current !== pdfDocument) return;
      const viewport = page.getViewport({ scale: 1 });
      setPdfPageSizes((prev) => {
        if (prev[pageNumber]) return prev;
        return {
          ...prev,
          [pageNumber]: {
            width: viewport.width,
            height: viewport.height,
          },
        };
      });
    }).catch((error: unknown) => {
      console.warn(`Failed to get PDF page size for page ${pageNumber}`, error);
    }).finally(() => {
      if (pdfPageSizeRequestsRef.current.get(pageNumber) === pdfDocument) {
        pdfPageSizeRequestsRef.current.delete(pageNumber);
      }
    });
  }, [pdfPageSizes]);

  const normalizeBbox = React.useCallback((bboxRaw: number[]) => {
    if (!Array.isArray(bboxRaw) || bboxRaw.length !== 4) return null;
    const [rx1, ry1, rx2, ry2] = bboxRaw.map(Number);
    if ([rx1, ry1, rx2, ry2].some((value) => !Number.isFinite(value))) return null;

    return {
      x1: Math.min(rx1, rx2),
      y1: Math.min(ry1, ry2),
      x2: Math.max(rx1, rx2),
      y2: Math.max(ry1, ry2),
    };
  }, []);

  const bboxToPosition = React.useCallback((bboxPx: number[], pageNumber: number): PdfHighlightPosition | null => {
    const normalized = normalizeBbox(bboxPx);
    if (!normalized) return null;

    const pageSize = pdfPageSizes[pageNumber];
    if (!pageSize) return null;

    const x1 = clamp((normalized.x1 * highlightScale) - HIGHLIGHT_PADDING_X, 0, pageSize.width);
    const y1 = clamp((normalized.y1 * highlightScale) - HIGHLIGHT_PADDING_Y, 0, pageSize.height);
    const x2 = clamp((normalized.x2 * highlightScale) + HIGHLIGHT_PADDING_X, 0, pageSize.width);
    const y2 = clamp((normalized.y2 * highlightScale) + HIGHLIGHT_PADDING_Y, 0, pageSize.height);

    if (x2 <= x1 || y2 <= y1) return null;

    return {
      boundingRect: {
        x1,
        y1,
        x2,
        y2,
        width: pageSize.width,
        height: pageSize.height,
        pageNumber,
      },
      rects: [],
      pageNumber,
    };
  }, [highlightScale, normalizeBbox, pdfPageSizes]);

  const addHighlight = React.useCallback((highlight: any) => {
    debugLog('add-user-highlight', { highlight });
    setUserHighlights((prev) => [
      { ...highlight, id: `user_highlight_${Date.now()}`, type: 'user_annotation' },
      ...prev,
    ]);
  }, [debugLog]);

  const deleteHighlight = React.useCallback((id: string) => {
    debugLog('delete-user-highlight', { id });
    setUserHighlights((prev) => prev.filter((h) => h.id !== id));
  }, [debugLog]);

  const scrollToHighlight = React.useCallback((highlight: any) => {
    if (!highlight) return;
    highlighterUtilsRef.current?.scrollToHighlight(highlight);
  }, []);

  // -- Library Standard Search Logic --
  const searchPdf = React.useCallback((query: string) => {
    const utils = highlighterUtilsRef.current;
    if (!utils) return;

    setSearchQuery(query);
    if (!query) {
      utils.clearSearch();
      setMatchCount({ current: 0, total: 0 });
      return;
    }

    // 한글 등 유니코드는 NFC로 정규화해 PDF 텍스트(대개 NFC)와 매칭이 어긋나지 않게 한다.
    const normalizedQuery = query.normalize('NFC');

    utils.search(normalizedQuery, {
      highlightAll: true,
      caseSensitive: false,
      matchDiacritics: false,
    });
  }, []);

  const findNext = React.useCallback(() => {
    highlighterUtilsRef.current?.findNext();
  }, []);

  const findPrevious = React.useCallback(() => {
    highlighterUtilsRef.current?.findPrevious();
  }, []);

  // Event Bus setup for search state
  React.useEffect(() => {
    const utils = highlighterUtilsRef.current;
    if (!utils) return;

    const eventBus = (utils as any).getEventBus?.();
    if (!eventBus) return;

    const onUpdateFindMatches = (e: any) => {
      setMatchCount(prev => ({
        current: e.matchesCount.current || prev.current,
        total: e.matchesCount.total
      }));
    };

    const onUpdateFindControlState = (e: any) => {
      if (e.matchesCount) {
        setMatchCount(prev => ({
          current: e.matchesCount.current || prev.current,
          total: e.matchesCount.total
        }));
      }
    };

    eventBus.on('updatefindmatchescount', onUpdateFindMatches);
    eventBus.on('updatefindcontrolstate', onUpdateFindControlState);

    return () => {
      eventBus.off('updatefindmatchescount', onUpdateFindMatches);
      eventBus.off('updatefindcontrolstate', onUpdateFindControlState);
    };
  }, [highlighterUtilsRef.current]);

  // 페이지 폭/스케일/페이지 렌더 시 하이라이트를 다시 레이아웃하도록 리비전을 bump한다.
  // trailing 디바운스: 스크롤 중 연속 이벤트에는 재계산을 미루고, 멈춘 뒤 한 번만 재정렬해 버벅임을 막는다.
  const bumpHighlightLayout = React.useCallback(() => {
    if (highlightLayoutTimerRef.current !== null) {
      window.clearTimeout(highlightLayoutTimerRef.current);
    }
    highlightLayoutTimerRef.current = window.setTimeout(() => {
      highlightLayoutTimerRef.current = null;
      setHighlightLayoutRevision((prev) => prev + 1);
    }, 150);
  }, []);

  React.useEffect(() => () => {
    if (highlightLayoutTimerRef.current !== null) {
      window.clearTimeout(highlightLayoutTimerRef.current);
      highlightLayoutTimerRef.current = null;
    }
  }, []);

  // PDF 뷰어 컨테이너 폭이 변할 때(초기 진입 시 레이아웃 정착, split 드래그, 썸네일 토글, 창 리사이즈 등) 재레이아웃.
  React.useEffect(() => {
    const container = pdfViewerContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      bumpHighlightLayout();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [bumpHighlightLayout, isPdfDocumentReady]);

  // 재레이아웃이 필요한 pdf.js 이벤트 구독:
  // - scalechanging/rotationchanging: page-width 스케일 확정/변경
  // - textlayerrendered/pagerendered: 가상화로 스크롤 중 새 페이지가 렌더될 때(그 페이지 textLayer가 최종 크기에 도달하는 시점)
  React.useEffect(() => {
    const utils = highlighterUtilsRef.current;
    const eventBus = (utils as any)?.getEventBus?.();
    if (!eventBus) return;

    const onRelayout = () => bumpHighlightLayout();
    const events = ['scalechanging', 'rotationchanging', 'textlayerrendered', 'pagerendered'];
    events.forEach((name) => eventBus.on(name, onRelayout));
    return () => {
      events.forEach((name) => eventBus.off(name, onRelayout));
    };
  }, [bumpHighlightLayout, isHighlighterReady]);

  const clearPdfNavigationTimers = React.useCallback(() => {
    if (pdfNavigationFrameRef.current !== null) {
      window.cancelAnimationFrame(pdfNavigationFrameRef.current);
      pdfNavigationFrameRef.current = null;
    }

    pdfNavigationTimeoutsRef.current.forEach((timer) => window.clearTimeout(timer));
    pdfNavigationTimeoutsRef.current = [];
  }, []);

  const clearPdfHighlightCenterTimers = React.useCallback(() => {
    pdfHighlightCenterRequestRef.current += 1;
    pdfHighlightCenterTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    pdfHighlightCenterTimersRef.current = [];
  }, []);

  const schedulePdfHighlightCenter = React.useCallback((highlight: any) => {
    const pageNumber = Number(highlight?.source?.pageNumber ?? highlight?.position?.pageNumber);
    const rect = Array.isArray(highlight?.source?.rect)
      ? highlight.source.rect.map(Number)
      : [];
    if (!pageNumber || rect.length < 4) return;

    clearPdfHighlightCenterTimers();
    const requestId = pdfHighlightCenterRequestRef.current;
    const centerKey = `${pageNumber}:${rect.join(',')}`;
    const utils = highlighterUtilsRef.current;

    // 대상 페이지를 먼저 렌더 영역으로 가져온 후 실제 bbox DOM 좌표로 중앙을 보정한다.
    utils?.scrollToHighlight(highlight);

    let centered = false;
    const centerWhenReady = () => {
      if (centered || requestId !== pdfHighlightCenterRequestRef.current) return;

      const viewerContainer = (highlighterUtilsRef.current as any)?.getViewer?.()?.container as HTMLElement | undefined;
      if (!viewerContainer) return;

      const highlightElements = pdfViewerContainerRef.current
        ?.querySelectorAll<HTMLElement>('[data-pdf-highlight-center-key]');
      const highlightElement = Array.from(highlightElements ?? []).find(
        (element) => element.dataset.pdfHighlightCenterKey === centerKey,
      );
      if (!highlightElement) return;

      const containerRect = viewerContainer.getBoundingClientRect();
      const highlightRect = highlightElement.getBoundingClientRect();
      if (containerRect.height <= 0 || highlightRect.height <= 0) return;

      const highlightCenterY = highlightRect.top + (highlightRect.height / 2);
      const viewportCenterY = containerRect.top + (containerRect.height / 2);
      const maxScrollTop = Math.max(0, viewerContainer.scrollHeight - viewerContainer.clientHeight);
      const nextScrollTop = clamp(
        viewerContainer.scrollTop + highlightCenterY - viewportCenterY,
        0,
        maxScrollTop,
      );
      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

      viewerContainer.scrollTo({
        top: nextScrollTop,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
      centered = true;
      debugLog('compound-highlight-centered', {
        pageNumber,
        centerKey,
        nextScrollTop,
      });
    };

    pdfHighlightCenterTimersRef.current = [80, 180, 350, 650].map((delay) => (
      window.setTimeout(() => {
        window.requestAnimationFrame(centerWhenReady);
      }, delay)
    ));
  }, [clearPdfHighlightCenterTimers, debugLog]);

  const runPdfPageNavigation = React.useCallback((targetPage: number) => {
    if (!targetPage) return;

    setPdfCurrentPage(targetPage);
    const utils = highlighterUtilsRef.current;
    if (utils && typeof (utils as any).goToPage === 'function') {
      debugLog('search-scroll-via-utils-goToPage', { targetPage });
      (utils as any).goToPage(targetPage);
      return;
    }

    const pageElement = pdfViewerContainerRef.current?.querySelector(`.page[data-page-number="${targetPage}"]`)
      ?? document.querySelector(`.patent-pdf-main-viewer .page[data-page-number="${targetPage}"]`);
    if (pageElement) {
      debugLog('search-scroll-page-fallback', { targetPage });
      pageElement.scrollIntoView({ behavior: 'auto', block: 'start', inline: 'nearest' });
    }
  }, [debugLog]);

  const schedulePdfPageNavigation = React.useCallback((targetPage: number) => {
    clearPdfNavigationTimers();

    const runInAnimationFrame = () => {
      if (pdfNavigationFrameRef.current !== null) {
        window.cancelAnimationFrame(pdfNavigationFrameRef.current);
      }

      pdfNavigationFrameRef.current = window.requestAnimationFrame(() => {
        pdfNavigationFrameRef.current = null;
        runPdfPageNavigation(targetPage);
      });
    };

    runInAnimationFrame();
  }, [clearPdfNavigationTimers, runPdfPageNavigation]);

  const handleGoToPdf = React.useCallback((targetPage: number, bboxCoords?: any[]) => {
    if (!targetPage) return;

    debugLog('handle-goto-pdf-start', { targetPage, bboxCoords });
    clearPdfHighlightCenterTimers();
    setPdfCurrentPage(targetPage);
    // 우측 탭/카드에서 활성화하면 좌측 blue box 선택(red)은 해제 → red는 항상 하나만 유지
    setSelectedDataHighlightId((prev) => (prev ? null : prev));
    if (pdfDocumentRef.current) {
      ensurePdfPageSize(targetPage);
    }

    if (bboxCoords && bboxCoords.length >= 4) {
      setSystemHighlights((prev) => (prev.length > 0 ? [] : prev));
      setActiveBBox((prev) => (prev ? null : prev));
      setPendingHighlight({
        pageNumber: targetPage,
        rect: bboxCoords.map(Number),
      });
    } else {
      setSystemHighlights((prev) => (prev.length > 0 ? [] : prev));
      setActiveBBox((prev) => (prev ? null : prev));
      setPendingHighlight((prev) => (prev ? null : prev));
    }

    schedulePdfPageNavigation(targetPage);
  }, [clearPdfHighlightCenterTimers, debugLog, ensurePdfPageSize, schedulePdfPageNavigation]);

  // 좌측 blue box 클릭 시 우측 활성화로 생긴 active_compound_highlight(red)를 제거
  const clearActiveCompoundHighlight = React.useCallback(() => {
    setSystemHighlights((prev) => (prev.length > 0 ? [] : prev));
    setActiveBBox((prev) => (prev ? null : prev));
    setPendingHighlight((prev) => (prev ? null : prev));
    lastRebumpTargetRef.current = '';
    clearPdfHighlightCenterTimers();
  }, [clearPdfHighlightCenterTimers]);

  React.useEffect(() => (
    () => {
      clearPdfNavigationTimers();
      clearPdfHighlightCenterTimers();
    }
  ), [clearPdfHighlightCenterTimers, clearPdfNavigationTimers]);

  React.useEffect(() => {
    if (!pendingHighlight) return;

    ensurePdfPageSize(pendingHighlight.pageNumber);

    const pageSizeReady = Boolean(pdfPageSizes[pendingHighlight.pageNumber]);
    const pageElement = document.querySelector(`.page[data-page-number="${pendingHighlight.pageNumber}"]`) as HTMLElement | null;
    const pageRendered = Boolean(pageElement?.querySelector('canvas'));

    if (!pageSizeReady || !pageRendered) {
      const timer = window.setTimeout(() => {
        setPendingHighlight((prev) => (prev ? { ...prev } : prev));
      }, 120);
      return () => window.clearTimeout(timer);
    }

    const position = bboxToPosition(pendingHighlight.rect, pendingHighlight.pageNumber);
    if (!position) {
      debugLog('compound-highlight-position-unavailable', {
        pageNumber: pendingHighlight.pageNumber,
        bbox: pendingHighlight.rect,
        pageSize: pdfPageSizes[pendingHighlight.pageNumber],
      });
      return;
    }

    const activeHighlight = {
      id: `active_compound_highlight_${activeHighlightRevision}_${pendingHighlight.pageNumber}`,
      type: 'area',
      content: { text: '' },
      position,
      source: {
        pageNumber: pendingHighlight.pageNumber,
        rect: pendingHighlight.rect,
      },
      comment: { text: '', emoji: '' },
    };
    setSystemHighlights([activeHighlight]);
    setActiveBBox({
      pageNumber: pendingHighlight.pageNumber,
      rect: pendingHighlight.rect,
    });
    setActiveHighlightRevision((prev) => prev + 1);
    setPendingHighlight(null);
    schedulePdfHighlightCenter(activeHighlight);
  }, [
    activeHighlightRevision,
    bboxToPosition,
    debugLog,
    ensurePdfPageSize,
    pdfPageSizes,
    pendingHighlight,
    schedulePdfHighlightCenter,
  ]);

  React.useEffect(() => {
    if (!isPdfDocumentReady) return;
    const uniquePageNumbers = new Set(
      dataHighlightTargets.map((target) => target.pageNumber).filter(Boolean),
    );
    uniquePageNumbers.forEach((pageNumber) => {
      ensurePdfPageSize(pageNumber);
    });
  }, [dataHighlightTargets, ensurePdfPageSize, isPdfDocumentReady]);

  const dataHighlights = React.useMemo(() => (
    dataHighlightTargets.map((target) => {
      if (!target.source || !target.pageNumber || !Array.isArray(target.rect) || target.rect.length < 4) return null;
      const position = bboxToPosition(target.rect, target.pageNumber);
      if (!position) return null;
      const baseId = `raw_data_bbox_${target.id}`;
      const layoutId = `${baseId}__layout_${highlightLayoutRevision}`;
      const isSelected = baseId === selectedDataHighlightId;
      return {
        // 선택 여부와 레이아웃 revision을 id에 반영해 라이브러리의 초기 배치 캐시를 강제 갱신한다.
        // 단, 선택 매칭(selectedDataHighlightId)은 baseId 기준으로 유지한다.
        id: isSelected ? `${layoutId}__selected` : layoutId,
        type: 'area',
        content: { text: '' },
        position,
        source: {
          ...target.source,
          pageNumber: target.pageNumber,
          rect: target.rect,
          baseId,
          selected: isSelected,
        },
        comment: { text: '', emoji: '' },
      };
    }).filter(Boolean)
    // highlightLayoutRevision: 페이지 폭/스케일 확정·변경 시 새 객체 참조로 재생성 → 라이브러리가 최종 페이지 크기로 위치 재계산.
  ), [bboxToPosition, dataHighlightTargets, selectedDataHighlightId, highlightLayoutRevision]);

  React.useEffect(() => {
    if (!activeBBox || isRebumpingRef.current) return;

    const targetKey = `${activeBBox.pageNumber}_${activeBBox.rect.join(',')}`;
    if (lastRebumpTargetRef.current === targetKey) return;
    lastRebumpTargetRef.current = targetKey;

    const savedBBox = { ...activeBBox, rect: [...activeBBox.rect] };
    const timers = [600].map((delay) => window.setTimeout(() => {
      const position = bboxToPosition(savedBBox.rect, savedBBox.pageNumber);
      if (!position) return;

      isRebumpingRef.current = true;
      setSystemHighlights([]);

      requestAnimationFrame(() => {
        setSystemHighlights([{
          id: `active_compound_highlight_rebump_${delay}_${Date.now()}`,
          type: 'area',
          content: { text: '' },
          position,
          source: {
            pageNumber: savedBBox.pageNumber,
            rect: savedBBox.rect,
          },
          comment: { text: '', emoji: '' },
        }]);
        isRebumpingRef.current = false;
      });
    }, delay));

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [activeBBox, bboxToPosition]);

  const dynamicHighlights = React.useMemo(() => {
    const system = systemHighlights.map((highlight) => ({
      ...highlight,
      id: `${highlight.id}__layout_${highlightLayoutRevision}`,
      type: highlight.type || 'system_match',
    }));
    const base = currentHighlights;

    const user = userHighlights;

    return [...base, ...dataHighlights, ...system, ...user];
  }, [currentHighlights, dataHighlights, highlightLayoutRevision, userHighlights, systemHighlights]);

  const setPdfDocument = React.useCallback((pdfDocument: any) => {
    const documentChanged = pdfDocumentRef.current !== pdfDocument;
    pdfDocumentRef.current = pdfDocument;
    if (documentChanged) {
      pdfPageSizeRequestsRef.current.clear();
      setPdfPageSizes({});
    }
    setIsPdfDocumentReady(Boolean(pdfDocument));
  }, []);

  const setHighlighterUtils = React.useCallback((utils: any) => {
    highlighterUtilsRef.current = utils;
    setIsHighlighterReady(Boolean(utils));
  }, []);

  // Public API
  return {
    pdfViewerContainerRef,
    pdfRotation,
    pdfTotalPages,
    isPdfDocumentReady,
    isHighlighterReady,
    activeBBox,
    selectedDataHighlightId,
    setSelectedDataHighlightId,
    // Search Handlers
    searchQuery,
    setSearchQuery,
    matchCount,
    searchPdf,
    findNext,
    findPrevious,
    // Page Handlers
    pdfCurrentPage,
    setPdfCurrentPage,
    setPdfRotation,
    setPdfDocument,
    setHighlighterUtils,
    setPdfTotalPages,
    // Highlight Handlers
    userHighlights,
    systemHighlights,
    addHighlight,
    deleteHighlight,
    scrollToHighlight,
    dynamicHighlights,
    handleGoToPdf,
    clearActiveCompoundHighlight,
  };
};
