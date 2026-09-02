import React from 'react';
import { Button, Input, InputNumber, Space, Tooltip, Typography } from 'antd';
import { Maximize2, Minimize2, MoveHorizontal, RotateCcw, RotateCw, PanelLeftClose, PanelLeftOpen, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Download, ExternalLink, ZoomIn, ZoomOut } from 'lucide-react';
import {
  PDF_ZOOM_MAX_PERCENT,
  PDF_ZOOM_MIN_PERCENT,
} from '../../../hooks/usePatentPdfViewer';

const { Text } = Typography;

type PdfToolbarButtonProps = React.ComponentProps<typeof Button> & {
  tooltip: string;
};

const PdfToolbarButton: React.FC<PdfToolbarButtonProps> = ({
  tooltip,
  ...buttonProps
}) => (
  <Tooltip title={tooltip}>
    <span style={{ display: 'inline-flex' }}>
      <Button
        {...buttonProps}
        aria-label={buttonProps['aria-label'] ?? tooltip}
      />
    </span>
  </Tooltip>
);

type PatentPdfToolbarProps = {
  /**
   * 분할 화면의 PDF 영역 비율. `onToggleFit`과 함께 쓰인다.
   *
   * 분할이 없는 화면(예: 문서 뷰어 사이드 패널)에서는 이 셋을 모두 생략하면 확대/축소
   * 버튼이 빠진다. 접힌 패널에서 아무 일도 하지 않는 버튼을 남기지 않기 위함이다.
   */
  splitRatio?: number;
  minSplitPercent?: number;
  borderColor: string;
  backgroundColor: string;
  textColor: string;
  searchQuery: string;
  searchMatchCount: number;
  activeMatchIndex: number;
  searchExecuted: boolean;
  currentPage: number;
  totalPages: number;
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** 사용자가 직접 입력한 배율(%). 범위 밖 값은 부르는 쪽에서 잘린다. */
  onZoomPercentChange: (percent: number) => void;
  /** 페이지 너비에 맞춘다. 기본 배율로 되돌리는 것과는 다른 동작이다. */
  onFitPageWidth: () => void;
  /** 지금 폭 맞춤 상태인지. 버튼을 눌린 모양으로 두는 데만 쓴다. */
  fitPageWidthActive?: boolean;
  onToggleFit?: () => void;
  onOpenPdfInBrowser?: () => void;
  onSearchQueryChange: (value: string) => void;
  onRunSearch: (value?: string) => void;
  onClearSearch: () => void;
  onMoveSearchMatch: (direction: number) => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onGoToPage?: (page: number) => void;
  onPageStep?: (step: number) => void;
  onDownloadPdf?: () => void;
  /** 기본값은 특허 분석의 OCR PDF 기준. 원본을 그대로 받는 화면에서는 바꿔 넘긴다. */
  downloadTooltip?: string;
  thumbnailCollapsed?: boolean;
  onToggleThumbnail?: () => void;
};

