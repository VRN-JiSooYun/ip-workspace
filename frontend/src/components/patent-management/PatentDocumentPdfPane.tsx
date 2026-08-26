import React, { useCallback, useState } from 'react';
import { App as AntApp, theme } from 'antd';
import PatentPdfToolbar from '../patent-analysis/pdf/PatentPdfToolbar';
import PatentPdfViewer from '../patent-analysis/pdf/PatentPdfViewer';
import { usePatentPdfViewer } from '../../hooks/usePatentPdfViewer';
import { saveBlob } from '../../utils/patentPdf';

/**
 * PatentPdfViewer는 React.memo라 매번 새 배열을 넘기면 그때마다 다시 그린다.
 * 하이라이트를 쓰지 않으므로 모듈 수준의 빈 배열을 고정해서 넘긴다.
 */
const NO_HIGHLIGHTS: never[] = [];

/** `http://.../oa/2023/1020237016326_의견제출통지서_20260526.pdf` → 마지막 경로 조각. */
const fileNameOf = (documentPath: string): string => {
  const lastSegment = documentPath.split('/').pop() || 'document.pdf';
  try {
    return decodeURIComponent(lastSegment);
  } catch {
    return lastSegment;
  }
};

type Props = {
  /** 문서 PDF의 절대 URL (`documentPath`). */
  documentPath: string;
};

/**
 * 문서 뷰어의 `문서 전문` 탭 본체.
 *
 * 특허 분석 화면(`/patents/analysis/:id`)의 `PatentPdfToolbar` + `PatentPdfViewer` +
 * `usePatentPdfViewer`를 그대로 재사용한다. 훅의 특허 의존성은 하이라이트 배율을 고르는
 * `patentNumber` 하나뿐이고 없으면 기본값을 쓰므로, 임의의 PDF에도 그대로 쓸 수 있다.
 * 검색·페이지 이동은 라이브러리 표준 기능이라 문서 종류와 무관하다.
 *
 * 분할 화면이 없으므로 toolbar의 확대/축소(`onToggleFit`)만 넘기지 않아 버튼이 빠진다.
 *
 * `withCredentials`는 false다. OA 문서 호스트가 `Access-Control-Allow-Origin: *`로 응답해
 * 자격증명을 함께 보내면 브라우저가 요청을 막는다(확인함).
 */
const PatentDocumentPdfPane: React.FC<Props> = ({ documentPath }) => {
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  // 패널이 좁아 기본은 접어 둔다. toolbar 버튼으로 펼칠 수 있다.
  const [thumbnailCollapsed, setThumbnailCollapsed] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const pdfViewer = usePatentPdfViewer({ currentHighlights: NO_HIGHLIGHTS });

  const handleOpenInBrowser = useCallback(() => {
    window.open(documentPath, '_blank', 'noopener,noreferrer');
  }, [documentPath]);

  /**
   * 특허 분석의 `downloadPatentPdfFile`은 공개번호로 OCR PDF를 받는 API라 여기서는 못 쓴다.
   * OA 문서는 URL이 곧 원본이므로 직접 받아 저장한다. 다른 origin이어서 anchor의 download
   * 속성은 무시되므로 blob으로 받아야 파일명이 유지된다.
   */
  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const response = await fetch(documentPath, { credentials: 'omit' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      saveBlob(await response.blob(), fileNameOf(documentPath));
    } catch (error) {
      void message.error(
        `PDF를 내려받지 못했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
      );
    } finally {
      setDownloading(false);
    }
  }, [documentPath, message]);

  return (
    <div className="pm-doc-pdf">
      <PatentPdfToolbar
        borderColor={token.colorBorderSecondary}
        backgroundColor={token.colorBgContainer}
        textColor={token.colorText}
        searchQuery={pdfViewer.searchQuery}
        searchMatchCount={pdfViewer.matchCount.total}
        activeMatchIndex={pdfViewer.matchCount.current}
        searchExecuted={pdfViewer.matchCount.total > 0}
        currentPage={pdfViewer.pdfCurrentPage}
        totalPages={pdfViewer.pdfTotalPages}
        zoomPercent={pdfViewer.pdfZoomPercent}
        onZoomIn={pdfViewer.zoomPdfIn}
        onZoomOut={pdfViewer.zoomPdfOut}
        onResetZoom={pdfViewer.resetPdfZoom}
        onOpenPdfInBrowser={handleOpenInBrowser}
        onSearchQueryChange={pdfViewer.setSearchQuery}
        onRunSearch={(value) => pdfViewer.searchPdf(value ?? pdfViewer.searchQuery)}
        onClearSearch={() => pdfViewer.searchPdf('')}
        onMoveSearchMatch={(direction) =>
          direction > 0 ? pdfViewer.findNext() : pdfViewer.findPrevious()
        }
        onRotateLeft={() => pdfViewer.setPdfRotation((r) => (r - 90 + 360) % 360)}
        onRotateRight={() => pdfViewer.setPdfRotation((r) => (r + 90) % 360)}
        onGoToPage={(page) => pdfViewer.handleGoToPdf(page)}
        onPageStep={(step) => {
          if (!pdfViewer.pdfTotalPages) return;
          const next = Math.min(
            Math.max((pdfViewer.pdfCurrentPage || 1) + step, 1),
            pdfViewer.pdfTotalPages,
          );
          pdfViewer.handleGoToPdf(next);
        }}
        onDownloadPdf={downloading ? undefined : () => void handleDownload()}
        downloadTooltip="PDF 원본 다운로드"
        thumbnailCollapsed={thumbnailCollapsed}
        onToggleThumbnail={() => setThumbnailCollapsed((prev) => !prev)}
      />

      <div className="pm-doc-pdf-viewer">
        <PatentPdfViewer
          document={documentPath}
          withCredentials={false}
          rotation={pdfViewer.pdfRotation}
          pdfScaleValue={pdfViewer.pdfScaleValue}
          viewerContainerRef={pdfViewer.pdfViewerContainerRef}
          currentPage={pdfViewer.pdfCurrentPage}
          onGoToPage={pdfViewer.handleGoToPdf}
          pdfTotalPages={pdfViewer.pdfTotalPages}
          onPdfTotalPagesChange={pdfViewer.setPdfTotalPages}
          activeBBox={pdfViewer.activeBBox}
          dynamicHighlights={pdfViewer.dynamicHighlights}
          userHighlights={pdfViewer.userHighlights}
          onPdfDocumentReady={pdfViewer.setPdfDocument}
          setHighlighterUtils={pdfViewer.setHighlighterUtils}
          backgroundColor={token.colorBgContainer}
          borderColor={token.colorBorderSecondary}
          thumbnailCollapsed={thumbnailCollapsed}
        />
      </div>
    </div>
  );
};

export default PatentDocumentPdfPane;
