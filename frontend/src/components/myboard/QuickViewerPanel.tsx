import React from 'react';
import { Button, Empty, Modal, Select, Typography } from 'antd';
import { Search, X } from 'lucide-react';
import type {
  Compound,
  CompoundQuickViewerAsset,
  CompoundQuickViewerAssetType,
  KinomeProfilePoint,
} from '../../mocks/compounds';
import { KINOME_LAYOUTS } from '../../data/kinomeTree';
import coralBasetreeSvg from '../../assets/kinome/coral_basetree.svg';

const { Text } = Typography;

const QUICK_VIEWER_TYPES: CompoundQuickViewerAssetType[] = ['kp', 'pdb', 'docking', 'md'];
const QUICK_VIEWER_LABELS: Record<CompoundQuickViewerAssetType, string> = {
  kp: 'KP',
  pdb: 'PDB',
  docking: 'Docking',
  md: 'MD',
};

const getPointRadius = (inhibition: number) => Math.max(4, Math.min(13, inhibition / 8));
const getPointOpacity = (inhibition: number) => Math.max(0.28, Math.min(0.95, inhibition / 100));
const ACTIVE_KINOME_POINT_COLOR = '#F87C63';

const KINOME_BASE_SVG_BY_LAYOUT = {
  'coral-basetree': coralBasetreeSvg,
} as const;
const CORAL_BASETREE_WIDTH = 820;
const CORAL_BASETREE_HEIGHT = 914;

type PlottedKinomeProfilePoint = KinomeProfilePoint & {
  x: number;
  y: number;
  labelDx?: number;
  labelDy?: number;
};

const isPlottedKinomeProfilePoint = (
  point: PlottedKinomeProfilePoint | null,
): point is PlottedKinomeProfilePoint => point !== null;

const getAsset = (
  compound: Compound | null,
  activeType: CompoundQuickViewerAssetType | null,
) => {
  const assets = compound?.quickViewerAssets ?? [];
  return assets.find(asset => asset.type === activeType) ?? assets[0] ?? null;
};

