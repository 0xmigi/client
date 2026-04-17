import React from 'react';
import { Tracker, TrackerData } from '../Tracker';
import { RunDayDetail, RunWorkoutDetail } from './RunDayDetail';

async function loadRunning(): Promise<TrackerData<RunWorkoutDetail>> {
  const res = await fetch('/data/running/daily.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`failed to load running data: ${res.status}`);
  return (await res.json()) as TrackerData<RunWorkoutDetail>;
}

function formatKm(value: number): string {
  if (value <= 0) return '0 km';
  if (value < 10) return `${value.toFixed(2)} km`;
  return `${value.toFixed(1)} km`;
}

export const runningTracker: Tracker<RunWorkoutDetail> = {
  id: 'running',
  label: 'Running',
  unit: 'km',
  description: 'Apple Health running workouts',
  formatValue: formatKm,
  loadData: loadRunning,
  renderDayDetail: (date, details) =>
    React.createElement(RunDayDetail, { date, details }),
};
