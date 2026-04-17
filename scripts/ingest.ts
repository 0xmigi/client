import { promises as fs } from 'fs';
import path from 'path';
import { parseAppleHealthXml } from './formats/appleHealthXml';
import { parseIncrementalJson } from './formats/incrementalJson';
import { localDate, RunWorkout } from './trackers/running';

const REPO_ROOT = path.resolve(__dirname, '..');
const WORKOUTS_PATH = path.join(REPO_ROOT, 'data', 'running', 'workouts.jsonl');
const DAILY_PATH = path.join(REPO_ROOT, 'data', 'running', 'daily.json');

interface Args {
  xml?: string;
  json?: string;
  dir?: string;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--xml') out.xml = argv[++i];
    else if (a === '--json') out.json = argv[++i];
    else if (a === '--dir') out.dir = argv[++i];
    else if (a === '-h' || a === '--help') {
      printHelp();
      process.exit(0);
    } else {
      console.error(`unknown arg: ${a}`);
      printHelp();
      process.exit(1);
    }
  }
  return out;
}

function printHelp() {
  console.log(`Usage:
  yarn ingest --xml <export.xml>
  yarn ingest --json <file.json>
  yarn ingest --dir <directory-of-jsons>
`);
}

async function readExistingWorkouts(): Promise<RunWorkout[]> {
  try {
    const text = await fs.readFile(WORKOUTS_PATH, 'utf8');
    return text
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as RunWorkout);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function collectInputs(args: Args): Promise<RunWorkout[]> {
  const results: RunWorkout[] = [];
  if (args.xml) results.push(...(await parseAppleHealthXml(args.xml)));
  if (args.json) results.push(...(await parseIncrementalJson(args.json)));
  if (args.dir) {
    const entries = await fs.readdir(args.dir);
    for (const name of entries) {
      if (!name.toLowerCase().endsWith('.json')) continue;
      results.push(...(await parseIncrementalJson(path.join(args.dir, name))));
    }
  }
  return results;
}

interface DailyFile {
  days: Array<{ date: string; value: number }>;
  detailsByDate: Record<string, Array<Omit<RunWorkout, 'id'> & { id: string }>>;
}

function buildDaily(workouts: RunWorkout[]): DailyFile {
  const byDate = new Map<string, RunWorkout[]>();
  for (const w of workouts) {
    const d = localDate(w.startDate);
    const arr = byDate.get(d) || [];
    arr.push(w);
    byDate.set(d, arr);
  }
  const sortedDates = [...byDate.keys()].sort();
  if (sortedDates.length === 0) {
    return { days: [], detailsByDate: {} };
  }
  const days: Array<{ date: string; value: number }> = [];
  const start = new Date(sortedDates[0] + 'T00:00:00Z');
  const end = new Date(sortedDates[sortedDates.length - 1] + 'T00:00:00Z');
  for (
    let cursor = new Date(start);
    cursor.getTime() <= end.getTime();
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const date = cursor.toISOString().slice(0, 10);
    const runs = byDate.get(date) || [];
    const value = runs.reduce((sum, r) => sum + r.distanceKm, 0);
    days.push({ date, value: roundTo(value, 3) });
  }
  const detailsByDate: DailyFile['detailsByDate'] = {};
  for (const [date, runs] of byDate.entries()) {
    detailsByDate[date] = runs
      .slice()
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }
  return { days, detailsByDate };
}

function roundTo(value: number, places: number): number {
  const f = Math.pow(10, places);
  return Math.round(value * f) / f;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.xml && !args.json && !args.dir) {
    printHelp();
    process.exit(1);
  }

  const existing = await readExistingWorkouts();
  const existingIds = new Set(existing.map((w) => w.id));

  const incoming = await collectInputs(args);
  const fresh: RunWorkout[] = [];
  const seenThisRun = new Set<string>();
  for (const w of incoming) {
    if (existingIds.has(w.id) || seenThisRun.has(w.id)) continue;
    seenThisRun.add(w.id);
    fresh.push(w);
  }

  const merged = [...existing, ...fresh].sort((a, b) =>
    a.startDate.localeCompare(b.startDate)
  );

  await fs.mkdir(path.dirname(WORKOUTS_PATH), { recursive: true });
  const jsonl = merged.map((w) => JSON.stringify(w)).join('\n') + (merged.length ? '\n' : '');
  await fs.writeFile(WORKOUTS_PATH, jsonl, 'utf8');

  const daily = buildDaily(merged);
  await fs.writeFile(DAILY_PATH, JSON.stringify(daily, null, 2) + '\n', 'utf8');

  console.log(
    `ingest: +${fresh.length} new workout(s), ${
      incoming.length - fresh.length
    } duplicate(s) skipped, ${merged.length} total`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
