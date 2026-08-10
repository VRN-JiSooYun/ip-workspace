import React from 'react';
import { useBrandPrimary } from '../../theme/brandColor';

interface RadarChartProps {
  data: number[];
  size?: number;
  color?: string;
  max?: number;
}

const RadarChart: React.FC<RadarChartProps> = ({
  data,
  size = 60,
  color,
  max = 100
}) => {
  // Feeds the SVG `fill`/`stroke` attributes, which do not resolve var().
  const brandPrimary = useBrandPrimary();
  const strokeColor = color ?? brandPrimary;
  const center = size / 2;
  const radius = (size / 2) * 0.8;
  const totalPoints = data.length;
  const angleStep = (Math.PI * 2) / totalPoints;

  // Calculate points for the polygon
  const points = data.map((value, i) => {
    const r = (value / max) * radius;
    const angle = i * angleStep - Math.PI / 2;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return `${x},${y}`;
  }).join(' ');

  // Calculate background hexagon/polygon axes
  const axes = Array.from({ length: totalPoints }).map((_, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const x2 = center + radius * Math.cos(angle);
    const y2 = center + radius * Math.sin(angle);
    return { x1: center, y1: center, x2, y2 };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background circles/polygons */}
      <circle cx={center} cy={center} r={radius} fill="none" stroke="#f0f0f0" strokeWidth="1" />
      <circle cx={center} cy={center} r={radius / 2} fill="none" stroke="#f0f0f0" strokeWidth="1" />
      
      {/* Axes */}
      {axes.map((axis, i) => (
        <line key={i} {...axis} stroke="#f0f0f0" strokeWidth="1" />
      ))}

      {/* Data Polygon */}
      <polygon
        points={points}
        fill={strokeColor}
        fillOpacity="0.4"
        stroke={strokeColor}
        strokeWidth="1.5"
      />
    </svg>
  );
};

export default RadarChart;
