import React from 'react';
import { Tag, Typography } from 'antd';
import DataCardItem, { DataCardItemProps } from './DataCardItem';

const { Text } = Typography;

/**
 * Raw Data 탭의 화합물 카드
 * - 구조(SVG), R Groups, SMILES 포함
 */
export interface CompoundCardProps {
  compound: {
    id: string;
    compound_id: string;
    compound_svg: string;
    scaffold?: string;
    page?: number | number[];
    bbox?: any[];
    ranking?: number;
    is_human_key_compound?: boolean;
    r_groups?: Record<string, string>;
  };
  pageIndices: Record<string, number>;
  activeCompId: string | null;
  onCardClick?: (compound: any) => void;
  onPreview?: (svg: string, title: string) => void;
  onPageChange?: (compId: string, direction: number) => void;
}

/**
 * Raw Data 화합물 카드 컴포넌트
 */
export const CompoundCard: React.FC<CompoundCardProps> = ({
  compound,
  pageIndices,
  activeCompId,
  onCardClick,
  onPreview,
  onPageChange,
}) => {
  const compKey = String(compound.id);
  const pageArr: number[] = Array.isArray(compound.page) ? compound.page : [];
  const curIdx = pageIndices[compKey] ?? 0;
  const rEntries = Object.entries(compound.r_groups ?? {}) as [string, string][];

  return (
    <DataCardItem
      title={compound.compound_id}
      tags={compound.ranking ? [{ label: `Rank ${compound.ranking}`, color: 'blue' }] : []}
      cornerIcon={
        compound.is_human_key_compound ? (
          <span style={{ fontSize: 16, cursor: 'pointer' }} title="Key Compound">
            🔑
          </span>
        ) : undefined
      }
      imageUrl={compound.compound_svg}
      imageType="svg"
      imageHeight={130}
      isActive={activeCompId === compKey}
      onClick={() => onCardClick?.(compound)}
      onPreview={() => onPreview?.(compound.compound_svg, compound.compound_id)}
      extraInfo={
        rEntries.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {rEntries.map(([k, v]) => (
              <Tag key={k} style={{ fontSize: 10 }}>
                <Text strong style={{ fontSize: 10 }}>
                  {k}:
                </Text>{' '}
                {v}
              </Tag>
            ))}
          </div>
        )
      }
      footerText={compound.scaffold}
      pagination={
        pageArr.length > 0
          ? {
              currentIndex: curIdx,
              totalCount: pageArr.length,
              onPrev: () => onPageChange?.(compKey, -1),
              onNext: () => onPageChange?.(compKey, 1),
              pageLabel: () => `p.${pageArr[curIdx] ?? '-'}`,
            }
          : undefined
      }
    />
  );
};

export default CompoundCard;

