export const MS_PER_DAY = 86_400_000;

export function parseYmd(ymd: string): Date {
  return new Date(ymd + 'T00:00:00Z');
}

export function formatYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// JS Sunday=0, Monday=1, ... Saturday=6 — matches GitHub's heatmap layout.
export function weekdayIndex(date: Date): number {
  return date.getUTCDay();
}

// Start of the week containing `date`, where weekStart=0 means Sunday.
export function startOfWeek(date: Date, weekStart = 0): Date {
  const d = new Date(date);
  const diff = (d.getUTCDay() - weekStart + 7) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

// Inclusive range of dates from `start` to `end` (both YYYY-MM-DD UTC-normalized).
export function daysBetween(start: Date, end: Date): string[] {
  const out: string[] = [];
  for (let d = new Date(start); d.getTime() <= end.getTime(); d = addDays(d, 1)) {
    out.push(formatYmd(d));
  }
  return out;
}

export function monthShort(date: Date): string {
  return date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
}
