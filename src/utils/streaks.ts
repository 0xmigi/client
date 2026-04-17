import { DayAggregate } from '../trackers/Tracker';

export interface StreakInfo {
  current: number;
  longest: number;
  longestRange: [string, string] | null;
}

export function computeStreaks(days: DayAggregate[]): StreakInfo {
  if (days.length === 0) return { current: 0, longest: 0, longestRange: null };
  let longest = 0;
  let longestRange: [string, string] | null = null;
  let run = 0;
  let runStart: string | null = null;
  for (const d of days) {
    if (d.value > 0) {
      if (run === 0) runStart = d.date;
      run += 1;
      if (run > longest) {
        longest = run;
        longestRange = [runStart!, d.date];
      }
    } else {
      run = 0;
      runStart = null;
    }
  }
  // Current streak = consecutive active days counting backward from the last day.
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].value > 0) current += 1;
    else break;
  }
  return { current, longest, longestRange };
}

export function totalValue(days: DayAggregate[]): number {
  return days.reduce((sum, d) => sum + d.value, 0);
}

export function bestDay(days: DayAggregate[]): DayAggregate | null {
  let best: DayAggregate | null = null;
  for (const d of days) {
    if (!best || d.value > best.value) best = d;
  }
  return best && best.value > 0 ? best : null;
}
