import React from 'react';
import { Button, Checkbox, Input, Space, Typography } from 'antd';
import { Maximize2, Minimize2, RotateCcw, RotateCw } from 'lucide-react';
import type { PdfSearchMatchDebugInfo } from '../../../hooks/usePatentPdfViewer';

const { Text } = Typography;

type PatentPdfToolbarProps = {
  splitRatio: number;
  minSplitPercent: number;
  borderColor: string;
  backgroundColor: string;
  warningBorderColor: string;
  warningBackgroundColor: string;
  textColor: string;
  searchQuery: string;
  searchHighlightAll: boolean;
  searchCaseSensitive: boolean;
  searchMatchCount: number;
  activeMatchIndex: number;
  searchExecuted: boolean;
  currentPage: number;
  totalPages: number;
  activeMatchDebugInfo: PdfSearchMatchDebugInfo | null;
  onToggleFit: () => void;
  onSearchQueryChange: (value: string) => void;
  onRunSearch: () => void;
  onClearSearch: () => void;
  onToggleHighlightAll: (checked: boolean) => void;
  onToggleCaseSensitive: (checked: boolean) => void;
  onMoveSearchMatch: (direction: number) => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
};

const PatentPdfToolbar: React.FC<PatentPdfToolbarProps> = ({
  splitRatio,
  minSplitPercent,
  borderColor,
  backgroundColor,
  warningBorderColor,
  warningBackgroundColor,
  textColor,
  searchQuery,
  searchHighlightAll,
  searchCaseSensitive,
  searchMatchCount,
  activeMatchIndex,
  searchExecuted,
  currentPage,
  totalPages,
  activeMatchDebugInfo,
  onToggleFit,
  onSearchQueryChange,
  onRunSearch,
  onClearSearch,
  onToggleHighlightAll,
  onToggleCaseSensitive,
  onMoveSearchMatch,
  onRotateLeft,
  onRotateRight,
}) => {
  return (
    <>
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

        <Checkbox
          checked={searchHighlightAll}
          onChange={(event) => onToggleHighlightAll(event.target.checked)}
        >
          highlightAll
        </Checkbox>
        <Checkbox
          checked={searchCaseSensitive}
          onChange={(event) => onToggleCaseSensitive(event.target.checked)}
        >
          caseSensitive
        </Checkbox>

        <Button size="small" onClick={onClearSearch}>
          Clear
        </Button>

        <Button size="small" onClick={() => onMoveSearchMatch(-1)} disabled={searchMatchCount === 0}>
          Prev
        </Button>
        <Button size="small" onClick={() => onMoveSearchMatch(1)} disabled={searchMatchCount === 0}>
          Next
        </Button>

        <Text style={{ fontSize: 12 }}>
          {searchMatchCount > 0
            ? `${activeMatchIndex}/${searchMatchCount}`
            : searchExecuted && searchQuery.trim()
              ? '0 matches'
              : '-/-'}
        </Text>

        <Text style={{ fontSize: 12, marginLeft: 4 }}>
          Page {currentPage}/{totalPages || '-'}
        </Text>

        {activeMatchDebugInfo && (
          <Text style={{ fontSize: 11, marginLeft: 8, fontFamily: 'Monaco, Consolas, monospace' }}>
            {`p.${activeMatchDebugInfo.pageNumber || '-'} x:${activeMatchDebugInfo.x} y:${activeMatchDebugInfo.y} w:${activeMatchDebugInfo.width} h:${activeMatchDebugInfo.height}`}
          </Text>
        )}

        <Space size={4} style={{ marginLeft: 'auto' }}>
          <Button size="small" icon={<RotateCcw size={14} />} onClick={onRotateLeft} title="좌측으로 회전" />
          <Button size="small" icon={<RotateCw size={14} />} onClick={onRotateRight} title="우측으로 회전" />
        </Space>
      </div>

      {activeMatchDebugInfo && (
        <div
          style={{
            marginBottom: 10,
            padding: '8px 12px',
            borderRadius: 10,
            border: `1px dashed ${warningBorderColor}`,
            background: warningBackgroundColor,
            color: textColor,
            fontSize: 12,
            fontFamily: 'Monaco, Consolas, monospace',
            flexShrink: 0,
          }}
        >
          {`Active match -> page ${activeMatchDebugInfo.pageNumber || '-'}, x ${activeMatchDebugInfo.x}, y ${activeMatchDebugInfo.y}, width ${activeMatchDebugInfo.width}, height ${activeMatchDebugInfo.height}${typeof activeMatchDebugInfo.scaledX1 === 'number' && typeof activeMatchDebugInfo.scaledY1 === 'number' && typeof activeMatchDebugInfo.scaledX2 === 'number' && typeof activeMatchDebugInfo.scaledY2 === 'number' ? `, scaled [${activeMatchDebugInfo.scaledX1}, ${activeMatchDebugInfo.scaledY1}, ${activeMatchDebugInfo.scaledX2}, ${activeMatchDebugInfo.scaledY2}]` : ''}${activeMatchDebugInfo.positionStatus ? `, status ${activeMatchDebugInfo.positionStatus}` : ''}${activeMatchDebugInfo.referenceSource ? `, reference ${activeMatchDebugInfo.referenceSource}` : ''}${activeMatchDebugInfo.positionReason ? `, reason "${activeMatchDebugInfo.positionReason}"` : ''}${activeMatchDebugInfo.text ? `, text "${activeMatchDebugInfo.text}"` : ''}`}
        </div>
      )}
    </>
  );
};

export default PatentPdfToolbar;
