import React from 'react';
import type { PdfHighlighterUtils } from 'react-pdf-highlighter-plus';
import { getPdfHighlightScale } from '../config/pdfHighlight';
import {
  PDF_ZOOM_LEVELS,
  PDF_ZOOM_MAX_PERCENT,
  PDF_ZOOM_MIN_PERCENT,
  usePdfViewerStore,
} from '../store/usePdfViewerStore';

const HIGHLIGHT_PADDING_X = 8;
const HIGHLIGHT_PADDING_Y = 10;
const SEARCH_HIGHLIGHT_PADDING_X = 2;
const SEARCH_HIGHLIGHT_PADDING_Y = 1.5;
const ENABLE_HIGHLIGHT_DEBUG_LOG = false;
const ENABLE_SEARCH_HIGHLIGHT_TRACE_LOG = true;
/* 배율 관련 상수는 store가 갖는다(뷰어 밖에서도 범위를 알아야 저장값을 자를 수 있다).
   toolbar 등 기존 import 경로를 깨지 않도록 여기서 다시 내보낸다. */
export { PDF_ZOOM_MAX_PERCENT, PDF_ZOOM_MIN_PERCENT };
const PDF_FIND_WHITESPACE_PATCHED = Symbol.for(
  'ipWorkspace.pdfFindWhitespacePatched',
);

/** 이 앱의 PDF 검색 조건. 단일·다중 검색어가 같은 조건으로 걸려야 개수와 이동이 맞는다. */
const PDF_SEARCH_OPTIONS = {
  highlightAll: true,
  caseSensitive: false,
  matchDiacritics: false,
} as const;

type PdfJsFindMatch = {
  index: number;
  length: number;
};

type PdfFindController = {
  match: (
    query: string | string[],
    pageContent: string,
    pageIndex: number,
  ) => PdfJsFindMatch[] | undefined;
};

/**
 * PDF.js가 검색에 쓰는 pageContent에서 공백을 제거하면서, 압축된 각 UTF-16 index가
 * 원문의 어느 index였는지 보존한다. PDF.js match 결과는 UTF-16 offset 계약이라
 * code point가 아니라 code unit 단위로 순회해야 한글·보조평면 문자 모두 위치가 맞는다.
 */
const compactPdfSearchText = (text: string) => {
  let compactText = '';
  const originalIndexes: number[] = [];

  for (let index = 0; index < text.length; index += 1) {
    if (/\s/u.test(text[index])) continue;
    compactText += text[index];
    originalIndexes.push(index);
  }

  return { compactText, originalIndexes };
};

/**
 * PDF.js는 textItem.hasEOL을 공백으로 정규화하므로 `제출기` + EOL + `일`은
 * `제출기 일`이 되어 `제출기일` 검색에서 빠진다. 공개 메서드인 match만 감싸 검색용
 * 문자열의 공백을 무시하고, 결과 offset은 다시 원문 범위로 복원한다. 복원된 length에
 * 중간 공백이 포함되므로 PDF.js 기본 highlighter가 여러 text span을 그대로 칠할 수 있다.
 */
