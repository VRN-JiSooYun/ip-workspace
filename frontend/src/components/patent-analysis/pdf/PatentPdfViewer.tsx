import React from 'react';
import { Card, Spin } from 'antd';
// @ts-ignore - runtime exports exist but not in type declarations
import { PdfLoader, ThumbnailPanel, usePageNavigation } from 'react-pdf-highlighter-plus';
import type { PdfHighlighterUtils } from 'react-pdf-highlighter-plus';
import PatentPdfRenderer from './Viewer/PatentPdfRenderer';
import './patentPdfViewer.css';
import { withBasePath } from '../../../config/basePath';

const PDFJS_WASM_URL = import.meta.env.PROD
  ? withBasePath('pdfjs/wasm/')
  : 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/wasm/';

/**
 * 문서를 받는 동안의 표시.
 *
 * 라이브러리 기본값(`Loading n%`)을 쓰지 않는 이유는 두 가지다. 색이 `black` 고정이라 다크
 * 테마에서 읽히지 않고, `total`이 0일 때 `Infinity%`를 그린다.
 */
const PdfLoadingIndicator: React.FC<{ progress: { loaded: number; total: number } }> = ({
  progress,
}) => {
  const percent = progress.total > 0
    ? Math.min(100, Math.floor((progress.loaded / progress.total) * 100))
    : null;
  return (
    <div className="patent-pdf-loading">
      <Spin size="small" />
      <span>{percent === null ? '문서를 불러오는 중' : `문서를 불러오는 중 ${percent}%`}</span>
    </div>
  );
};

let pdfWorkerTerminationWarningFilterCount = 0;
let originalConsoleWarn: typeof console.warn | null = null;

const isPdfWorkerTerminationWarning = (args: unknown[]) => {
  const message = args.map((arg) => String(arg)).join(' ');
  return message.includes('getTextContent - ignoring errors')
    && message.includes('Worker task was terminated');
};

const installPdfWorkerTerminationWarningFilter = () => {
  pdfWorkerTerminationWarningFilterCount += 1;
  if (pdfWorkerTerminationWarningFilterCount === 1) {
    originalConsoleWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      if (isPdfWorkerTerminationWarning(args)) return;
      originalConsoleWarn?.(...args);
    };
  }

  return () => {
    pdfWorkerTerminationWarningFilterCount = Math.max(0, pdfWorkerTerminationWarningFilterCount - 1);
    if (pdfWorkerTerminationWarningFilterCount === 0 && originalConsoleWarn) {
      console.warn = originalConsoleWarn;
      originalConsoleWarn = null;
    }
  };
};

type PatentPdfViewerProps = {
  document: string;
  rotation: number;
  pdfScaleValue: 'page-width' | number;
  viewerContainerRef: React.RefObject<HTMLDivElement>;
  currentPage: number;
  onGoToPage?: (page: number) => void;
  pdfTotalPages: number;
  activeBBox: { pageNumber: number; rect: number[] } | null;
  dynamicHighlights: any[];
  userHighlights: any[];
  onPdfDocumentReady: (pdfDocument: any) => void;
  onPdfTotalPagesChange: (totalPages: number) => void;
  setHighlighterUtils: (utils: PdfHighlighterUtils) => void;
  backgroundColor: string;
  borderColor: string;
  onAddHighlight?: (highlight: any) => void;
  onDeleteHighlight?: (id: string) => void;
  onScrollToHighlight?: (highlight: any) => void;
  onHighlightClick?: (highlight: any) => void;
  thumbnailCollapsed?: boolean;
  /**
   * 문서를 자격증명과 함께 받을지. 기본값 true는 인증이 필요한 특허 분석 PDF 기준이다.
   *
   * 자격증명을 함께 보내면 브라우저가 `Access-Control-Allow-Origin: *` 응답을 거부하므로,
   * 그런 호스트(예: OA 문서를 주는 SeaweedFS)에서는 false로 내려야 로드된다.
   */
  withCredentials?: boolean;
};

