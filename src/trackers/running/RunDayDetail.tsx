import React from 'react';
import styled from 'styled-components';

export interface RunWorkoutDetail {
  id: string;
  startDate: string;
  durationSec: number;
  distanceKm: number;
  activityType: string;
  source: string;
}

interface Props {
  date: string;
  details: RunWorkoutDetail[] | undefined;
}

const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Row = styled.li`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 12px;
  padding: 8px 10px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
`;

const Primary = styled.div`
  font-weight: 600;
  color: #c9d1d9;
`;

const Secondary = styled.div`
  font-size: 12px;
  color: #8b949e;
`;

const Empty = styled.div`
  color: #8b949e;
  font-size: 13px;
`;

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(sec: number): string {
  const mins = Math.round(sec / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatPace(sec: number, km: number): string {
  if (km <= 0) return '—';
  const paceSec = sec / km;
  const mins = Math.floor(paceSec / 60);
  const secs = Math.round(paceSec % 60);
  return `${mins}:${secs.toString().padStart(2, '0')} /km`;
}

export function RunDayDetail({ details }: Props): JSX.Element {
  if (!details || details.length === 0) {
    return <Empty>No runs this day.</Empty>;
  }
  return (
    <List>
      {details.map((w) => (
        <Row key={w.id}>
          <div>
            <Primary>{w.distanceKm.toFixed(2)} km</Primary>
            <Secondary>
              {formatTime(w.startDate)} · {formatDuration(w.durationSec)} ·{' '}
              {formatPace(w.durationSec, w.distanceKm)}
            </Secondary>
          </div>
          <Secondary>{w.source}</Secondary>
        </Row>
      ))}
    </List>
  );
}
