import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App as AntApp, theme } from 'antd';
import PatentPdfToolbar from '../patent-analysis/pdf/PatentPdfToolbar';
import PatentPdfViewer from '../patent-analysis/pdf/PatentPdfViewer';
import PdfSearchTermTray, { type PdfSearchTerm } from './PdfSearchTermTray';
import { usePatentPdfViewer } from '../../hooks/usePatentPdfViewer';
import { patentRecordApi } from '../../services/patentRecordApi';
import { saveBlob } from '../../utils/patentPdf';

/**
 * PatentPdfViewer는 React.memo라 매번 새 배열을 넘기면 그때마다 다시 그린다.
 * 하이라이트를 쓰지 않으므로 모듈 수준의 빈 배열을 고정해서 넘긴다.
 */
const NO_HIGHLIGHTS: never[] = [];

/** 위와 같은 이유(고정 참조)로 트레이 검색어의 기본값도 모듈 수준에 둔다. */
const NO_SEARCH_TERMS: PdfSearchTerm[] = [];

/** 위와 같은 이유로 활성 검색어의 기본값도 고정 참조를 쓴다. */
const NO_ACTIVE_TERMS: readonly string[] = [];

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
   * 트레이에 놓을 검색어들. 개수 배지는 이 pane이 문서를 읽어 붙인다.
   *
   * 목록과 활성 검색어를 이 pane이 갖지 않는 이유: pane은 문서가 바뀔 때마다 remount되므로
   * (`key={resolvedPath}`) 여기 두면 문서를 옮길 때 쌓아 둔 검색어가 사라진다.
   * 여러 문서에 같은 검색어를 대 보는 것이 이 기능의 목적이라 상태는 위에서 들고 있다.
   */
  searchTerms?: PdfSearchTerm[];
  /** 지금 하이라이트할 검색어들. 둘 이상이면 OR로 함께 걸린다. */
  activeTerms?: readonly string[];
  /** 같은 검색어를 다시 걸어 달라는 요청 번호. */
  termRequest?: number;
  /** 트레이의 칩을 눌렀을 때(켜짐/꺼짐을 뒤집는다). */
  onToggleTerm?: (term: string) => void;
  /** toolbar에서 Enter/Search로 검색어를 쌓았을 때. */
  onAddTerm?: (term: string) => void;
  /** 트레이에서 검색어를 지웠을 때. */
  onRemoveTerm?: (term: string) => void;
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
  searchTerms = NO_SEARCH_TERMS,
  activeTerms = NO_ACTIVE_TERMS,
  termRequest = 0,
  onToggleTerm,
  onAddTerm,
  onRemoveTerm,
}) => {
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  // 패널이 좁아 기본은 접어 둔다. toolbar 버튼으로 펼칠 수 있다.
  const [thumbnailCollapsed, setThumbnailCollapsed] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const pdfViewer = usePatentPdfViewer({ currentHighlights: NO_HIGHLIGHTS });

  /**
   * 켜 둔 검색어들을 PDF에 하이라이트한다. 둘 이상이면 하나의 OR 검색으로 건다.
   *
   * 의존성이 `activeTerms`가 아니라 **`termRequest`**인 것이 중요하다. 목록이 그대로여도
   * 다시 걸어야 하는 때가 있다 — toolbar에서 이미 켜 둔 낱말을 다시 쳐서 쌓으면 목록은
   * 그대로지만 PDF에는 그 낱말 하나만 걸려 있으므로, 목록 전체로 되돌려야 한다.
   * 그래서 '다시 걸어 달라'는 요청(번호 증가)에만 반응한다.
   *
   * 빈 목록도 배열로 넘긴다. `searchPdf('')`로 지우면 사용자가 toolbar에 치던 값까지
   * 지워진다(문자열은 입력창 표시값을 함께 바꾼다 — 훅 주석 참고).
   */
  useEffect(() => {
    if (!pdfViewer.isHighlighterReady) return;
    if (activeTerms.length === 0) {
      pdfViewer.searchPdf([]);
      return;
    }
    if (!pdfViewer.isPdfDocumentReady) return;
    pdfViewer.searchPdf([...activeTerms]);
    // activeTerms는 번호와 함께 갱신되므로 여기서 다시 듣지 않는다(위 주석).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    termRequest,
    pdfViewer.isHighlighterReady,
    pdfViewer.isPdfDocumentReady,
    pdfViewer.searchPdf,
  ]);

  /**
   * 칩에 붙일 "이 문서에 몇 건". find controller를 쓰지 않고 전문을 따로 읽어 센다
   * (`countPdfTextMatches` 주석 참고 — 세러 검색하면 보고 있던 하이라이트가 지워진다).
   *
   * 문서가 준비된 뒤 한 번, 그리고 검색어가 늘거나 줄 때 다시 센다. 전문은 훅이 문서 단위로
   * 캐시하므로 두 번째부터는 문서를 다시 읽지 않는다.
   */
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>({});
  const termsKey = searchTerms.map(({ term }) => term).join('\u0000');

  useEffect(() => {
    if (!pdfViewer.isPdfDocumentReady) return;
    const terms = termsKey ? termsKey.split('\u0000') : [];
    if (terms.length === 0) {
      setMatchCounts({});
      return;
    }
    let cancelled = false;
    void pdfViewer.countPdfTextMatches(terms).then((counts) => {
      // 다 읽기 전에 문서를 옮겼다면 이 수는 다른 문서의 것이다. 버린다.
      if (cancelled || !counts) return;
      setMatchCounts(counts);
    });
    return () => { cancelled = true; };
    // termsKey가 목록을 대신한다(배열은 매 렌더 새 참조다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termsKey, pdfViewer.isPdfDocumentReady, pdfViewer.countPdfTextMatches]);

  const trayTerms = useMemo<PdfSearchTerm[]>(
    () => searchTerms.map((entry) => ({ ...entry, count: matchCounts[entry.term] })),
    [searchTerms, matchCounts],
  );

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
        /**
         * 입력창은 켜 둔 칩을 건드리지 않는다.
         *
         * 예전에는 여기서 칩의 선택을 모두 풀었다(활성 검색어가 하나였을 때, 입력창과 칩이
         * 같은 자리를 다투었기 때문이다). 이제 칩은 OR 목록이고 입력창은 그 목록에 넣을
         * 낱말을 적는 칸이라, 치는 동안에도 목록은 남아 있어야 한다 — Enter로 쌓으면 그
         * 낱말이 목록에 더해진다.
         */
        onSearchQueryChange={(value) => pdfViewer.setSearchQuery(value)}
        onRunSearch={(value) => pdfViewer.searchPdf(value ?? pdfViewer.searchQuery)}
        onClearSearch={() => pdfViewer.searchPdf('')}
        onCommitSearchTerm={onAddTerm
          ? (value) => {
            const term = value.trim();
            if (!term) return;
            onAddTerm(term);
            /**
             * 검색어가 칩으로 옮겨 갔으니 입력창을 비운다. 다음 검색어를 바로 칠 수 있고,
             * 같은 낱말이 칩과 입력창에 겹쳐 보이지도 않는다.
             *
             * 하이라이트는 `onAddTerm`이 켠 목록 전체로 다시 걸린다(pane 위쪽 effect).
             * 여기서 검색을 다시 걸지 않는 이유도 그것이다 — toolbar가 방금 건 검색은
             * 이 낱말 하나뿐이라 그대로 두면 앞서 켜 둔 칩이 빠진다.
             */
            pdfViewer.setSearchQuery('');
          }
          : undefined}
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

      {/* 칩은 토글이다. 결과 사이 이동은 toolbar의 ‹ › 가 맡는다(칩을 다시 눌러 다음
          결과로 넘기던 동작은 켜기/끄기와 겹쳐 무엇을 하는 버튼인지 알 수 없었다). */}
      <PdfSearchTermTray
        terms={trayTerms}
        activeTerms={activeTerms}
        onToggle={(term) => onToggleTerm?.(term)}
        onRemove={(term) => onRemoveTerm?.(term)}
        canHighlight
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
