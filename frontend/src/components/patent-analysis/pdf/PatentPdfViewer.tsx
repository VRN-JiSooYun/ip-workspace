import React from 'react';
import { Card } from 'antd';
import { PdfLoader, ThumbnailPanel, usePageNavigation } from 'react-pdf-highlighter-plus';
import type { PdfHighlighterUtils } from 'react-pdf-highlighter-plus';
import PatentPdfRenderer from './Viewer/PatentPdfRenderer';
import './patentPdfViewer.css';

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
};

type PdfViewerContentProps = {
  pdfDocument: any;
  highlighterUtils: PdfHighlighterUtils | null;
  onGoToPage?: (page: number) => void;
  viewerContainerRef: React.RefObject<HTMLDivElement>;
  borderColor: string;
  rotation: number;
  pdfTotalPages: number;
  activeBBox: { pageNumber: number; rect: number[] } | null;
  dynamicHighlights: any[];
  onPdfDocumentReady: (pdfDocument: any) => void;
  onPdfTotalPagesChange: (totalPages: number) => void;
  setHighlighterUtils: (utils: PdfHighlighterUtils) => void;
  onAddHighlight?: (highlight: any) => void;
};

const PdfViewerContent: React.FC<PdfViewerContentProps> = ({
  pdfDocument,
  highlighterUtils,
  onGoToPage,
  viewerContainerRef,
  borderColor,
  rotation,
  pdfTotalPages,
  activeBBox,
  dynamicHighlights,
  onPdfDocumentReady,
  onPdfTotalPagesChange,
  setHighlighterUtils,
  onAddHighlight,
}) => {
  return (
    <>
      <div
        style={{
          width: 240,
          minWidth: 200,
          borderRight: `1px solid ${borderColor}`,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
        }}
      >
        <ThumbnailSidebar
          pdfDocument={pdfDocument}
          highlighterUtils={highlighterUtils}
          onGoToPage={onGoToPage}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
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
            setHighlighterUtils={setHighlighterUtils}
            onAddHighlight={onAddHighlight}
          />
        </div>
      </div>
    </>
  );
};

const ThumbnailSidebar: React.FC<{
  pdfDocument: any;
  highlighterUtils: PdfHighlighterUtils | null;
  onGoToPage?: (page: number) => void;
}> = ({ pdfDocument, highlighterUtils, onGoToPage }) => {
  const ENABLE_THUMBNAIL_DEBUG_LOG = true;
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

    if (ENABLE_THUMBNAIL_DEBUG_LOG) {
      console.log('[ThumbnailDebug] render start', { page, queueSize: queueRef.current.length });
    }

    try {
      const dataUrl = await renderThumbnail(page);
      loadedRef.current.add(page);
      updateThumbnail(page, { pageNumber: page, dataUrl, isLoading: false });
      if (ENABLE_THUMBNAIL_DEBUG_LOG) {
        console.log('[ThumbnailDebug] render done', { page });
      }
    } catch (error) {
      updateThumbnail(page, {
        pageNumber: page,
        dataUrl: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load',
      });
      if (ENABLE_THUMBNAIL_DEBUG_LOG) {
        console.warn('[ThumbnailDebug] render failed', { page, error });
      }
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

    if (ENABLE_THUMBNAIL_DEBUG_LOG) {
      console.log('[ThumbnailDebug] queued', { page, queueSize: queueRef.current.length });
    }

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

  React.useEffect(() => {
    if (!ENABLE_THUMBNAIL_DEBUG_LOG) return;
    const entries = Array.from(thumbnails.entries());
    const loading = entries.filter(([, value]) => value?.isLoading).map(([page]) => page);
    const loaded = entries.filter(([, value]) => !!value?.dataUrl && !value?.isLoading).map(([page]) => page);
    const failed = entries.filter(([, value]) => !!value?.error && !value?.isLoading).map(([page]) => page);
    console.log('[ThumbnailDebug] snapshot', {
      totalPages,
      cacheSize: entries.length,
      loading,
      loadedCount: loaded.length,
      failed,
      queueSize: queueRef.current.length,
      activeRender: activeRenderRef.current,
    });
  }, [thumbnails, totalPages]);

  const resolvedCurrentPage = currentPage > 0 ? currentPage : 1;

  return (
    <div style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <ThumbnailPanel
        totalPages={totalPages}
        currentPage={resolvedCurrentPage}
        thumbnails={thumbnails}
        loadThumbnail={loadThumbnail}
        onPageSelect={(page) => {
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

const PatentPdfViewer: React.FC<PatentPdfViewerProps> = ({
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
}) => {
  const [highlighterUtils, setLocalHighlighterUtils] = React.useState<PdfHighlighterUtils | null>(null);

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
        <PdfLoader document={document}>
          {(pdfDocument: any) => (
            <PdfViewerContent
              pdfDocument={pdfDocument}
              highlighterUtils={highlighterUtils}
              onGoToPage={onGoToPage}
              viewerContainerRef={viewerContainerRef}
              borderColor={borderColor}
              rotation={rotation}
              pdfTotalPages={pdfTotalPages}
              activeBBox={activeBBox}
              dynamicHighlights={dynamicHighlights}
              onPdfDocumentReady={onPdfDocumentReady}
              onPdfTotalPagesChange={onPdfTotalPagesChange}
              setHighlighterUtils={handleHighlighterUtils}
              onAddHighlight={onAddHighlight}
            />
          )}
        </PdfLoader>
      </div>
    </Card>
  );
};

export default PatentPdfViewer;
