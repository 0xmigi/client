import React from 'react';
import { colorForValue, Thresholds } from '../utils/colorScale';

interface Props {
  x: number;
  y: number;
  size: number;
  date: string;
  value: number;
  thresholds: Thresholds;
  formatValue: (v: number) => string;
  selected: boolean;
  onSelect: (date: string, rect: DOMRect) => void;
}

export function HeatmapCell(props: Props): JSX.Element {
  const { x, y, size, date, value, thresholds, formatValue, selected, onSelect } = props;
  const fill = colorForValue(value, thresholds);

  function handleClick(e: React.MouseEvent<SVGRectElement>) {
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    onSelect(date, rect);
  }

  return (
    <rect
      x={x}
      y={y}
      width={size}
      height={size}
      rx={2}
      ry={2}
      fill={fill}
      stroke={selected ? '#f0f6fc' : 'rgba(255,255,255,0.06)'}
      strokeWidth={selected ? 1.5 : 0.5}
      style={{ cursor: 'pointer' }}
      onClick={handleClick}
    >
      <title>{`${date} — ${formatValue(value)}`}</title>
    </rect>
  );
}
