import React, { useState } from 'react';
import { Button, Card, Tag, Tooltip, Typography, theme } from 'antd';
import { ChevronLeft, Search } from 'lucide-react';
import ChemDrawModal from '../common/ChemDrawModal';
import BenzeneIcon from '../common/BenzeneIcon';
import CompoundStructureView from '../common/CompoundStructureView';
import type { CompoundStructureLinkedImageCopy } from '../common/CompoundStructureView';

const { Text } = Typography;

/**
 * 데이터 카드 아이템의 Props 인터페이스
 * Raw Data, Summary, Tables 탭에서 공통으로 사용
 */
export interface DataCardItemProps {
  // ===== 헤더 영역 =====
  /** 헤더 왼쪽에 표시할 주요 텍스트 */
  title: string;
  /** 기본 title/tag header를 대체하는 custom header */
  headerContent?: React.ReactNode;
  /** 헤더 메타데이터 (compound_id 등) */
  subtitle?: string;
  /** 우측 상단 태그 배열 */
  tags?: Array<{ label: string; color?: string }>;
  /** 우측 상단 아이콘 (🔑 등) */
  cornerIcon?: React.ReactNode;

  // ===== 이미지 영역 =====
  /** 이미지 URL (SVG string 또는 base64) */
  imageUrl: string;
  /** 이미지 유형: 'svg' | 'base64' | 'img' */
  imageType?: 'svg' | 'base64' | 'img';
  /** 이미지 높이 (px) */
  imageHeight?: number;
  /** 이미지 영역을 정사각형으로 표시 */
  squareImage?: boolean;
  /** SVG의 전체 캔버스 배경을 투명하게 표시 */
  transparentImageBackground?: boolean;
  /** 이미지 wrapper의 평상시 테두리를 제거 */
  imageBorderless?: boolean;
  /** 이미지 클릭 시 콜백 */
  onImageClick?: () => void;
  /** 이미지 미리보기 버튼 클릭 콜백 */
  onPreview?: () => void;
  /** 이미지 영역 우측 상단에 항상 표시할 추가 액션 */
  imageOverlayActions?: React.ReactNode;
  /** SMILES 문자열 (값이 있으면 copy 버튼 표시) */
  smiles?: string;
  /** Molblock 문자열 (ChemDraw 로드용) */
  molblock?: string;
  /** 링크가 포함된 구조 이미지를 클립보드에 복사하는 액션 설정 */
  linkedImageCopy?: CompoundStructureLinkedImageCopy;

  // ===== 푸터 영역 =====
  /** 추가 정보 (R Groups 태그 등) */
  extraInfo?: React.ReactNode;
  /** 푸터 추가 텍스트 */
  footerText?: string;

  // ===== 네비게이션 =====
  /** 페이지 네비게이션 설정 */
  pagination?: {
    currentIndex: number;
    totalCount: number;
    onPrev: () => void;
    onNext: () => void;
    pageLabel?: (idx: number, current: number) => string;
  };

  // ===== 상태 =====
  /** 선택됨 표시 */
  isActive?: boolean;
  /** 평상시 카드 테두리를 제거하고 선택 시에만 테두리와 음영 표시 */
  selectionOnlyBorder?: boolean;
  /** 선택 표시 방식 */
  selectionVariant?: 'default' | 'sarHeader';
  /** 카드 클릭 콜백 */
  onClick?: () => void;
  /** 카드 크기 (Ant Design CardSize와 동일) */
  size?: 'small' | 'default';
  /** 호버 효과 활성화 */
  hoverable?: boolean;
}

/**
 * 공통 데이터 카드 컴포넌트
 *
 * 사용처:
 * - PatentAnalysisDetail.tsx의 Raw Data 탭
 * - PatentAnalysisDetail.tsx의 Summary 탭
 * - PatentAnalysisDetail.tsx의 Tables 탭
 */
