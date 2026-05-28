import React from 'react';
import { Tag, Typography } from 'antd';
import DataCardItem, { DataCardItemProps } from './DataCardItem';

const { Text } = Typography;

/**
 * Tables 탭의 결과 테이블 카드
 */
export interface ResultTableCardProps {
  tableItem: {
    table_num?: number;
    table_group?: string;
    has_compound?: boolean;
    table_base64?: string[];
    page?: number | number[];
    bbox?: any[];
  };
  pageIndices: Record<string, number>;
  tableKey: string;
  activeCompId: string | null;
  onCardClick?: (tableItem: any) => void;
  onPreview?: (image: string, title: string) => void;
  onPageChange?: (tableKey: string, direction: number) => void;
}

/**
 * 결과 테이블 카드 컴포넌트
 */
export const ResultTableCard: React.FC<ResultTableCardProps> = ({
  tableItem,
  pageIndices,
  tableKey,
  activeCompId,
  onCardClick,
  onPreview,
  onPageChange,
}) => {
  const base64List = Array.isArray(tableItem?.table_base64) ? tableItem.table_base64 : [];
  const firstImage =
    typeof base64List[0] === 'string'
      ? base64List[0].startsWith('data:')
        ? base64List[0]
        : `data:image/png;base64,${base64List[0]}`
      : null;
  const pageArray = Array.isArray(tableItem?.page) ? tableItem.page : [];
  const tableCurrentIndex = pageIndices[tableKey] ?? 0;

  return (
    <DataCardItem
      title={`Table ${tableItem?.table_group ?? tableItem?.table_num ?? '?'}`}
      tags={[
        { label: `Table ${tableItem?.table_group ?? ''}`, color: 'blue' },
        {
          label: tableItem?.has_compound ? 'Compound 포함' : 'Compound 없음',
          color: tableItem?.has_compound ? 'green' : 'default',
        },
      ]}
      imageUrl={firstImage || ''}
      imageType="base64"
      imageHeight={150}
      isActive={activeCompId === tableKey}
      onClick={() => onCardClick?.(tableItem)}
      onPreview={
        firstImage
          ? () => onPreview?.(firstImage, `Table ${tableItem?.table_num ?? '?'}`)
          : undefined
      }
      extraInfo={
        <div>
          <Text style={{ fontSize: 11 }}>
            Pages: {pageArray.length > 0 ? pageArray.join(', ') : '-'}
          </Text>
          <br />
          <Text style={{ fontSize: 11 }}>Images: {base64List.length}</Text>
        </div>
      }
      pagination={
        pageArray.length > 0
          ? {
              currentIndex: tableCurrentIndex,
              totalCount: pageArray.length,
              onPrev: () => onPageChange?.(tableKey, -1),
              onNext: () => onPageChange?.(tableKey, 1),
              pageLabel: () => `p.${pageArray[tableCurrentIndex] ?? '-'}`,
            }
          : undefined
      }
    />
  );
};

export default ResultTableCard;

