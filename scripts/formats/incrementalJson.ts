import { promises as fs } from 'fs';
import { RunWorkout, toRunWorkout } from '../trackers/running';

interface IncrementalRunningFile {
  workouts: Array<{
    startDate: string;
    durationSec: number;
    distanceKm: number;
    activityType?: string;
    source?: string;
  }>;
}

export async function parseIncrementalJson(path: string): Promise<RunWorkout[]> {
  const text = await fs.readFile(path, 'utf8');
  const parsed = JSON.parse(text) as IncrementalRunningFile;
  if (!parsed || !Array.isArray(parsed.workouts)) {
    throw new Error(`${path}: expected { workouts: [...] }`);
  }
  return parsed.workouts
    .filter((w) => {
      const t = (w.activityType || 'Running').toLowerCase();
      return t === 'running' || t.includes('run');
    })
    .map(toRunWorkout);
}