const ThumbnailSidebar: React.FC<{
  pdfDocument: any;
  highlighterUtils: PdfHighlighterUtils | null;
  onGoToPage?: (page: number) => void;
}> = ({ pdfDocument, highlighterUtils, onGoToPage }) => {
  const PRELOAD_LIMIT = 10;
  const THUMBNAIL_WIDTH = 140;
  const THUMBNAIL_IMAGE_QUALITY = 0.68;
  const THUMBNAIL_RENDER_TIMEOUT_MS = 10000;
  const totalPages = Number(pdfDocument?.numPages ?? 0);
  const [thumbnails, setThumbnails] = React.useState<Map<number, any>>(new Map());
  const thumbnailsRef = React.useRef(thumbnails);
  const queueRef = React.useRef<number[]>([]);
  const queuedRef = React.useRef<Set<number>>(new Set());
  const loadingRef = React.useRef<Set<number>>(new Set());
  const loadedRef = React.useRef<Set<number>>(new Set());
  const activeRenderRef = React.useRef(false);

  const { currentPage, goToPage } = usePageNavigation({
    viewer: highlighterUtils?.getViewer() ?? null,
    eventBus: highlighterUtils?.getEventBus() ?? null,
  });

  React.useEffect(() => {
    thumbnailsRef.current = thumbnails;
  }, [thumbnails]);

  const updateThumbnail = React.useCallback((page: number, value: any) => {
    setThumbnails((prev) => {
      const next = new Map(prev);
      next.set(page, value);
      return next;
    });
  }, []);

  const renderThumbnail = React.useCallback(async (page: number) => {
    const pdfPage = await pdfDocument.getPage(page);
    const viewport = pdfPage.getViewport({ scale: 1 });
    const scale = THUMBNAIL_WIDTH / viewport.width;
    const scaledViewport = pdfPage.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(scaledViewport.width);
    canvas.height = Math.ceil(scaledViewport.height);
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context is unavailable');
    }

    const renderTask = pdfPage.render({ canvasContext: context, viewport: scaledViewport });
    const timeout = window.setTimeout(() => {
      renderTask.cancel();
    }, THUMBNAIL_RENDER_TIMEOUT_MS);

    try {
      await renderTask.promise;
      return canvas.toDataURL('image/jpeg', THUMBNAIL_IMAGE_QUALITY);
    } finally {
      window.clearTimeout(timeout);
      canvas.width = 0;
      canvas.height = 0;
      pdfPage.cleanup?.();
    }
  }, [pdfDocument]);

  const processQueue = React.useCallback(async () => {
    if (activeRenderRef.current) return;
    const page = queueRef.current.shift();
    if (!page) return;

    queuedRef.current.delete(page);
    activeRenderRef.current = true;

    try {
      const dataUrl = await renderThumbnail(page);
      loadedRef.current.add(page);
      updateThumbnail(page, { pageNumber: page, dataUrl, isLoading: false });
    } catch (error) {
      updateThumbnail(page, {
        pageNumber: page,
        dataUrl: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load',
      });
    } finally {
      loadingRef.current.delete(page);
      activeRenderRef.current = false;
      window.setTimeout(processQueue, 0);
    }
  }, [renderThumbnail, updateThumbnail]);

  const loadThumbnail = React.useCallback(async (page: number) => {
    if (!page || page < 1 || page > totalPages) return;
    if (loadedRef.current.has(page) || loadingRef.current.has(page) || queuedRef.current.has(page)) return;

    loadingRef.current.add(page);
    queuedRef.current.add(page);
    queueRef.current.push(page);
    updateThumbnail(page, { pageNumber: page, dataUrl: null, isLoading: true });

    processQueue();
  }, [processQueue, totalPages, updateThumbnail]);

  React.useEffect(() => {
    setThumbnails(new Map());
    thumbnailsRef.current = new Map();
    queueRef.current = [];
    queuedRef.current.clear();
    loadingRef.current.clear();
    loadedRef.current.clear();
    activeRenderRef.current = false;
  }, [pdfDocument]);

  React.useEffect(() => {
    if (!totalPages) return;
    const preloadMaxPage = Math.min(PRELOAD_LIMIT, totalPages);
    for (let page = 1; page <= preloadMaxPage; page += 1) {
      loadThumbnail(page);
    }
  }, [loadThumbnail, totalPages]);


  const resolvedCurrentPage = currentPage > 0 ? currentPage : 1;

  return (
    <div style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <ThumbnailPanel
        totalPages={totalPages}
        currentPage={resolvedCurrentPage}
        thumbnails={thumbnails}
        loadThumbnail={loadThumbnail}
        onPageSelect={(page: number) => {
          onGoToPage?.(page);
          goToPage(page);
        }}
        showPageNumbers
        estimatedItemHeight={280}
        overscan={4}
        gap={8}
      />
    </div>
  );
};

