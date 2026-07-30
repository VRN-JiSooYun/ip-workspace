import React from 'react';
import { Button, Space, Tooltip, Typography, theme } from 'antd';
import { getScaffoldRankColor } from './ScaffoldRankBadge';

const { Text } = Typography;

type Props = {
  ranks: number[];
  value: 'all' | number;
  onChange: (value: 'all' | number) => void;
};

const PatentScaffoldFilterControls: React.FC<Props> = ({
  ranks,
  value,
  onChange,
}) => {
  const { token } = theme.useToken();

  return (
    <Space size={4} className="patent-scaffold-filter-controls" aria-label="Scaffold rank filter">
      <Text strong className="patent-scaffold-filter-label">Scaffold</Text>
      <Button
        size="small"
        type={value === 'all' ? 'primary' : 'default'}
        className="patent-scaffold-all-button"
        aria-pressed={value === 'all'}
        onClick={() => onChange('all')}
      >
        All
      </Button>
      {ranks.map((rank) => {
        const isColored = value === 'all' || value === rank;
        return (
          <Tooltip key={rank} title={`Scaffold rank ${rank}`}>
            <button
              type="button"
              className={`patent-scaffold-rank-button${value === rank ? ' is-selected' : ''}`}
              aria-label={`Scaffold rank ${rank}`}
              aria-pressed={value === rank}
              onClick={() => onChange(rank)}
              style={{
                background: isColored ? getScaffoldRankColor(rank) : token.colorFillSecondary,
                color: isColored ? '#FFFFFF' : token.colorTextSecondary,
              }}
            >
              {rank}
            </button>
          </Tooltip>
        );
      })}
    </Space>
  );
};

export default PatentScaffoldFilterControls;