const installWhitespaceTolerantPdfSearch = (controller: PdfFindController | null) => {
  const controllerRecord = controller as (PdfFindController & Record<symbol, unknown>) | null;
  if (
    !controllerRecord
    || controllerRecord[PDF_FIND_WHITESPACE_PATCHED]
    || typeof controllerRecord.match !== 'function'
  ) {
    return;
  }

  const originalMatch = controllerRecord.match;
  controllerRecord.match = (query, pageContent, pageIndex) => {
    /**
     * query는 문자열 하나이거나 문자열 배열이다(배열은 PDF.js가 OR로 엮는다 —
     * 검색어 칩을 여러 개 켠 경우). 둘 다 공백을 지운 사본으로 찾고 위치만 되돌린다.
     * 배열을 그대로 넘기지 않는 이유: PDF.js가 그 배열을 제자리에서 정렬한다(`sort()`).
     */
    const queries = typeof query === 'string' ? [query] : query;
    const compactQueries = queries
      .map((part) => (typeof part === 'string' ? part.replace(/\s+/gu, '') : ''))
      .filter(Boolean);
    const { compactText, originalIndexes } = compactPdfSearchText(pageContent);
    if (compactQueries.length === 0 || !compactText) {
      return originalMatch.call(controllerRecord, query, pageContent, pageIndex);
    }

    const compactMatches = originalMatch.call(
      controllerRecord,
      // 원래 형태(문자열/배열)를 유지한다. PDF.js가 형태에 따라 다른 정규식을 만든다.
      typeof query === 'string' ? compactQueries[0] : compactQueries,
      compactText,
      pageIndex,
    );
    if (!compactMatches) return compactMatches;

    return compactMatches.flatMap((match) => {
      const originalStart = originalIndexes[match.index];
      const originalLast = originalIndexes[match.index + match.length - 1];
      if (originalStart === undefined || originalLast === undefined) return [];

      return [{
        index: originalStart,
        length: originalLast + 1 - originalStart,
      }];
    });
  };
  controllerRecord[PDF_FIND_WHITESPACE_PATCHED] = true;
};

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
  /**
   * 배율. 숫자면 그 비율로, `page-width`면 페이지 너비에 맞춘다.
   *
   * 시작값은 `usePdfViewerStore`가 들고 있는 마지막 배율이다. 이래야 다른 문서·다른 화면에서
   * 뷰어를 새로 열어도 사용자가 맞춰 둔 배율 그대로 열린다. 구독이 아니라 mount 시점에 한 번만
   * 읽는다 — 두 뷰어가 동시에 떠 있을 때 한쪽 확대가 다른 쪽 화면을 흔들면 곤란하다.
   */
  const [pdfScaleValue, setPdfScaleValue] = React.useState<'page-width' | number>(
    () => usePdfViewerStore.getState().zoom,
  );
  // 'page-width'로 시작하면 실제 %는 pdf.js가 정하므로, 그때까지의 표시값만 100%로 둔다.
  const [pdfZoomPercent, setPdfZoomPercent] = React.useState<number>(
    () => (typeof pdfScaleValue === 'number' ? Math.round(pdfScaleValue * 100) : 100),
  );
  const [isPdfDocumentReady, setIsPdfDocumentReady] = React.useState(false);
  const [isHighlighterReady, setIsHighlighterReady] = React.useState(false);
  const [highlighterUtilsRevision, setHighlighterUtilsRevision] = React.useState(0);

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
  /**
   * 검색어가 둘 이상일 때 걸어 둔 목록. 없으면 단일 검색어(또는 검색 없음)다.
   *
   * 다음/이전 이동이 무엇을 대상으로 하는지 정하는 데 쓴다 — 라이브러리는 마지막 검색어를
   * 자기 ref에 담아 두는데, 다중 검색어는 그 경로를 거치지 않기 때문이다(아래 주석).
   */
  const multiQueryRef = React.useRef<string[] | null>(null);

  /**
   * PDF.js의 `find` 이벤트를 직접 올린다.
   *
   * 라이브러리의 `utils.search()`를 쓸 수 없는 경우가 하나 있다 — 검색어 배열이다.
   * 그 함수는 `query.trim()`을 부르므로 배열을 넘기면 그 자리에서 죽는다. 반면 PDF.js
   * find controller는 배열을 정식으로 받아 `(a)|(b)` 정규식으로 엮는다(= OR 검색).
   * 그래서 배열만 이 경로로 보낸다. payload는 라이브러리가 보내는 것과 같은 모양이다.
   */
  const dispatchPdfFind = React.useCallback((
    query: string | string[],
    options?: { again?: boolean; findPrevious?: boolean },
  ): boolean => {
    const utils = highlighterUtilsRef.current as any;
    const eventBus = utils?.getEventBus?.();
    if (!eventBus) return false;
    const viewer = utils?.getViewer?.();

    eventBus.dispatch('find', {
      source: viewer?.findController ?? viewer,
      // 'again'이면 같은 조건으로 다음(또는 이전) 결과만 옮긴다.
      type: options?.again ? 'again' : undefined,
      query,
      phraseSearch: true,
      findPrevious: options?.findPrevious ?? false,
      entireWord: false,
      ...PDF_SEARCH_OPTIONS,
    });
    return true;
  }, []);

  /**
   * PDF에 검색을 건다. 검색어 하나(문자열)이거나 여럿(배열 = OR)이다.
   *
   * 여럿은 PDF.js가 하나의 정규식으로 엮으므로 결과 순서·개수·다음/이전 이동이 모두 한
   * 검색으로 다뤄진다. 즉 칩 두 개를 켜면 "둘 중 아무거나"가 문서 순서대로 이어진다.
   */
  const searchPdf = React.useCallback((query: string | string[]) => {
    const utils = highlighterUtilsRef.current;
    if (!utils) return;

    /**
     * 입력창에 보일 값. **입력창은 사용자가 친 것만 담는다.**
     *
     * 문자열로 부르는 쪽은 toolbar 입력이므로 값을 **그대로** 넣는다(정규화한 값을 되돌려
     * 넣으면 사용자가 치는 중에 글자가 바뀐다 — 예를 들어 끝의 공백이 사라진다).
     *
     * 배열로 부르는 쪽은 검색어 칩이라 입력창을 건드리지 않는다. 칩으로 걸린 검색은 칩이
     * 말하고, 입력창에까지 옮겨 적으면 같은 낱말이 두 군데 보이거나 사용자가 치던 값이
     * 지워진다.
     */
    if (typeof query === 'string') setSearchQuery(query);

    // 한글 등 유니코드는 NFC로 정규화해 PDF 텍스트(대개 NFC)와 매칭이 어긋나지 않게 한다.
    const queries = (typeof query === 'string' ? [query] : query)
      .map((part) => part.normalize('NFC'))
      .filter((part) => part.trim().length > 0);

    if (queries.length === 0) {
      multiQueryRef.current = null;
      utils.clearSearch();
      setMatchCount({ current: 0, total: 0 });
      return;
    }

    if (queries.length === 1) {
      // 검색어 하나는 라이브러리 공개 API 그대로 쓴다(다음/이전도 라이브러리가 챙긴다).
      multiQueryRef.current = null;
      utils.search(queries[0], PDF_SEARCH_OPTIONS);
      return;
    }

    multiQueryRef.current = queries;
    if (!dispatchPdfFind(queries)) {
      // event bus에 닿지 못하면(라이브러리 내부 구조가 바뀐 경우) 첫 검색어만이라도 건다.
      multiQueryRef.current = null;
      utils.search(queries[0], PDF_SEARCH_OPTIONS);
    }
  }, [dispatchPdfFind]);

  /**
   * 문서 전문을 공백 없는 한 덩어리로 만들어 둔다. 검색어 트레이의 칩마다 "이 문서에 몇 건"을
   * 붙이는 데 쓴다.
   *
   * find controller로 세지 않는 이유: `search()`는 활성 쿼리를 갈아치우므로, 개수를 알아보려고
   * 부르는 순간 사용자가 보고 있던 하이라이트가 지워진다. 그래서 텍스트만 따로 읽는다.
   *
   * 공백을 지우는 것은 검색 어댑터(`installWhitespaceTolerantPdfSearch`)와 같은 규칙이다.
   * 규칙이 어긋나면 "12건"이라고 적힌 칩을 눌렀을 때 toolbar가 다른 수를 말한다.
   */
  const pdfCompactTextRef = React.useRef<{ document: any; text: string } | null>(null);

  const readCompactPdfText = React.useCallback(async (): Promise<string | null> => {
    const pdfDocument = pdfDocumentRef.current;
    if (!pdfDocument) return null;

    const cached = pdfCompactTextRef.current;
    if (cached && cached.document === pdfDocument) return cached.text;

    let raw = '';
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const content = await page.getTextContent();
      // 읽는 동안 사용자가 다른 문서로 옮겼다면 그 결과를 캐시에 넣어선 안 된다.
      if (pdfDocumentRef.current !== pdfDocument) return null;
      raw += content.items.map((item: any) => item.str ?? '').join('');
    }

    const text = raw.normalize('NFC').replace(/\s+/gu, '').toLocaleLowerCase();
    pdfCompactTextRef.current = { document: pdfDocument, text };
    return text;
  }, []);

  /** 검색어별 매칭 수. 문서가 아직 없거나 읽는 중에 바뀌면 null을 준다. */
  const countPdfTextMatches = React.useCallback(async (
    terms: string[],
  ): Promise<Record<string, number> | null> => {
    if (terms.length === 0) return {};
    const text = await readCompactPdfText();
    if (text === null) return null;

    const counts: Record<string, number> = {};
    terms.forEach((term) => {
      const needle = term.normalize('NFC').replace(/\s+/gu, '').toLocaleLowerCase();
      if (!needle) {
        counts[term] = 0;
        return;
      }
      let count = 0;
      // pdf.js와 같이 겹치지 않게 센다(찾은 길이만큼 건너뛴다).
      for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length)) {
        count += 1;
      }
      counts[term] = count;
    });
    return counts;
  }, [readCompactPdfText]);

  /**
   * 다음/이전 결과로. 다중 검색어는 라이브러리가 자기 ref에 담아 두지 않으므로
   * (위 `dispatchPdfFind` 주석) 그때만 같은 배열로 'again'을 직접 올린다.
   */
  const findNext = React.useCallback(() => {
    const multiQuery = multiQueryRef.current;
    if (multiQuery && dispatchPdfFind(multiQuery, { again: true })) return;
    highlighterUtilsRef.current?.findNext();
  }, [dispatchPdfFind]);

  const findPrevious = React.useCallback(() => {
    const multiQuery = multiQueryRef.current;
    if (multiQuery && dispatchPdfFind(multiQuery, { again: true, findPrevious: true })) return;
    highlighterUtilsRef.current?.findPrevious();
  }, [dispatchPdfFind]);

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

  // page-width로 시작한 실제 배율과 사용자가 변경한 배율을 toolbar에 동기화한다.
  React.useEffect(() => {
    const utils = highlighterUtilsRef.current;
    const viewer = (utils as any)?.getViewer?.();
    const eventBus = (utils as any)?.getEventBus?.();
    if (!viewer || !eventBus) return;

    const syncZoomPercent = (event?: { scale?: number }) => {
      const scale = Number(event?.scale ?? viewer.currentScale);
      if (!Number.isFinite(scale) || scale <= 0) return;

      const percent = Math.round(scale * 100);
      setPdfZoomPercent(percent);

      // ctrl+휠처럼 toolbar를 거치지 않은 확대도 다음 문서로 물려준다. 단 pdf.js가
      // 'page-width' 같은 프리셋으로 계산한 배율은 패널 폭에 딸린 값이라 저장하지 않는다.
      if (Number.isFinite(Number(viewer.currentScaleValue))) {
        usePdfViewerStore.getState().setZoomPercent(percent);
      }
    };

    syncZoomPercent();
    eventBus.on('scalechanging', syncZoomPercent);
    return () => eventBus.off('scalechanging', syncZoomPercent);
  }, [highlighterUtilsRevision]);

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
      viewerContainer.scrollTo({
        top: nextScrollTop,
        behavior: 'auto',
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
  }, [currentHighlights, dataHighlights, highlightLayoutRevision, pdfScaleValue, userHighlights, systemHighlights]);

  const setPdfDocument = React.useCallback((pdfDocument: any) => {
    const documentChanged = pdfDocumentRef.current !== pdfDocument;
    pdfDocumentRef.current = pdfDocument;
    if (documentChanged) {
      pdfPageSizeRequestsRef.current.clear();
      setPdfPageSizes({});
      // 이전 문서의 전문은 더 쓸 데가 없다(검색어 개수 세기용 캐시).
      pdfCompactTextRef.current = null;
    }
    setIsPdfDocumentReady(Boolean(pdfDocument));
  }, []);

  /** 배율을 직접 지정한다. 사용자가 toolbar에 숫자를 입력하는 경로도 이것을 쓴다. */
  const applyPdfZoom = React.useCallback((percent: number) => {
    const viewer = (highlighterUtilsRef.current as any)?.getViewer?.();
    if (!viewer) return;

    const nextPercent = clamp(percent, PDF_ZOOM_MIN_PERCENT, PDF_ZOOM_MAX_PERCENT);
    setPdfScaleValue(nextPercent / 100);
    // 다음에 열 문서가 물려받도록 남긴다.
    usePdfViewerStore.getState().setZoomPercent(nextPercent);
    viewer.currentScaleValue = String(nextPercent / 100);
  }, []);

  const zoomPdfIn = React.useCallback(() => {
    const viewer = (highlighterUtilsRef.current as any)?.getViewer?.();
    const currentPercent = Number(viewer?.currentScale) * 100;
    if (!Number.isFinite(currentPercent)) return;

    const nextZoom = PDF_ZOOM_LEVELS.find((level) => level > currentPercent + 0.5)
      ?? PDF_ZOOM_LEVELS[PDF_ZOOM_LEVELS.length - 1];
    applyPdfZoom(nextZoom);
  }, [applyPdfZoom]);

  const zoomPdfOut = React.useCallback(() => {
    const viewer = (highlighterUtilsRef.current as any)?.getViewer?.();
    const currentPercent = Number(viewer?.currentScale) * 100;
    if (!Number.isFinite(currentPercent)) return;

    const nextZoom = [...PDF_ZOOM_LEVELS]
      .reverse()
      .find((level) => level < currentPercent - 0.5) ?? PDF_ZOOM_LEVELS[0];
    applyPdfZoom(nextZoom);
  }, [applyPdfZoom]);

  /**
   * 페이지 너비에 맞춘다.
   *
   * 기본 배율(100%)로 되돌리는 것이 아니라 폭에 맞추는 별개의 동작이라 이름을 그렇게 붙였다.
   * 결과 배율은 pdf.js가 정하고, `scalechanging`으로 toolbar 표시값에 반영된다.
   */
  const fitPdfToPageWidth = React.useCallback(() => {
    const viewer = (highlighterUtilsRef.current as any)?.getViewer?.();
    setPdfScaleValue('page-width');
    // 저장하는 값은 결과 %가 아니라 '폭 맞춤'이라는 의도다. 폭은 패널마다 다르다.
    usePdfViewerStore.getState().setZoomToPageWidth();
    if (viewer) viewer.currentScaleValue = 'page-width';
  }, []);

  const setHighlighterUtils = React.useCallback((utils: any) => {
    const utilsChanged = highlighterUtilsRef.current !== utils;
    highlighterUtilsRef.current = utils;
    const findController = utils?.getViewer?.()?.findController as PdfFindController | undefined;
    installWhitespaceTolerantPdfSearch(findController ?? null);
    setIsHighlighterReady(Boolean(utils));
    if (utilsChanged) setHighlighterUtilsRevision((revision) => revision + 1);
  }, []);

  // Public API
  return {
    pdfViewerContainerRef,
    pdfRotation,
    pdfZoomPercent,
    pdfScaleValue,
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
    countPdfTextMatches,
    findNext,
    findPrevious,
    // Page Handlers
    pdfCurrentPage,
    setPdfCurrentPage,
    setPdfRotation,
    setPdfDocument,
    setHighlighterUtils,
    setPdfTotalPages,
    zoomPdfIn,
    zoomPdfOut,
    applyPdfZoom,
    fitPdfToPageWidth,
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
