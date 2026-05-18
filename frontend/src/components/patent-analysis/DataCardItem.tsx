import React, { useState } from 'react';
import { App, Button, Card, Tag, Tooltip, Typography, theme } from 'antd';
import { Search, ChevronLeft, Copy } from 'lucide-react';
import ChemDrawModal from '../common/ChemDrawModal';
import BenzeneIcon from '../common/BenzeneIcon';

const { Text } = Typography;

/**
 * 데이터 카드 아이템의 Props 인터페이스
 * Raw Data, Summary, Tables 탭에서 공통으로 사용
 */
export interface DataCardItemProps {
  // ===== 헤더 영역 =====
  /** 헤더 왼쪽에 표시할 주요 텍스트 */
  title: string;
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
  /** 이미지 클릭 시 콜백 */
  onImageClick?: () => void;
  /** 이미지 미리보기 버튼 클릭 콜백 */
  onPreview?: () => void;
  /** SMILES 문자열 (값이 있으면 copy 버튼 표시) */
  smiles?: string;
  /** Molblock 문자열 (ChemDraw 로드용) */
  molblock?: string;

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
  subtitle,
  tags = [],
  cornerIcon,
  imageUrl,
  imageType = 'svg',
  imageHeight = 130,
  onImageClick,
  onPreview,
  smiles,
  molblock,
  extraInfo,
  footerText,
  pagination,
  isActive = false,
  onClick,
  size = 'small',
  hoverable = true,
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [chemDrawOpen, setChemDrawOpen] = useState(false);
  const imageClickHandler = onImageClick ?? onClick;

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
            fontSize: 12,
          }}
        >
          이미지 없음
        </div>
      );
    }

    switch (imageType) {
      case 'svg':
        return (
          <div
            className="svg-renderer-frame"
            style={{
              height: imageHeight,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
            dangerouslySetInnerHTML={{ __html: imageUrl }}
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
              height: imageHeight,
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
      style={{
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        border: isActive ? `2px solid ${token.colorPrimary}` : undefined,
        borderRadius: 12,
      }}
      onClick={onClick}
    >
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <Text strong style={{ fontSize: 13 }}>
            {typeof title === 'object' ? JSON.stringify(title) : String(title ?? '')}
          </Text>
          {subtitle && (
            <div style={{ marginTop: 2 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {typeof subtitle === 'object' ? JSON.stringify(subtitle) : String(subtitle ?? '')}
              </Text>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {cornerIcon && <div style={{ fontSize: 16 }}>{cornerIcon}</div>}
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {tags.map((tag, idx) => (
                <Tag key={idx} color={tag.color} style={{ fontSize: 11, margin: 0 }}>
                  {typeof tag.label === 'object' ? JSON.stringify(tag.label) : String(tag.label ?? '')}
                </Tag>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 이미지 영역 */}
      <div
        className="raw-data-svg-frame"
        style={{
          width: '100%',
          height: imageHeight,
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
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
        {/* 미리보기 & 복사 & ChemDraw 버튼 */}
        {(onPreview || smiles || molblock) && (
          <div style={{ position: 'absolute', right: 4, top: 4, zIndex: 2, display: 'flex', gap: 2 }}>
            {(smiles || molblock) && (
              <Tooltip title="ChemDraw">
                <Button
                  className="svg-action-btn"
                  size="small"
                  type="text"
                  icon={<BenzeneIcon size={size === 'small' ? 12 : 14} />}
                  onClick={(e) => { e.stopPropagation(); setChemDrawOpen(true); }}
                  style={{ background: 'rgba(255,255,255,0.85)' }}
                />
              </Tooltip>
            )}
            {smiles && (
              <Tooltip title={`SMILES: ${smiles}`}>
                <Button
                  className="svg-action-btn"
                  size="small"
                  type="text"
                  icon={<Copy size={size === 'small' ? 12 : 14} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(smiles)
                      .then(() => message.success('SMILES 복사 완료'))
                      .catch(() => message.error('복사 실패'));
                  }}
                  style={{ background: 'rgba(255,255,255,0.85)' }}
                />
              </Tooltip>
            )}
            {onPreview && (
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
            )}
          </div>
        )}

        {renderImage()}
      </div>

      {/* 추가 정보 */}
      {extraInfo && <div style={{ marginBottom: 8 }}>{extraInfo}</div>}

      {/* 푸터 텍스트 */}
      {footerText && (
        <Text type="secondary" style={{ fontSize: 11 }} ellipsis={{ tooltip: typeof footerText === 'object' ? JSON.stringify(footerText) : String(footerText ?? '') }}>
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
          <Text style={{ fontSize: size === 'small' ? 11 : 12, alignSelf: 'center', minWidth: 80, textAlign: 'center' }}>
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
