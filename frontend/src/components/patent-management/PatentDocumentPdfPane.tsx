import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App as AntApp, theme } from 'antd';
import PatentPdfToolbar from '../patent-analysis/pdf/PatentPdfToolbar';
import PatentPdfViewer from '../patent-analysis/pdf/PatentPdfViewer';
import { usePatentPdfViewer } from '../../hooks/usePatentPdfViewer';
import { patentRecordApi } from '../../services/patentRecordApi';
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
  /**
   * 하이라이트할 검색어. 근거 줄(어떤 token이 발견됐는지)은 타임라인 위에서 그리고,
   * 여기로는 고른 token 하나만 내려온다 — 이 pane은 문서가 바뀔 때마다 remount되므로
   * 그 줄을 안에 두면 통째로 다시 그려진다(`PatentDocumentViewer` 주석 참고).
   */
  activeTerm?: string | null;
  /** 같은 검색어를 다시 눌렀을 때도 하이라이트를 다시 걸기 위한 번호. */
  termRequest?: number;
  /** toolbar에서 사용자가 직접 검색했을 때. 근거 줄의 선택 표시를 풀어야 한다. */
  onManualSearch?: () => void;
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
 * 주소는 두 가지가 온다.
 *
 *  - **우리 서버를 거치는 중계 경로**(`/patent-documents/…`) — 파일 호스트에 인증이 없어
 *    밖에 노출하지 않으려고 서비스가 대신 받아 준다. 같은 origin이고 **세션 쿠키가 있어야**
 *    권한 검사를 통과한다.
 *  - **상류 주소 그대로**(파일 호스트 설정이 없는 사내 환경) — 다른 origin이고
 *    `Access-Control-Allow-Origin: *`이라, 반대로 자격증명을 함께 보내면 브라우저가 막는다.
 *
 * 그래서 자격증명 여부를 주소에 따라 정한다. 하나로 고정하면 둘 중 하나가 반드시 깨진다.
 */
const PatentDocumentPdfPane: React.FC<Props> = ({
  documentPath,
  activeTerm = null,
  termRequest = 0,
  onManualSearch,
}) => {
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  // 패널이 좁아 기본은 접어 둔다. toolbar 버튼으로 펼칠 수 있다.
  const [thumbnailCollapsed, setThumbnailCollapsed] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const pdfViewer = usePatentPdfViewer({ currentHighlights: NO_HIGHLIGHTS });

  /**
   * 고른 검색어를 PDF에 하이라이트한다.
   *
   * 의존성이 `activeTerm`이 아니라 **`termRequest`**인 것이 중요하다. 사용자가 toolbar에서
   * 직접 검색하면 근거 줄의 선택이 풀려 `activeTerm`이 null이 되는데, 그것까지 이 effect가
   * 받으면 방금 입력한 검색을 `searchPdf('')`로 지워 버린다. 그래서 '근거를 다시 걸어 달라'는
   * 요청(번호 증가)에만 반응한다 — 같은 검색어를 다시 눌러도 번호가 올라 다시 걸린다.
   */
  useEffect(() => {
    if (!pdfViewer.isHighlighterReady) return;
    if (!activeTerm) {
      pdfViewer.searchPdf('');
      return;
    }
    if (!pdfViewer.isPdfDocumentReady) return;
    pdfViewer.searchPdf(activeTerm);
    // activeTerm은 번호와 함께 갱신되므로 여기서 다시 듣지 않는다(위 주석).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    termRequest,
    pdfViewer.isHighlighterReady,
    pdfViewer.isPdfDocumentReady,
    pdfViewer.searchPdf,
  ]);

  /** 서버가 준 값은 API 기준 상대 경로일 수 있다. 브라우저가 쓸 주소로 완성한다. */
  const fileUrl = useMemo(
    () => patentRecordApi.documentDisplayUrl(documentPath),
    [documentPath],
  );
  /** 주소가 바뀌었다면 우리 서버를 거친다는 뜻이다(위 머리글 참고). */
  const viaProxy = fileUrl !== documentPath;

  const handleOpenInBrowser = useCallback(() => {
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  }, [fileUrl]);

  /**
   * 특허 분석의 `downloadPatentPdfFile`은 공개번호로 OCR PDF를 받는 API라 여기서는 못 쓴다.
   * OA 문서는 URL이 곧 원본이므로 직접 받아 저장한다. 다른 origin이어서 anchor의 download
   * 속성은 무시되므로 blob으로 받아야 파일명이 유지된다.
   */
  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const response = await fetch(fileUrl, {
        credentials: viaProxy ? 'same-origin' : 'omit',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // 파일명은 원본 경로에서 읽는다. 중계 경로도 뒤쪽이 같지만 원본이 더 곧다.
      saveBlob(await response.blob(), fileNameOf(documentPath));
    } catch (error) {
      void message.error(
        `PDF를 내려받지 못했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
      );
    } finally {
      setDownloading(false);
    }
  }, [documentPath, fileUrl, message, viaProxy]);

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
        onZoomPercentChange={pdfViewer.applyPdfZoom}
        onFitPageWidth={pdfViewer.fitPdfToPageWidth}
        fitPageWidthActive={pdfViewer.pdfScaleValue === 'page-width'}
        onOpenPdfInBrowser={handleOpenInBrowser}
        onSearchQueryChange={(value) => {
          onManualSearch?.();
          pdfViewer.setSearchQuery(value);
        }}
        onRunSearch={(value) => {
          onManualSearch?.();
          pdfViewer.searchPdf(value ?? pdfViewer.searchQuery);
        }}
        onClearSearch={() => {
          onManualSearch?.();
          pdfViewer.searchPdf('');
        }}
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
          document={fileUrl}
          withCredentials={viaProxy}
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
