import React from 'react';
import {
  Alert,
  Button,
  Empty,
  Skeleton,
  Tooltip,
  Typography,
} from 'antd';
import { Download, ExternalLink, RotateCcw, X } from 'lucide-react';
import type { Patent } from '../../mocks/patents';
import type { PatentDetailResponse } from '../../services/patentAnalysisApi';
import { formatDisplayDate } from '../../utils/displayFormat';
import {
  mapPatentQuickViewData,
  type PatentQuickViewData,
} from '../../utils/patentQuickView';
import CompoundStructureView from '../common/CompoundStructureView';
import './PatentQuickViewerPanel.css';

const { Paragraph, Text, Title } = Typography;

type PatentQuickViewerPanelProps = {
  patent: Patent | null;
  detail: PatentDetailResponse | null;
  loading: boolean;
  error: string | null;
  canDownloadPdf: boolean;
  downloadingPdf: boolean;
  fullscreen: boolean;
  onRetry: () => void;
  onClose: () => void;
  onOpenAnalysis: () => void;
  onDownloadPdf: () => void;
};

const DetailRow: React.FC<{
  label: string;
  value: string;
}> = ({ label, value }) => (
  <div className="patent-quick-viewer-detail-row">
    <Text type="secondary" className="patent-quick-viewer-detail-label">
      {label}
    </Text>
    <Text className="patent-quick-viewer-detail-value">
      {value || '-'}
    </Text>
  </div>
);

const PatentStructureSection: React.FC<{
  label: string;
  svg: string;
  publicationNumber: string;
}> = ({ label, svg, publicationNumber }) => (
  <section className="patent-quick-viewer-section">
    <Title level={5}>{label}</Title>
    {svg ? (
      <div className="patent-quick-viewer-structure">
        <CompoundStructureView
          svg={svg}
          title={`${publicationNumber} ${label}`}
          width="100%"
          height={240}
          fullWidth
          transparentBackground
          frameless
          structureFitMode="contain"
          actionPlacement="overlay"
          actionOverlayAnchor="container"
          actionOverlayPlacement="bottom-right"
          showPreviewAction
          showCopyAction={false}
          showCopyImageAction
          showChemDrawAction={false}
        />
      </div>
    ) : (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`${label} 정보 없음`} />
    )}
  </section>
);

const PatentQuickViewerBody: React.FC<{
  data: PatentQuickViewData;
}> = ({ data }) => (
  <>
    <section className="patent-quick-viewer-summary" aria-label="Patent summary">
      <DetailRow label="Publication Number" value={data.publicationNumber} />
      <DetailRow label="Publication Date" value={formatDisplayDate(data.publicationDate)} />
      <DetailRow label="Filing Date" value={formatDisplayDate(data.filingDate)} />
      <DetailRow label="Targets" value={data.targets} />
      <DetailRow label="Applicants" value={data.applicants} />
    </section>

    <section className="patent-quick-viewer-section">
      <Title level={5}>Title</Title>
      <Paragraph>{data.title || '-'}</Paragraph>
    </section>

    <section className="patent-quick-viewer-section">
      <Title level={5}>Abstract</Title>
      {data.abstract ? (
        <Paragraph className="patent-quick-viewer-abstract">{data.abstract}</Paragraph>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Abstract 정보 없음" />
      )}
    </section>

    <PatentStructureSection
      label="Scaffold"
      svg={data.scaffoldSvg}
      publicationNumber={data.publicationNumber}
    />

    <PatentStructureSection
      label="Genus Markush"
      svg={data.genusMarkushSvg}
      publicationNumber={data.publicationNumber}
    />

  </>
);

const PatentQuickViewerPanel: React.FC<PatentQuickViewerPanelProps> = ({
  patent,
  detail,
  loading,
  error,
  canDownloadPdf,
  downloadingPdf,
  fullscreen,
  onRetry,
  onClose,
  onOpenAnalysis,
  onDownloadPdf,
}) => {
  const closeButtonWrapRef = React.useRef<HTMLSpanElement>(null);
  const data = React.useMemo(
    () => (patent ? mapPatentQuickViewData(patent, detail) : null),
    [detail, patent],
  );

  React.useEffect(() => {
    if (fullscreen && patent) {
      closeButtonWrapRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }
  }, [fullscreen, patent?.patentNumber]);

  return (
    <aside
      className="patent-quick-viewer-panel"
      aria-label="Patent Quick Viewer"
      aria-hidden={!patent}
    >
      <header className="patent-quick-viewer-header">
        <div className="patent-quick-viewer-heading">
          <Text className="patent-quick-viewer-title">Patent Info</Text>
          <Text type="secondary" className="patent-quick-viewer-subtitle">
            {data?.publicationNumber || '-'}
          </Text>
        </div>
        <span ref={closeButtonWrapRef} className="patent-quick-viewer-close-wrap">
          <Button
            type="text"
            size="small"
            icon={<X size={17} />}
            onClick={onClose}
            aria-label="Patent Quick Viewer 닫기"
          />
        </span>
      </header>

      <div className="patent-quick-viewer-body">
        {error ? (
          <Alert
            type="warning"
            showIcon
            message="특허 상세 정보를 불러오지 못했습니다."
            description={error}
            action={(
              <Button
                size="small"
                icon={<RotateCcw size={14} />}
                onClick={onRetry}
              >
                재시도
              </Button>
            )}
          />
        ) : null}

        {loading ? (
          <div
            className="patent-quick-viewer-loading"
            aria-live="polite"
            aria-label="특허 상세 정보를 불러오는 중"
          >
            <Skeleton active paragraph={{ rows: 7 }} />
            <Skeleton.Node active className="patent-quick-viewer-structure-skeleton" />
          </div>
        ) : data ? (
          <PatentQuickViewerBody data={data} />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="선택된 특허가 없습니다." />
        )}
      </div>

      <footer className="patent-quick-viewer-footer">
        <Button
          type="primary"
          icon={<ExternalLink size={16} />}
          disabled={!patent}
          onClick={onOpenAnalysis}
        >
          분석 페이지로 이동
        </Button>
        <Tooltip title={canDownloadPdf ? undefined : '다운로드 가능한 OCR PDF가 없습니다.'}>
          <span className="patent-quick-viewer-download-wrap">
            <Button
              icon={<Download size={16} />}
              disabled={!patent || !canDownloadPdf}
              loading={downloadingPdf}
              onClick={onDownloadPdf}
            >
              OCR PDF 다운로드
            </Button>
          </span>
        </Tooltip>
      </footer>
    </aside>
  );
};

export default PatentQuickViewerPanel;