const PatentPdfViewerComponent: React.FC<PatentPdfViewerProps> = ({
  document,
  rotation,
  pdfScaleValue,
  viewerContainerRef,
  onGoToPage,
  pdfTotalPages,
  activeBBox,
  dynamicHighlights,
  onPdfDocumentReady,
  onPdfTotalPagesChange,
  setHighlighterUtils,
  backgroundColor,
  borderColor,
  onAddHighlight,
  onHighlightClick,
  thumbnailCollapsed,
  withCredentials = true,
}) => {
  const [highlighterUtils, setLocalHighlighterUtils] = React.useState<PdfHighlighterUtils | null>(null);
  const [pdfDoc, setPdfDoc] = React.useState<any>(null);
  const pdfDocumentParams = React.useMemo(() => ({
    url: document,
    wasmUrl: PDFJS_WASM_URL,
    withCredentials,
  }), [document, withCredentials]);

  React.useEffect(() => installPdfWorkerTerminationWarningFilter(), []);

  React.useEffect(() => {
    setPdfDoc(null);
    setLocalHighlighterUtils(null);
  }, [document]);

  const handleHighlighterUtils = React.useCallback((utils: PdfHighlighterUtils) => {
    setLocalHighlighterUtils(utils);
    setHighlighterUtils(utils);
  }, [setHighlighterUtils]);

  /**
   * 문서 하나를 그리는 본체. `PdfLoader`의 children과 `beforeLoad` 두 곳에서 같이 쓴다.
   *
   * 두 곳에서 쓰는 이유가 이 화면의 버그 하나를 막는다. `PdfLoader`는 문서를 ref에 담고
   * 로딩 표시를 끄는 일을 로드 promise의 `finally` **한 번**에만 맡긴다. 그런데 pdf.js는
   * 문서 promise가 resolve된 뒤(`GetDoc`) 전체 수신이 끝나면 진행 이벤트를 하나 더 보낸다
   * (`DataLoaded`, `loaded === total`). 그 이벤트가 로딩 표시를 다시 켜고, 끌 코드는 이미
   * 지나가 버린 뒤라 화면이 `Loading 100%`에 영구히 갇힌다.
   *
   * 로컬에서는 파일이 사실상 한 번에 도착해 `DataLoaded`가 resolve보다 먼저 끝나서 드러나지
   * 않는다. 배포에서는 앞단 nginx와 문서 중계를 거쳐 나눠 도착하므로 순서가 뒤집힌다.
   *
   * 그래서 이미 받아 둔 문서가 있으면 진행 이벤트가 와도 같은 뷰어를 그대로 그린다. 같은
   * 위치에 같은 타입을 그리므로 React가 언마운트하지 않아 스크롤·하이라이트 상태도 남는다.
   */
  const renderViewer = (pdfDocument: any) => {
    if (pdfDocument !== pdfDoc) {
      setTimeout(() => setPdfDoc(pdfDocument), 0);
    }
    return (
      <div
        className="patent-pdf-main-viewer"
        ref={viewerContainerRef}
        style={{
          height: '100%',
          width: '100%',
          position: 'relative',
          transform: `rotate(${rotation}deg)`,
          transformOrigin: 'center center',
          transition: 'transform 0.2s ease',
        }}
      >
        <PatentPdfRenderer
          pdfDocument={pdfDocument}
          pdfScaleValue={pdfScaleValue}
          pdfTotalPages={pdfTotalPages}
          activeBBox={activeBBox}
          dynamicHighlights={dynamicHighlights}
          onPdfDocumentReady={onPdfDocumentReady}
          onPdfTotalPagesChange={onPdfTotalPagesChange}
          setHighlighterUtils={handleHighlighterUtils}
          onAddHighlight={onAddHighlight}
          onHighlightClick={onHighlightClick}
        />
      </div>
    );
  };


  return (
    <Card
      style={{
        flex: 1,
        borderRadius: '16px',
        background: backgroundColor,
        border: `1px solid ${borderColor}`,
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
      styles={{
        body: {
          flex: 1,
          padding: 0,
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', minHeight: 0 }}>
        <div
          style={{
            width: thumbnailCollapsed ? 0 : 240,
            minWidth: thumbnailCollapsed ? 0 : 200,
            borderRight: thumbnailCollapsed ? 'none' : `1px solid ${borderColor}`,
            minHeight: 0,
            overflow: 'hidden',
            display: thumbnailCollapsed ? 'none' : 'flex',
            flexDirection: 'column',
            background: backgroundColor,
          }}
        >
          {!thumbnailCollapsed && pdfDoc && (
            <ThumbnailSidebar
              pdfDocument={pdfDoc}
              highlighterUtils={highlighterUtils}
              onGoToPage={onGoToPage}
            />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <PdfLoader
            document={pdfDocumentParams}
            // 뒤늦게 오는 진행 이벤트로 뷰어가 로딩 표시에 밀려나지 않게 한다(renderViewer 주석).
            beforeLoad={(progress: { loaded: number; total: number }) => (
              pdfDoc
                ? renderViewer(pdfDoc)
                : <PdfLoadingIndicator progress={progress} />
            )}
          >
            {renderViewer}
          </PdfLoader>
        </div>
      </div>
    </Card>
  );
};

export default React.memo(PatentPdfViewerComponent);