const DataCardItem: React.FC<DataCardItemProps> = ({
  title,
  headerContent,
  subtitle,
  tags = [],
  cornerIcon,
  imageUrl,
  imageType = 'svg',
  imageHeight = 130,
  squareImage = false,
  transparentImageBackground = false,
  imageBorderless = false,
  onImageClick,
  onPreview,
  imageOverlayActions,
  smiles,
  molblock,
  linkedImageCopy,
  extraInfo,
  footerText,
  pagination,
  isActive = false,
  selectionOnlyBorder = false,
  selectionVariant = 'default',
  onClick,
  size = 'small',
  hoverable = true,
}) => {
  const { token } = theme.useToken();
  const [chemDrawOpen, setChemDrawOpen] = useState(false);
  const imageClickHandler = onImageClick ?? onClick;
  const structureActionSize = size === 'small' ? 12 : 14;
  const structureHeight = squareImage ? '100%' : imageHeight;
  const usesSarHeaderSelection = selectionVariant === 'sarHeader';

  // SVG 렌더링 컴포넌트
  const renderImage = () => {
    if (!imageUrl) {
      return (
        <div
          style={{
            height: imageHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: token.colorTextTertiary,
            fontSize: 11,
          }}
        >
          이미지 없음
        </div>
      );
    }

    switch (imageType) {
      case 'svg':
        return (
          <CompoundStructureView
            svg={imageUrl}
            title={title}
            smiles={smiles}
            molBlock={molblock}
            width="100%"
            height={structureHeight}
            iconSize={28}
            gap={0}
            fullWidth
            frameless
            structureFitMode="contain"
            transparentBackground={transparentImageBackground}
            actionPlacement="overlay"
            actionOverlayAnchor="container"
            actionOverlayPlacement="bottom-right"
            frameStyle={{ border: 0, outline: 0, boxShadow: 'none', background: 'transparent', overflow: 'visible' }}
            onPreview={onPreview}
            linkedImageCopy={linkedImageCopy}
            actions={(smiles || molblock) ? [{
              key: 'chemdraw',
              title: 'ChemDraw',
              icon: <BenzeneIcon size={structureActionSize} />,
              onClick: (event) => {
                event.stopPropagation();
                setChemDrawOpen(true);
              },
            }] : []}
          />
        );
      case 'base64':
      case 'img':
        return (
          <img
            src={imageUrl.startsWith('data:') ? imageUrl : `data:image/png;base64,${imageUrl}`}
            alt="content"
            style={{
              width: '100%',
              height: squareImage ? '100%' : imageHeight,
              objectFit: 'contain',
              overflow: 'hidden',
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
    <Card
      size={size}
      hoverable={hoverable}
      className={`patent-data-card-item${usesSarHeaderSelection ? ' patent-data-card-item-sar-header' : ''}${isActive ? ' is-active' : ''}`}
      style={{
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        border: usesSarHeaderSelection
          ? undefined
          : isActive
            ? `2px solid ${token.colorPrimary}`
            : selectionOnlyBorder
              ? '2px solid transparent'
              : undefined,
        background: usesSarHeaderSelection
          ? undefined
          : isActive && selectionOnlyBorder
            ? token.colorPrimaryBg
            : undefined,
        borderRadius: 12,
      }}
      onClick={onClick}
    >
      {/* 헤더 */}
      {headerContent ?? (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <Text strong style={{ fontSize: 12 }}>
            {typeof title === 'object' ? JSON.stringify(title) : String(title ?? '')}
          </Text>
          {subtitle && (
            <div style={{ marginTop: 2 }}>
              <Text type="secondary" style={{ fontSize: 10 }}>
                {typeof subtitle === 'object' ? JSON.stringify(subtitle) : String(subtitle ?? '')}
              </Text>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {cornerIcon && <div style={{ fontSize: 15 }}>{cornerIcon}</div>}
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {tags.map((tag, idx) => (
                <Tag key={idx} color={tag.color} style={{ fontSize: 10, margin: 0 }}>
                  {typeof tag.label === 'object' ? JSON.stringify(tag.label) : String(tag.label ?? '')}
                </Tag>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* 이미지 영역 */}
      <div
        className="raw-data-svg-frame"
        style={{
          width: '100%',
          height: squareImage ? undefined : imageHeight,
          aspectRatio: squareImage ? '1 / 1' : undefined,
          background: transparentImageBackground ? 'transparent' : token.colorBgContainer,
          border: imageBorderless ? '1px solid transparent' : `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 8,
          marginBottom: 8,
          position: 'relative',
          overflow: 'hidden',
          cursor: imageClickHandler ? 'pointer' : 'default',
        }}
        onClick={(e) => {
          e.stopPropagation();
          imageClickHandler?.();
        }}
      >
        {imageType !== 'svg' && (onPreview || imageOverlayActions) && (
          <div style={{ position: 'absolute', right: 4, top: 4, zIndex: 2, display: 'flex', gap: 2 }}>
            {onPreview && (
              <Tooltip title="미리보기">
                <Button
                  className="svg-action-btn"
                  size="small"
                  type="text"
                  icon={<Search size={size === 'small' ? 12 : 14} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreview();
                  }}
                  style={{ background: 'rgba(255,255,255,0.85)' }}
                />
              </Tooltip>
            )}
            {imageOverlayActions}
          </div>
        )}
        {renderImage()}
      </div>

      {/* 추가 정보 */}
      {extraInfo && <div style={{ marginBottom: 8 }}>{extraInfo}</div>}

      {/* 푸터 텍스트 */}
      {footerText && (
        <Text type="secondary" style={{ fontSize: 10 }} ellipsis={{ tooltip: typeof footerText === 'object' ? JSON.stringify(footerText) : String(footerText ?? '') }}>
          {typeof footerText === 'object' ? JSON.stringify(footerText) : String(footerText ?? '')}
        </Text>
      )}

      {/* 페이지 네비게이션 */}
      {pagination && (
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
          <Button
            size="small"
            type="text"
            icon={<ChevronLeft size={size === 'small' ? 12 : 14} />}
            onClick={(e) => {
              e.stopPropagation();
              pagination.onPrev();
            }}
          />
          <Text style={{ fontSize: size === 'small' ? 10 : 11, alignSelf: 'center', minWidth: 80, textAlign: 'center' }}>
            {pagination.pageLabel
              ? pagination.pageLabel(pagination.currentIndex, pagination.totalCount)
              : `${pagination.currentIndex + 1} / ${pagination.totalCount}`}
          </Text>
          <Button
            size="small"
            type="text"
            style={{ transform: 'scaleX(-1)' }}
            icon={<ChevronLeft size={size === 'small' ? 12 : 14} />}
            onClick={(e) => {
              e.stopPropagation();
              pagination.onNext();
            }}
          />
        </div>
      )}
    </Card>
    {(smiles || molblock) && (
      <ChemDrawModal
        open={chemDrawOpen}
        initialSmiles={smiles}
        initialMolblock={molblock}
        onCancel={() => setChemDrawOpen(false)}
        onConfirm={() => setChemDrawOpen(false)}
        title={`구조 편집 — ${title}`}
      />
    )}
    </>
  );
};

export default DataCardItem;
