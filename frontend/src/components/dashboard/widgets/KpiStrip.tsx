import React from 'react';
import { Select, Typography } from 'antd';
import { formatNumberWithComma } from '../../../utils/displayFormat';
import '../dashboard.css';

const { Text } = Typography;

export type KpiTone = 'neutral' | 'warn' | 'danger';

export type KpiTile = {
  key: string;
  label: string;
  value: number;
  tone: KpiTone;
  /** 목록으로 넘어가는 딥링크. 마감 타일은 대신 onFocusBucket을 쓴다. */
  to?: string;
  /** 기한 보드의 해당 버킷으로 이동. 목록 API에 마감일 필터가 없어 딥링크를 못 만든다. */
  focusBucket?: string;
};

type Props = {
  tiles: KpiTile[];
  loading?: boolean;
  error?: string | null;
  onNavigate: (to: string) => void;
  onFocusBucket: (bucket: string) => void;
};

const toneClass: Record<KpiTone, string> = {
  neutral: '',
  warn: 'db-kpi-value-warn',
  danger: 'db-kpi-value-danger',
};


/**
 * 상단 KPI 타일. 숫자를 전시하는 게 아니라 **진입점**이다.
 *
 * 눌러서 갈 곳이 있는 타일만 커서와 hover가 붙는다. 죽은 숫자와 링크가 같아 보이면
 * 사용자가 전부 눌러 보고 아무 일도 안 일어나는 경험을 하게 된다.
 */
const KpiStrip: React.FC<Props> = ({ tiles, loading, error, onNavigate, onFocusBucket }) => {
  if (error) {
    return (
      <div className="db-panel-scroll">
        <Text type="danger" className="db-status">집계를 불러오지 못했습니다.</Text>
      </div>
    );
  }

  return (
    <div className="db-panel-scroll">
      <div className="db-kpi-grid">
        {tiles.map((tile) => {
          const clickable = Boolean(tile.to || tile.focusBucket);
          const handleClick = () => {
            if (tile.to) onNavigate(tile.to);
            else if (tile.focusBucket) onFocusBucket(tile.focusBucket);
          };

          return (
            <button
              key={tile.key}
              type="button"
              className={`db-kpi-tile${clickable ? ' db-kpi-tile-link' : ''}`}
              onClick={clickable ? handleClick : undefined}
              disabled={!clickable}
            >
              <span className="db-kpi-label">{tile.label}</span>
              {/* 0건은 경고색을 입히지 않는다. '지연 마감 0'은 나쁜 소식이 아니라 좋은
                  소식인데, 빨간 0은 문제가 있는 것처럼 읽힌다. */}
              <span
                className={`db-kpi-value ${tile.value > 0 ? toneClass[tile.tone] : ''}`.trim()}
              >
                {loading ? '–' : formatNumberWithComma(tile.value)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default KpiStrip;
