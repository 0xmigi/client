import React, { useMemo, useState, useRef } from 'react';
import styled from 'styled-components';
import { DayAggregate } from '../trackers/Tracker';
import {
  Thresholds,
  thresholdsFromValues,
  HEATMAP_COLORS,
} from '../utils/colorScale';
import {
  addDays,
  daysBetween,
  formatYmd,
  monthShort,
  parseYmd,
  startOfWeek,
} from '../utils/date';
import { HeatmapCell } from './HeatmapCell';
import { DayPopover } from './DayPopover';

interface Props<TDetail> {
  days: DayAggregate[];
  detailsByDate: Record<string, TDetail[]>;
  weeks?: number;
  endDate?: string;
  formatValue: (v: number) => string;
  renderDayDetail: (date: string, details: TDetail[] | undefined) => React.ReactNode;
}

const CELL = 11;
const GAP = 3;
const STRIDE = CELL + GAP;
const MONTH_LABEL_HEIGHT = 18;
const WEEKDAY_LABEL_WIDTH = 28;

const Container = styled.div`
  position: relative;
  overflow-x: auto;
  padding: 8px 0 4px 0;
`;

const LegendRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  color: #8b949e;
  font-size: 12px;
  padding: 6px 0 0 0;
`;

const LegendSwatch = styled.span<{ color: string }>`
  width: 10px;
  height: 10px;
  background: ${(p) => p.color};
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  display: inline-block;
`;

export function Heatmap<TDetail>(props: Props<TDetail>): JSX.Element {
  const { days, detailsByDate, weeks = 53, formatValue, renderDayDetail } = props;
  const [selected, setSelected] = useState<{ date: string; rect: DOMRect } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { grid, thresholds, width, height, monthLabels } = useMemo(() => {
    return buildGrid(days, weeks, props.endDate);
  }, [days, weeks, props.endDate]);

  function handleSelect(date: string, rect: DOMRect) {
    setSelected({ date, rect });
  }

  return (
    <Container ref={containerRef}>
      <svg width={width} height={height} role="img">
        {monthLabels.map((m) => (
          <text
            key={`${m.label}-${m.x}`}
            x={m.x}
            y={12}
            fontSize={10}
            fill="#8b949e"
          >
            {m.label}
          </text>
        ))}
        {['Mon', 'Wed', 'Fri'].map((label, i) => {
          const weekday = i * 2 + 1;
          const y = MONTH_LABEL_HEIGHT + weekday * STRIDE + CELL - 1;
          return (
            <text key={label} x={0} y={y} fontSize={10} fill="#8b949e">
              {label}
            </text>
          );
        })}
        {grid.map((cell) => (
          <HeatmapCell
            key={cell.date}
            x={cell.x}
            y={cell.y}
            size={CELL}
            date={cell.date}
            value={cell.value}
            thresholds={thresholds}
            formatValue={formatValue}
            selected={selected?.date === cell.date}
            onSelect={handleSelect}
          />
        ))}
      </svg>

      <LegendRow>
        <span>Less</span>
        {HEATMAP_COLORS.map((c) => (
          <LegendSwatch key={c} color={c} />
        ))}
        <span>More</span>
      </LegendRow>

      {selected && containerRef.current && (
        <DayPopover
          date={selected.date}
          cellRect={selected.rect}
          containerRect={containerRef.current.getBoundingClientRect()}
          onClose={() => setSelected(null)}
        >
          {renderDayDetail(selected.date, detailsByDate[selected.date])}
        </DayPopover>
      )}
    </Container>
  );
}

interface Cell {
  date: string;
  value: number;
  x: number;
  y: number;
}

interface MonthLabel {
  label: string;
  x: number;
}

function buildGrid(
  days: DayAggregate[],
  weeks: number,
  endDateStr: string | undefined
) {
  const valueByDate = new Map(days.map((d) => [d.date, d.value]));

  const end = endDateStr ? parseYmd(endDateStr) : parseYmd(formatYmd(new Date()));
  // Last column = the week containing `end`. Step back (weeks-1) weeks from there.
  const lastWeekStart = startOfWeek(end, 0);
  const firstWeekStart = addDays(lastWeekStart, -(weeks - 1) * 7);
  const gridEnd = addDays(lastWeekStart, 6);

  const allDates = daysBetween(firstWeekStart, gridEnd);

  const grid: Cell[] = [];
  const monthLabels: MonthLabel[] = [];
  let lastMonth = -1;

  for (const ymd of allDates) {
    const d = parseYmd(ymd);
    const weekOffset = Math.floor(
      (d.getTime() - firstWeekStart.getTime()) / (7 * 86_400_000)
    );
    const weekday = d.getUTCDay();
    const x = WEEKDAY_LABEL_WIDTH + weekOffset * STRIDE;
    const y = MONTH_LABEL_HEIGHT + weekday * STRIDE;
    grid.push({ date: ymd, value: valueByDate.get(ymd) ?? 0, x, y });

    // Label a month when its first-of-month cell falls on a Sunday (top row)
    // OR when we transition to a new month at the start of a column.
    const month = d.getUTCMonth();
    if (weekday === 0 && month !== lastMonth) {
      monthLabels.push({ label: monthShort(d), x });
      lastMonth = month;
    }
  }

  const width = WEEKDAY_LABEL_WIDTH + weeks * STRIDE;
  const height = MONTH_LABEL_HEIGHT + 7 * STRIDE;
  const thresholds: Thresholds = thresholdsFromValues(
    allDates.map((d) => valueByDate.get(d) ?? 0)
  );

  return { grid, thresholds, width, height, monthLabels };
}