const PatentPdfToolbar: React.FC<PatentPdfToolbarProps> = ({
  splitRatio,
  minSplitPercent,
  borderColor,
  backgroundColor,
  textColor,
  searchQuery,
  searchMatchCount,
  activeMatchIndex,
  searchExecuted,
  currentPage,
  totalPages,
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onZoomPercentChange,
  onFitPageWidth,
  fitPageWidthActive = false,
  onToggleFit,
  onOpenPdfInBrowser,
  onSearchQueryChange,
  onRunSearch,
  onClearSearch,
  onMoveSearchMatch,
  onRotateLeft,
  onRotateRight,
  onGoToPage,
  onPageStep,
  onDownloadPdf,
  downloadTooltip = 'OCR PDF 다운로드',
  thumbnailCollapsed,
  onToggleThumbnail,
}) => {
  const [pageInput, setPageInput] = React.useState<number | null>(currentPage);
  /**
   * 배율 입력값. 타이핑 중에는 화면 배율과 다를 수 있어 문자열로 따로 들고 있다가 확정될 때만
   * 적용한다. 확대·축소나 폭 맞춤으로 배율이 밖에서 바뀌면 아래 effect가 맞춘다.
   *
   * `InputNumber`가 아니라 `Input`을 쓰는 이유: `InputNumber`는 내부에서 자기 `onKeyDown`을
   * 달아 바깥에서 넘긴 Enter 처리가 닿지 않는다(값은 blur에서만 확정된다).
   */
  const [zoomInput, setZoomInput] = React.useState(String(zoomPercent));
  // 한글 등 IME 조합 중인지 추적. 조합 중에는 검색을 실행하지 않고, compositionEnd 시점에 실행한다.
  const isComposingRef = React.useRef(false);

  React.useEffect(() => {
    setPageInput(currentPage);
  }, [currentPage]);

  React.useEffect(() => {
    setZoomInput(String(zoomPercent));
  }, [zoomPercent]);

  /** 입력한 배율을 적용한다. 비었거나 숫자가 아니면 지금 배율로 되돌린다. */
  const commitZoom = () => {
    const next = Number(zoomInput);
    if (!zoomInput || !Number.isFinite(next)) {
      setZoomInput(String(zoomPercent));
      return;
    }
    // 범위 밖 값은 부르는 쪽이 자른다. 잘린 결과는 scalechanging을 타고 표시값으로 돌아온다.
    onZoomPercentChange(next);
  };

  const commitPage = () => {
    if (pageInput && pageInput >= 1 && pageInput <= totalPages && onGoToPage) {
      onGoToPage(pageInput);
    } else {
      setPageInput(currentPage);
    }
  };

  return (
    <div
      style={{
        marginBottom: 10,
        padding: '10px 12px',
        borderRadius: 12,
        border: `1px solid ${borderColor}`,
        background: backgroundColor,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        flexShrink: 0,
      }}
    >
      <PdfToolbarButton
        icon={thumbnailCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        size="small"
        onClick={onToggleThumbnail}
        tooltip={thumbnailCollapsed ? 'PDF 썸네일 펼치기' : 'PDF 썸네일 접기'}
      />

      {onToggleFit && (
        <PdfToolbarButton
          icon={
            (splitRatio ?? 0) <= (minSplitPercent ?? 0)
              ? <Maximize2 size={16} />
              : <Minimize2 size={16} />
          }
          size="small"
          onClick={onToggleFit}
          tooltip={(splitRatio ?? 0) <= (minSplitPercent ?? 0)
            ? 'PDF Viewer 영역 확대 (45%)'
            : `PDF Viewer 영역 축소 (${minSplitPercent}%)`}
        />
      )}

      <PdfToolbarButton
        icon={<ExternalLink size={16} />}
        size="small"
        onClick={onOpenPdfInBrowser}
        disabled={!onOpenPdfInBrowser}
        tooltip="브라우저에서 PDF 전체 보기"
      />

      <Input
        allowClear
        value={searchQuery}
        onChange={(event) => {
          const value = event.target.value;
          onSearchQueryChange(value); // 표시값은 항상 갱신
          // 영어/숫자 등 조합이 없는 입력은 기존처럼 라이브 검색. 한글 조합 중에는 건너뛴다.
          if (!isComposingRef.current) {
            onRunSearch(value);
          }
        }}
        onCompositionStart={() => { isComposingRef.current = true; }}
        onCompositionEnd={(event) => {
          isComposingRef.current = false;
          // 한글 조합 완료 시점의 최종 값으로 검색 실행
          onRunSearch((event.target as HTMLInputElement).value);
        }}
        onPressEnter={(event) => onRunSearch((event.target as HTMLInputElement).value)}
        placeholder="PDF 텍스트 조회"
        style={{ flex: '1 1 180px', minWidth: 160, maxWidth: 260 }}
        size="small"
      />

      <PdfToolbarButton
        size="small"
        type="primary"
        tooltip="입력한 텍스트를 PDF에서 검색"
        onClick={() => onRunSearch(searchQuery)}
      >
        Search
      </PdfToolbarButton>

      <Text style={{ fontSize: 11 }}>
        {searchMatchCount > 0
            ? `${activeMatchIndex}/${searchMatchCount}`
            : searchExecuted && searchQuery.trim()
                ? '0 matches'
                : '-/-'}
      </Text>
      <PdfToolbarButton
        size="small"
        icon={<ChevronLeft size={14} />}
        onClick={() => onMoveSearchMatch(-1)}
        disabled={searchMatchCount === 0}
        tooltip="이전 검색 결과로 이동"
      />
      <PdfToolbarButton
        size="small"
        icon={<ChevronRight size={14} />}
        onClick={() => onMoveSearchMatch(1)}
        disabled={searchMatchCount === 0}
        tooltip="다음 검색 결과로 이동"
      />

      <Space size={4} style={{ marginLeft: 'auto' }}>
        <PdfToolbarButton
          size="small"
          icon={<ZoomOut size={14} />}
          onClick={onZoomOut}
          disabled={zoomPercent <= PDF_ZOOM_MIN_PERCENT}
          tooltip="PDF 축소"
        />
        <Tooltip title={`배율 직접 입력 (${PDF_ZOOM_MIN_PERCENT}~${PDF_ZOOM_MAX_PERCENT}%)`}>
          <Input
            size="small"
            aria-label="PDF 배율"
            inputMode="numeric"
            value={zoomInput}
            // 숫자만 받는다. 단위는 suffix가 보여 주므로 값에 섞이지 않는다.
            onChange={(event) => setZoomInput(event.target.value.replace(/[^\d]/g, ''))}
            onPressEnter={commitZoom}
            onBlur={commitZoom}
            suffix={<span style={{ fontSize: 11, color: textColor }}>%</span>}
            style={{ width: 68, fontSize: 11 }}
          />
        </Tooltip>
        <PdfToolbarButton
          size="small"
          icon={<ZoomIn size={14} />}
          onClick={onZoomIn}
          disabled={zoomPercent >= PDF_ZOOM_MAX_PERCENT}
          tooltip="PDF 확대"
        />
        <PdfToolbarButton
          size="small"
          icon={<MoveHorizontal size={14} />}
          type={fitPageWidthActive ? 'primary' : 'default'}
          onClick={onFitPageWidth}
          aria-pressed={fitPageWidthActive}
          tooltip="페이지 너비에 맞춤"
        />
        <PdfToolbarButton
          size="small"
          icon={<ChevronUp size={14} />}
          onClick={() => onPageStep?.(-1)}
          disabled={!totalPages}
          tooltip="이전 PDF 페이지로 이동"
        />
        <PdfToolbarButton
          size="small"
          icon={<ChevronDown size={14} />}
          onClick={() => onPageStep?.(1)}
          disabled={!totalPages}
          tooltip="다음 PDF 페이지로 이동"
        />
        {/* IP Workspace에서는 불필요 기능 */}
        {/* <PdfToolbarButton
          size="small"
          icon={<RotateCcw size={14} />}
          onClick={onRotateLeft}
          tooltip="PDF를 왼쪽으로 회전"
        />
        <PdfToolbarButton
          size="small"
          icon={<RotateCw size={14} />}
          onClick={onRotateRight}
          tooltip="PDF를 오른쪽으로 회전"
        /> */}
        <PdfToolbarButton
          size="small"
          icon={<Download size={14} />}
          onClick={onDownloadPdf}
          disabled={!onDownloadPdf}
          tooltip={downloadTooltip}
        />
        <InputNumber
          size="small"
          min={1}
          max={totalPages || 1}
          value={currentPage}
          onChange={(val) => {
            if (val && onGoToPage) onGoToPage(val);
          }}
          onPressEnter={(e) => {
            const val = Number((e.target as HTMLInputElement).value);
            if (val >= 1 && val <= totalPages && onGoToPage) onGoToPage(val);
          }}
          style={{ width: 60 }}
          controls={false}
        />
        <Text style={{ fontSize: 11 }}>/ {totalPages || '-'}</Text>
      </Space>
    </div>
  );
};

export default React.memo(PatentPdfToolbar);
