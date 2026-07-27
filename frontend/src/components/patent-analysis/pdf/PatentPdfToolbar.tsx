import React from 'react';
import { Button, Input, InputNumber, Space, Tooltip, Typography } from 'antd';
import { Maximize2, Minimize2, RotateCcw, RotateCw, PanelLeftClose, PanelLeftOpen, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Download, ExternalLink } from 'lucide-react';

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
  splitRatio: number;
  minSplitPercent: number;
  borderColor: string;
  backgroundColor: string;
  textColor: string;
  searchQuery: string;
  searchMatchCount: number;
  activeMatchIndex: number;
  searchExecuted: boolean;
  currentPage: number;
  totalPages: number;
  onToggleFit: () => void;
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
  thumbnailCollapsed,
  onToggleThumbnail,
}) => {
  const [pageInput, setPageInput] = React.useState<number | null>(currentPage);
  // 한글 등 IME 조합 중인지 추적. 조합 중에는 검색을 실행하지 않고, compositionEnd 시점에 실행한다.
  const isComposingRef = React.useRef(false);

  React.useEffect(() => {
    setPageInput(currentPage);
  }, [currentPage]);

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

      <PdfToolbarButton
        icon={splitRatio <= minSplitPercent ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
        size="small"
        onClick={onToggleFit}
        tooltip={splitRatio <= minSplitPercent
          ? 'PDF Viewer 영역 확대 (45%)'
          : `PDF Viewer 영역 축소 (${minSplitPercent}%)`}
      />

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
        <PdfToolbarButton
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
        />
        <PdfToolbarButton
          size="small"
          icon={<Download size={14} />}
          onClick={onDownloadPdf}
          disabled={!onDownloadPdf}
          tooltip="OCR PDF 다운로드"
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
