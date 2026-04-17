/**
 * Stdio MCP server exposing the committed life-heatmap data as tools.
 *
 * Register with Claude Desktop by adding to claude_desktop_config.json:
 *
 *   {
 *     "mcpServers": {
 *       "life-heatmap": {
 *         "command": "yarn",
 *         "args": ["--cwd", "/absolute/path/to/this/repo", "mcp"]
 *       }
 *     }
 *   }
 *
 * Then in a Claude Desktop conversation, tools like `running_summary` and
 * `running_recent` become callable with real numbers — no file hunting.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { RunWorkout, localDate } from './trackers/running';

const REPO_ROOT = path.resolve(__dirname, '..');
const WORKOUTS_PATH = path.join(REPO_ROOT, 'data', 'running', 'workouts.jsonl');

interface Cache {
  mtimeMs: number;
  workouts: RunWorkout[];
}
let cache: Cache | null = null;

async function loadWorkouts(): Promise<RunWorkout[]> {
  let mtimeMs = 0;
  try {
    const stat = await fs.stat(WORKOUTS_PATH);
    mtimeMs = stat.mtimeMs;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  if (cache && cache.mtimeMs === mtimeMs) return cache.workouts;
  const text = await fs.readFile(WORKOUTS_PATH, 'utf8');
  const workouts = text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as RunWorkout);
  cache = { mtimeMs, workouts };
  return workouts;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function aggregateByDate(workouts: RunWorkout[]): Map<string, { distanceKm: number; count: number; durationSec: number }> {
  const out = new Map<string, { distanceKm: number; count: number; durationSec: number }>();
  for (const w of workouts) {
    const d = localDate(w.startDate);
    const cur = out.get(d) || { distanceKm: 0, count: 0, durationSec: 0 };
    cur.distanceKm += w.distanceKm;
    cur.count += 1;
    cur.durationSec += w.durationSec;
    out.set(d, cur);
  }
  return out;
}

const server = new Server(
  { name: 'life-heatmap', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'running_summary',
      description:
        'Overall running stats: all-time total distance, last-365-day total, current streak, longest streak, best day, and total workouts.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'running_recent',
      description: 'Return the most recent N running workouts (newest first). Useful for "how were my last few runs?" questions.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 200, default: 10 },
        },
      },
    },
    {
      name: 'running_daily',
      description:
        'Return daily distance totals (km) for the last N days, including zero days. Useful for spotting rest-day patterns or recent trend.',
      inputSchema: {
        type: 'object',
        properties: {
          days: { type: 'integer', minimum: 1, maximum: 400, default: 30 },
        },
      },
    },
    {
      name: 'running_range',
      description: 'Return all workouts whose local start-date falls within [start, end] (YYYY-MM-DD, inclusive).',
      inputSchema: {
        type: 'object',
        properties: {
          start: { type: 'string', description: 'YYYY-MM-DD' },
          end: { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['start', 'end'],
      },
    },
  ],
}));

const recentSchema = z.object({ limit: z.number().int().min(1).max(200).default(10) });
const dailySchema = z.object({ days: z.number().int().min(1).max(400).default(30) });
const rangeSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function paceMinPerKm(durationSec: number, distanceKm: number): string {
  if (distanceKm <= 0) return '—';
  const sec = durationSec / distanceKm;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

function asText(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const workouts = await loadWorkouts();
  const args = req.params.arguments ?? {};

  switch (req.params.name) {
    case 'running_summary': {
      if (workouts.length === 0) {
        return { content: [{ type: 'text', text: 'No running data ingested yet.' }] };
      }
      const byDate = aggregateByDate(workouts);
      const sortedDates = [...byDate.keys()].sort();
      const first = sortedDates[0];
      const last = sortedDates[sortedDates.length - 1];

      // Build a gap-filled daily series from first to today for streak calc.
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const start = new Date(first + 'T00:00:00Z');
      const days: Array<{ date: string; value: number }> = [];
      for (let d = new Date(start); d.getTime() <= today.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
        const ymd = d.toISOString().slice(0, 10);
        days.push({ date: ymd, value: byDate.get(ymd)?.distanceKm ?? 0 });
      }

      let current = 0;
      for (let i = days.length - 1; i >= 0; i--) {
        if (days[i].value > 0) current++;
        else break;
      }
      let longest = 0;
      let run = 0;
      for (const d of days) {
        if (d.value > 0) {
          run++;
          if (run > longest) longest = run;
        } else run = 0;
      }

      const total = workouts.reduce((s, w) => s + w.distanceKm, 0);
      const last365Cutoff = daysAgo(365);
      const last365 = workouts.filter((w) => localDate(w.startDate) >= last365Cutoff);
      const total365 = last365.reduce((s, w) => s + w.distanceKm, 0);
      const best = [...byDate.entries()].sort((a, b) => b[1].distanceKm - a[1].distanceKm)[0];

      const summary = {
        first_workout_date: first,
        last_workout_date: last,
        total_workouts: workouts.length,
        total_distance_km: Number(total.toFixed(2)),
        last_365d_distance_km: Number(total365.toFixed(2)),
        current_streak_days: current,
        longest_streak_days: longest,
        best_day: best
          ? { date: best[0], distance_km: Number(best[1].distanceKm.toFixed(2)), workouts: best[1].count }
          : null,
      };
      return { content: [{ type: 'text', text: asText(summary) }] };
    }

    case 'running_recent': {
      const { limit } = recentSchema.parse(args);
      const sorted = [...workouts].sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, limit);
      const out = sorted.map((w) => ({
        date: localDate(w.startDate),
        start_time: w.startDate,
        distance_km: Number(w.distanceKm.toFixed(2)),
        duration_min: Number((w.durationSec / 60).toFixed(1)),
        pace_min_per_km: paceMinPerKm(w.durationSec, w.distanceKm),
        source: w.source,
      }));
      return { content: [{ type: 'text', text: asText(out) }] };
    }

    case 'running_daily': {
      const { days } = dailySchema.parse(args);
      const byDate = aggregateByDate(workouts);
      const end = new Date();
      end.setUTCHours(0, 0, 0, 0);
      const out: Array<{ date: string; distance_km: number; workouts: number }> = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(end);
        d.setUTCDate(end.getUTCDate() - i);
        const ymd = d.toISOString().slice(0, 10);
        const agg = byDate.get(ymd);
        out.push({
          date: ymd,
          distance_km: Number((agg?.distanceKm ?? 0).toFixed(2)),
          workouts: agg?.count ?? 0,
        });
      }
      return { content: [{ type: 'text', text: asText(out) }] };
    }

    case 'running_range': {
      const { start, end } = rangeSchema.parse(args);
      if (start > end) throw new Error('start must be <= end');
      const filtered = workouts.filter((w) => {
        const d = localDate(w.startDate);
        return d >= start && d <= end;
      });
      const out = filtered
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .map((w) => ({
          date: localDate(w.startDate),
          start_time: w.startDate,
          distance_km: Number(w.distanceKm.toFixed(2)),
          duration_min: Number((w.durationSec / 60).toFixed(1)),
          pace_min_per_km: paceMinPerKm(w.durationSec, w.distanceKm),
          source: w.source,
        }));
      return {
        content: [
          {
            type: 'text',
            text: asText({
              count: out.length,
              total_distance_km: Number(out.reduce((s, w) => s + w.distance_km, 0).toFixed(2)),
              workouts: out,
            }),
          },
        ],
      };
    }

    default:
      throw new Error(`unknown tool: ${req.params.name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
