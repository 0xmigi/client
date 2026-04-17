import React, { useMemo } from 'react';
import styled from 'styled-components';
import { DayAggregate } from '../trackers/Tracker';
import { bestDay, computeStreaks, totalValue } from '../utils/streaks';

interface Props {
  days: DayAggregate[];
  unit: string;
  formatValue: (v: number) => string;
}

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
`;

const Stat = styled.div`
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 10px 12px;
`;

const StatLabel = styled.div`
  color: #8b949e;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const StatValue = styled.div`
  color: #c9d1d9;
  font-size: 18px;
  font-weight: 600;
  margin-top: 4px;
`;

const StatSub = styled.div`
  color: #6e7681;
  font-size: 11px;
  margin-top: 2px;
`;

export function StatsPanel({ days, formatValue }: Props): JSX.Element {
  const stats = useMemo(() => {
    const last365 = days.slice(-365);
    const { current, longest } = computeStreaks(days);
    const totalAllTime = totalValue(days);
    const totalRecent = totalValue(last365);
    const best = bestDay(days);
    const activeDays = days.filter((d) => d.value > 0).length;
    return { current, longest, totalAllTime, totalRecent, best, activeDays };
  }, [days]);

  return (
    <Grid>
      <Stat>
        <StatLabel>Total (last 365d)</StatLabel>
        <StatValue>{formatValue(stats.totalRecent)}</StatValue>
        <StatSub>All-time: {formatValue(stats.totalAllTime)}</StatSub>
      </Stat>
      <Stat>
        <StatLabel>Current streak</StatLabel>
        <StatValue>{stats.current} d</StatValue>
        <StatSub>Longest: {stats.longest} d</StatSub>
      </Stat>
      <Stat>
        <StatLabel>Best day</StatLabel>
        <StatValue>{stats.best ? formatValue(stats.best.value) : '—'}</StatValue>
        <StatSub>{stats.best ? stats.best.date : ' '}</StatSub>
      </Stat>
      <Stat>
        <StatLabel>Active days</StatLabel>
        <StatValue>{stats.activeDays}</StatValue>
        <StatSub>of {days.length} logged</StatSub>
      </Stat>
    </Grid>
  );
}
