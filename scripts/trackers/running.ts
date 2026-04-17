import { createHash } from 'crypto';

export interface RunWorkout {
  id: string;
  startDate: string;
  durationSec: number;
  distanceKm: number;
  activityType: string;
  source: string;
}

export interface RawRunWorkout {
  startDate: string;
  durationSec: number;
  distanceKm: number;
  activityType?: string;
  source?: string;
}

export function toRunWorkout(raw: RawRunWorkout): RunWorkout {
  const activityType = raw.activityType || 'Running';
  const source = raw.source || 'unknown';
  const key = `${raw.startDate}|${raw.durationSec}|${raw.distanceKm.toFixed(3)}`;
  const id = createHash('sha1').update(key).digest('hex').slice(0, 16);
  return {
    id,
    startDate: raw.startDate,
    durationSec: Math.round(raw.durationSec),
    distanceKm: raw.distanceKm,
    activityType,
    source,
  };
}

export function localDate(iso: string): string {
  // Use the offset embedded in the ISO string so "early morning" runs land on
  // the day the user ran them, not UTC. Falls back to UTC if no offset.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`bad date: ${iso}`);
  const m = iso.match(/([+-]\d{2}):?(\d{2})$/);
  let offsetMinutes = 0;
  if (m) {
    offsetMinutes = parseInt(m[1], 10) * 60 + (m[1].startsWith('-') ? -1 : 1) * parseInt(m[2], 10);
  } else if (!/Z$/.test(iso)) {
    offsetMinutes = -d.getTimezoneOffset();
  }
  const shifted = new Date(d.getTime() + offsetMinutes * 60_000);
  return shifted.toISOString().slice(0, 10);
}
