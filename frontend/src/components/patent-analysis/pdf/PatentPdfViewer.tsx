import React from 'react';
import { Card } from 'antd';
// @ts-ignore - runtime exports exist but not in type declarations
import { PdfLoader, ThumbnailPanel, usePageNavigation } from 'react-pdf-highlighter-plus';
import type { PdfHighlighterUtils } from 'react-pdf-highlighter-plus';
import PatentPdfRenderer from './Viewer/PatentPdfRenderer';
import './patentPdfViewer.css';

const PDFJS_WASM_URL = import.meta.env.PROD
  ? '/pdfjs/wasm/'
  : 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/wasm/';

type PatentPdfViewerProps = {
  document: string;
  rotation: number;
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
  thumbnailCollapsed?: boolean;
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
  thumbnailCollapsed,
}) => {
  const [highlighterUtils, setLocalHighlighterUtils] = React.useState<PdfHighlighterUtils | null>(null);
  const [pdfDoc, setPdfDoc] = React.useState<any>(null);
  const pdfDocumentParams = React.useMemo(() => ({
    url: document,
    wasmUrl: PDFJS_WASM_URL,
  }), [document]);

  const handleHighlighterUtils = React.useCallback((utils: PdfHighlighterUtils) => {
    setLocalHighlighterUtils(utils);
    setHighlighterUtils(utils);
  }, [setHighlighterUtils]);


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
            transition: 'width 0.2s ease',
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
          <PdfLoader document={pdfDocumentParams}>
            {(pdfDocument: any) => {
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
                    pdfTotalPages={pdfTotalPages}
                    activeBBox={activeBBox}
                    dynamicHighlights={dynamicHighlights}
                    onPdfDocumentReady={onPdfDocumentReady}
                    onPdfTotalPagesChange={onPdfTotalPagesChange}
                    setHighlighterUtils={handleHighlighterUtils}
                    onAddHighlight={onAddHighlight}
                  />
                </div>
              );
            }}
          </PdfLoader>
        </div>
      </div>
    </Card>
  );
};

export default React.memo(PatentPdfViewerComponent);
