import React from 'react';

const RANK_COLORS = [
  '#F87C63',
  '#F5A623',
  '#5B8FF9',
  '#61B15A',
  '#8B5CF6',
  '#D65DB1',
  '#3AAFA9',
  '#7C8798',
];

export const normalizeScaffoldRank = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
  }

  const matched = String(value ?? '').match(/\d+/);
  if (!matched) return null;
  const rank = Number(matched[0]);
  return Number.isFinite(rank) && rank > 0 ? rank : null;
};

export const getScaffoldRankColor = (rank: number) => (
  RANK_COLORS[(Math.max(1, rank) - 1) % RANK_COLORS.length]
);

type ScaffoldRankBadgeProps = {
  rank: unknown;
  size?: 'small' | 'default';
};

const ScaffoldRankBadge: React.FC<ScaffoldRankBadgeProps> = ({
  rank: rawRank,
  size = 'default',
}) => {
  const rank = normalizeScaffoldRank(rawRank);
  if (rank === null) return <span aria-label="Scaffold rank 없음">-</span>;

  const diameter = size === 'small' ? 18 : 22;

  return (
    <span
      aria-label={`Scaffold rank ${rank}`}
      title={`Scaffold rank ${rank}`}
      style={{
        width: diameter,
        height: diameter,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: `0 0 ${diameter}px`,
        background: getScaffoldRankColor(rank),
        color: '#FFFFFF',
        fontSize: size === 'small' ? 10 : 11,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {rank}
    </span>
  );
};

export default ScaffoldRankBadge;
