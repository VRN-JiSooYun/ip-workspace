import React from 'react';
import { Button, Input, InputNumber, Space, Typography } from 'antd';
import { Maximize2, Minimize2, RotateCcw, RotateCw } from 'lucide-react';

const { Text } = Typography;

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
  onSearchQueryChange: (value: string) => void;
  onRunSearch: () => void;
  onClearSearch: () => void;
  onMoveSearchMatch: (direction: number) => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onGoToPage?: (page: number) => void;
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
  onSearchQueryChange,
  onRunSearch,
  onClearSearch,
  onMoveSearchMatch,
  onRotateLeft,
  onRotateRight,
  onGoToPage,
}) => {
  const [pageInput, setPageInput] = React.useState<number | null>(currentPage);

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
      <Button
        icon={splitRatio <= minSplitPercent ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
        size="small"
        onClick={onToggleFit}
        title={splitRatio <= minSplitPercent ? 'PDF 영역 확대 (50%)' : 'PDF 영역 축소 (30%)'}
      >
        {splitRatio <= minSplitPercent ? 'Expand' : 'Shrink'}
      </Button>

      <Input
        allowClear
        value={searchQuery}
        onChange={(event) => onSearchQueryChange(event.target.value)}
        onPressEnter={onRunSearch}
        placeholder="PDF 텍스트 조회"
        style={{ width: 220 }}
        size="small"
      />

      <Button size="small" type="primary" onClick={onRunSearch}>
        Search
      </Button>

      <Text style={{ fontSize: 12 }}>
        {searchMatchCount > 0
            ? `${activeMatchIndex}/${searchMatchCount}`
            : searchExecuted && searchQuery.trim()
                ? '0 matches'
                : '-/-'}
      </Text>
      <Button size="small" onClick={() => onMoveSearchMatch(-1)} disabled={searchMatchCount === 0}>
        Prev
      </Button>
      <Button size="small" onClick={() => onMoveSearchMatch(1)} disabled={searchMatchCount === 0}>
        Next
      </Button>

      <Space size={4} style={{ marginLeft: 'auto' }}>
        <Button size="small" icon={<RotateCcw size={14} />} onClick={onRotateLeft} title="좌측으로 회전" />
        <Button size="small" icon={<RotateCw size={14} />} onClick={onRotateRight} title="우측으로 회전" />
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
        <Text style={{ fontSize: 12 }}>/ {totalPages || '-'}</Text>
      </Space>
    </div>
  );
};

export default PatentPdfToolbar;
