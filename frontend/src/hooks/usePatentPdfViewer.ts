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

  const [pdfCurrentPage, setPdfCurrentPage] = React.useState<number>(1);
  const [pdfTotalPages, setPdfTotalPages] = React.useState<number>(0);
  const [pdfRotation, setPdfRotation] = React.useState<number>(0);
  const [isPdfDocumentReady, setIsPdfDocumentReady] = React.useState(false);
  const [isHighlighterReady, setIsHighlighterReady] = React.useState(false);

  // -- Library Standard Search State --
  const [searchQuery, setSearchQuery] = React.useState('');
  const [matchCount, setMatchCount] = React.useState({ current: 0, total: 0 });

  const [activeBBox, setActiveBBox] = React.useState<PdfHighlightTarget | null>(null);
  const [pendingHighlight, setPendingHighlight] = React.useState<PdfHighlightTarget | null>(null);
  const [activeHighlightRevision, setActiveHighlightRevision] = React.useState(0);
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
    if (!pageNumber || pdfPageSizes[pageNumber] || !pdfDocumentRef.current) return;

    pdfDocumentRef.current.getPage(pageNumber).then((page: any) => {
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

    utils.search(query, {
      highlightAll: true,
      caseSensitive: false,
      phraseSearch: true,
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

  const clearPdfNavigationTimers = React.useCallback(() => {
    if (pdfNavigationFrameRef.current !== null) {
      window.cancelAnimationFrame(pdfNavigationFrameRef.current);
      pdfNavigationFrameRef.current = null;
    }

    pdfNavigationTimeoutsRef.current.forEach((timer) => window.clearTimeout(timer));
    pdfNavigationTimeoutsRef.current = [];
  }, []);

  const runPdfPageNavigation = React.useCallback((targetPage: number) => {
    if (!targetPage) return;

    setPdfCurrentPage(targetPage);
    const utils = highlighterUtilsRef.current;
    if (utils && typeof (utils as any).goToPage === 'function') {
      debugLog('search-scroll-via-utils-goToPage', { targetPage });
      (utils as any).goToPage(targetPage);
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
    pdfNavigationTimeoutsRef.current = [120, 320, 700].map((delay) => (
      window.setTimeout(runInAnimationFrame, delay)
    ));
  }, [clearPdfNavigationTimers, runPdfPageNavigation]);

  const handleGoToPdf = React.useCallback((targetPage: number, bboxCoords?: any[]) => {
    if (!targetPage) return;

    debugLog('handle-goto-pdf-start', { targetPage, bboxCoords });
    setPdfCurrentPage(targetPage);
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
  }, [debugLog, ensurePdfPageSize, schedulePdfPageNavigation]);

  React.useEffect(() => (
    () => {
      clearPdfNavigationTimers();
    }
  ), [clearPdfNavigationTimers]);

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

    setSystemHighlights([{
      id: `active_compound_highlight_${activeHighlightRevision}_${pendingHighlight.pageNumber}`,
      type: 'area',
      content: { text: '' },
      position,
      comment: { text: '', emoji: '' },
    }]);
    setActiveBBox({
      pageNumber: pendingHighlight.pageNumber,
      rect: pendingHighlight.rect,
    });
    setActiveHighlightRevision((prev) => prev + 1);
    setPendingHighlight(null);
  }, [activeHighlightRevision, bboxToPosition, debugLog, ensurePdfPageSize, pdfPageSizes, pendingHighlight]);

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
    const system = systemHighlights.map((highlight) => ({ ...highlight, type: highlight.type || 'system_match' }));
    const base = currentHighlights;

    const user = userHighlights;

    return [...base, ...system, ...user];
  }, [currentHighlights, userHighlights, systemHighlights]);

  // Public API
  return {
    pdfViewerContainerRef,
    pdfRotation,
    pdfTotalPages,
    isPdfDocumentReady,
    isHighlighterReady,
    activeBBox,
    // Search Handlers
    searchQuery,
    matchCount,
    searchPdf,
    findNext,
    findPrevious,
    // Page Handlers
    pdfCurrentPage,
    setPdfCurrentPage,
    setPdfRotation,
    setPdfDocument: (doc: any) => {
      pdfDocumentRef.current = doc;
      setIsPdfDocumentReady(Boolean(doc));
    },
    setHighlighterUtils: (utils: any) => {
      highlighterUtilsRef.current = utils;
      setIsHighlighterReady(Boolean(utils));
    },
    setPdfTotalPages,
    // Highlight Handlers
    userHighlights,
    systemHighlights,
    addHighlight,
    deleteHighlight,
    scrollToHighlight,
    dynamicHighlights,
    handleGoToPdf,
  };
};