const KinomeTreeViewer: React.FC<{ asset: CompoundQuickViewerAsset; compound: Compound }> = ({ asset, compound }) => {
  const [isZoomOpen, setIsZoomOpen] = React.useState(false);
  const points = asset.payload?.points ?? [];
  const layout = KINOME_LAYOUTS[asset.payload?.layout ?? 'coral-basetree'];
  const plottedPoints = points
    .map<PlottedKinomeProfilePoint | null>(point => {
      const mappedNode = layout.nodes[point.gene];
      const x = point.x ?? mappedNode?.x;
      const y = point.y ?? mappedNode?.y;

      if (typeof x !== 'number' || typeof y !== 'number') return null;

      return {
        ...point,
        family: mappedNode?.family ?? point.family,
        x,
        y,
        labelDx: mappedNode?.labelDx,
        labelDy: mappedNode?.labelDy,
      };
    })
    .filter(isPlottedKinomeProfilePoint);
  const topHits = [...points].sort((a, b) => b.inhibition - a.inhibition).slice(0, 5);
  const baseSvg = KINOME_BASE_SVG_BY_LAYOUT[layout.id];
  const renderKinomeSvg = (className: string) => (
    <svg className={className} viewBox={layout.viewBox} role="img" aria-label="Kinome tree profiling">
      <rect
        x={layout.viewBoxRect.x}
        y={layout.viewBoxRect.y}
        width={layout.viewBoxRect.width}
        height={layout.viewBoxRect.height}
        fill="#FFFFFF"
      />
      <image href={baseSvg} x="0" y="0" width={CORAL_BASETREE_WIDTH} height={CORAL_BASETREE_HEIGHT} />
      <g>
        {plottedPoints.map(point => (
          <g key={`${point.gene}-${point.x}-${point.y}`}>
            <title>{`${point.gene} / ${point.family} / ${point.inhibition}% inhibition`}</title>
            <circle
              cx={point.x}
              cy={point.y}
              r={getPointRadius(point.inhibition)}
              fill={ACTIVE_KINOME_POINT_COLOR}
              opacity={getPointOpacity(point.inhibition)}
            />
            {point.inhibition >= 70 ? (
              <text
                x={point.x + (point.labelDx ?? 0)}
                y={point.y + (point.labelDy ?? -getPointRadius(point.inhibition) - 6)}
                fill="#32373D"
                fontSize={17}
                fontWeight="700"
                textAnchor="middle"
              >
                {point.gene}
              </text>
            ) : null}
          </g>
        ))}
      </g>
    </svg>
  );

  return (
    <div className="quick-viewer-kp">
      <div className="quick-viewer-result-row">
        <Select
          size="small"
          value={asset.payload?.title ?? `${compound.compoundId} KP result`}
          options={[{ value: asset.payload?.title ?? `${compound.compoundId} KP result`, label: asset.payload?.title ?? `${compound.compoundId} KP result` }]}
          className="quick-viewer-result-select"
        />
      </div>
      <div className="quick-viewer-kinome-stage">
        {renderKinomeSvg('quick-viewer-kinome-svg')}
        <Button
          className="quick-viewer-zoom-button"
          icon={<Search size={14} />}
          onClick={() => setIsZoomOpen(true)}
          aria-label="KP tree 확대"
        />
      </div>
      <Modal
        title={`${compound.compoundId} KP`}
        open={isZoomOpen}
        footer={null}
        width="min(92vw, 1120px)"
        centered
        className="quick-viewer-kinome-modal"
        onCancel={() => setIsZoomOpen(false)}
      >
        <div className="quick-viewer-kinome-modal-stage">
          {renderKinomeSvg('quick-viewer-kinome-modal-svg')}
        </div>
      </Modal>
      <Button type="primary" block className="quick-viewer-cta">
        분석 페이지 가기
      </Button>
      <div className="quick-viewer-info-table">
        {(asset.payload?.infoRows ?? []).map(row => (
          <div className="quick-viewer-info-row" key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
        {topHits.map(hit => (
          <div className="quick-viewer-info-row" key={hit.gene}>
            <span>{hit.gene}</span>
            <strong>{hit.inhibition}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

const PlaceholderViewer: React.FC<{ asset: CompoundQuickViewerAsset; compound: Compound }> = ({ asset, compound }) => (
  <div className="quick-viewer-placeholder">
    <div className="quick-viewer-result-row">
      <Select
        size="small"
        value={`${compound.compoundId} ${asset.label} result`}
        options={[{ value: `${compound.compoundId} ${asset.label} result`, label: `${compound.compoundId} ${asset.label} result` }]}
        className="quick-viewer-result-select"
      />
    </div>
    <div className="quick-viewer-placeholder-stage">
      {asset.type === 'pdb' ? (
        <svg viewBox="0 0 320 260" className="quick-viewer-pdb-svg" aria-label="PDB preview">
          <rect width="320" height="260" fill="#F8FAFC" />
          <path d="M58 176 C92 84 142 74 168 132 S238 210 276 88" fill="none" stroke="#53B6A8" strokeWidth="12" strokeLinecap="round" />
          <path d="M74 120 C132 176 170 62 236 126" fill="none" stroke="#F87C63" strokeWidth="10" strokeLinecap="round" />
          <path d="M102 198 C144 126 212 216 250 150" fill="none" stroke="#5B7CFA" strokeWidth="8" strokeLinecap="round" />
          <circle cx="156" cy="136" r="14" fill="#FFC857" opacity="0.85" />
          <circle cx="220" cy="152" r="10" fill="#A855F7" opacity="0.7" />
        </svg>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`${asset.label} preview`} />
      )}
    </div>
    <Button type="primary" block className="quick-viewer-cta">
      {asset.type === 'pdb' ? 'VORA 가기' : '결과 페이지 가기'}
    </Button>
    <div className="quick-viewer-info-table">
      <div className="quick-viewer-info-row"><span>Compound</span><strong>{compound.compoundId}</strong></div>
      <div className="quick-viewer-info-row"><span>Result</span><strong>{asset.resultCount ?? 1}</strong></div>
      <div className="quick-viewer-info-row"><span>Status</span><strong>Mock ready</strong></div>
    </div>
  </div>
);

interface QuickViewerPanelProps {
  compound: Compound | null;
  activeType: CompoundQuickViewerAssetType | null;
  onActiveTypeChange: (type: CompoundQuickViewerAssetType) => void;
  onClose: () => void;
}

const QuickViewerPanel: React.FC<QuickViewerPanelProps> = ({
  compound,
  activeType,
  onActiveTypeChange,
  onClose,
}) => {
  const assets = compound?.quickViewerAssets ?? [];
  const activeAsset = getAsset(compound, activeType);
  const open = Boolean(compound && activeAsset);

  return (
    <aside className={`quick-viewer-panel ${open ? 'quick-viewer-panel-open' : ''}`} aria-hidden={!open}>
      <div className="quick-viewer-header">
        <div>
          <Text className="quick-viewer-title">Quick Viewer</Text>
          <Text className="quick-viewer-subtitle">{compound?.compoundId ?? '-'}</Text>
        </div>
        <Button type="text" size="small" icon={<X size={16} />} onClick={onClose} aria-label="Close quick viewer" />
      </div>
      <div className="quick-viewer-tabs">
        {QUICK_VIEWER_TYPES.map(type => {
          const available = assets.some(asset => asset.type === type);
          const selected = activeAsset?.type === type;

          return (
            <button
              key={type}
              type="button"
              className={`quick-viewer-tab ${selected ? 'quick-viewer-tab-active' : ''}`}
              disabled={!available}
              onClick={() => onActiveTypeChange(type)}
            >
              {QUICK_VIEWER_LABELS[type]}
            </button>
          );
        })}
      </div>
      <div className="quick-viewer-body">
        {compound && activeAsset ? (
          activeAsset.type === 'kp'
            ? <KinomeTreeViewer asset={activeAsset} compound={compound} />
            : <PlaceholderViewer asset={activeAsset} compound={compound} />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No viewer data" />
        )}
      </div>
    </aside>
  );
};

export default QuickViewerPanel;
