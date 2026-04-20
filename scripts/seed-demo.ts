/**
 * Generate a realistic demo running dataset: ~6 months of workouts with
 * weekly rhythm (rest days, one long run, mid-week easy runs) and some
 * variance. Writes straight into the incremental-JSON schema so
 * `yarn ingest --json <out>` produces a live-looking dashboard.
 *
 * Usage:
 *   yarn seed-demo              # writes to /tmp/life-heatmap-demo.json and ingests it
 *   yarn seed-demo --print      # just print the JSON to stdout
 */

import { promises as fs } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join('/tmp', 'life-heatmap-demo.json');

interface DemoWorkout {
  startDate: string;
  durationSec: number;
  distanceKm: number;
  activityType: string;
  source: string;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function isoLocal(date: Date, hour: number, minute: number): string {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  // fake a -07:00 offset so dates land on the run day
  return `${y}-${m}-${d}T${pad(hour)}:${pad(minute)}:00-07:00`;
}

function generate(days: number): DemoWorkout[] {
  const out: DemoWorkout[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dow = date.getDay(); // 0 = Sun

    // 2 rest days most weeks (Mon + Fri), occasional extra rest.
    if (dow === 1 || dow === 5) {
      if (Math.random() < 0.75) continue;
    }
    if (Math.random() < 0.10) continue;

    const isLongRun = dow === 0 || dow === 6; // weekend long run
    let distanceKm: number;
    let paceSecPerKm: number;

    if (isLongRun) {
      distanceKm = rand(8, 18);
      paceSecPerKm = rand(310, 360); // 5:10-6:00/km
    } else {
      distanceKm = rand(4, 8);
      paceSecPerKm = rand(280, 340); // 4:40-5:40/km
    }

    // Inject a few easy/recovery short runs.
    if (Math.random() < 0.15) {
      distanceKm = rand(3, 5);
      paceSecPerKm = rand(330, 390);
    }

    const durationSec = Math.round(distanceKm * paceSecPerKm);
    const hour = isLongRun ? Math.floor(rand(6, 9)) : Math.floor(rand(6, 8));
    const minute = Math.floor(rand(0, 60));

    out.push({
      startDate: isoLocal(date, hour, minute),
      durationSec,
      distanceKm: Number(distanceKm.toFixed(2)),
      activityType: 'Running',
      source: 'Demo Data',
    });
  }
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  const days = 220;
  const workouts = generate(days);
  const payload = { workouts };

  if (argv.includes('--print')) {
    process.stdout.write(JSON.stringify(payload, null, 2));
    return;
  }

  await fs.writeFile(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`wrote ${workouts.length} demo workouts -> ${OUT_PATH}`);

  const res = spawnSync(
    'yarn',
    ['ingest', '--json', OUT_PATH],
    { cwd: REPO_ROOT, stdio: 'inherit' }
  );
  process.exit(res.status ?? 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
