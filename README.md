# Life Heatmap

A GitHub-contributions-style heatmap dashboard for metrics I track about myself.

First tracker: **running distance from Apple Health**. Built to accept more trackers (sleep, weight, reading, lifts) as drop-in modules.

## How it works

```
iPhone ── Health Auto Export ──▶ iCloud Drive/HealthExports/*.json
                                             │
                                 (launchd agent, daily 06:45)
                                             ▼
                                  scripts/auto-ingest.sh
                                             │
                                             ▼
                         data/running/workouts.jsonl (append-only)
                         data/running/daily.json    (derived)
                                             │
                                        git push
                                             │
                                             ▼
                         Netlify auto-deploys static dashboard
                                             │
                                             ▼
                                  Claude Desktop  ◀── MCP server
                                  reads same data          (yarn mcp)
```

The dashboard is a static site. Data lives in `data/` and is committed to the repo. A scheduled task on the Mac ingests new exports daily and pushes updated data — Netlify redeploys automatically. A bundled MCP server lets Claude Desktop query the same data as real tools, so training conversations are grounded in numbers.

## End-to-end setup (one-time)

**A closed automation loop requires all four pieces below.** Apple Health data is not accessible on macOS directly (HealthKit is iOS-only), so something on the phone has to export it.

### 1. iPhone: install *Health Auto Export – JSON+CSV Sync*

App Store → search "Health Auto Export". In the app:

- **Automation** tab → **Add** → frequency: **Daily** → time: something before your Mac ingest (e.g. 06:00).
- **Data Types**: enable **Workouts** only (add more later as trackers grow).
- **Aggregation**: none / raw.
- **Format**: JSON.
- **Destination**: iCloud Drive → a new folder named `HealthExports/`.

That's the phone side. It runs silently from now on.

### 2. Mac: clone this repo and install deps

```sh
git clone <your-fork-url> ~/code/client
cd ~/code/client
yarn install
```

### 3. Mac: install the daily launchd agent

```sh
./scripts/install-launchd.sh
```

This copies `scripts/com.life-heatmap.autoingest.plist` into `~/Library/LaunchAgents/`, fills in your repo path + `HealthExports/` path, and loads it. Daily at 06:45 it runs `scripts/auto-ingest.sh`, which:

1. Merges new JSON files into `data/running/workouts.jsonl` (idempotent — duplicates are hashed and dropped).
2. Rebuilds `data/running/daily.json`.
3. `git pull --rebase`, commits if there's a diff, pushes.

Useful operational commands:

```sh
launchctl kickstart -k gui/$(id -u)/com.life-heatmap.autoingest   # run now
tail -f logs/auto-ingest.log                                       # tail output
./scripts/install-launchd.sh --uninstall                           # remove agent
```

Override the source directory with `HEALTH_EXPORTS_DIR=/some/path ./scripts/install-launchd.sh` if iCloud isn't your flow.

### 4. Mac: register the MCP server with Claude Desktop

So Claude can query your running history as structured tools (not by re-reading files each time), add this to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "life-heatmap": {
      "command": "yarn",
      "args": ["--cwd", "/absolute/path/to/client", "mcp"]
    }
  }
}
```

Restart Claude Desktop. You'll see `running_summary`, `running_recent`, `running_daily`, and `running_range` available in any conversation. Ask things like "how's my training been the past month?" and Claude will call the tools instead of guessing.

### 5. (Optional) Pin the dashboard to the dock

Open your Netlify URL in **Safari** → File → **Add to Dock…** → name it "Life Heatmap". It opens as a standalone window with the heatmap — "primarily usable on my desktop". In Chrome: three-dot menu → Cast, Save and Share → **Install page as app**.

## Developing

```sh
yarn install
yarn start       # dev server on :8081
yarn build       # production bundle (→ dist/)
yarn ingest --help
```

## Manual ingestion

If you want to run without the launchd agent:

### First-time full import from a fresh Apple Health export

On iPhone: Health app → profile → **Export All Health Data** → AirDrop the `export.zip` to your Mac, unzip.

```sh
yarn ingest --xml /path/to/export.xml
```

This streams the (often huge) XML, extracts every `HKWorkoutActivityTypeRunning` workout, dedupes, and writes to `data/running/workouts.jsonl`.

### Ad-hoc incremental ingests

```sh
yarn ingest --json /path/to/one-file.json
yarn ingest --dir  /path/to/folder-of-jsons
```

Incremental JSON schema (what Health Auto Export produces, and any other pipeline can target):

```json
{
  "workouts": [
    {
      "startDate": "2026-04-16T07:12:00-07:00",
      "durationSec": 1850,
      "distanceKm": 5.31,
      "activityType": "Running",
      "source": "Apple Watch"
    }
  ]
}
```

## Adding a new tracker

1. Implement `Tracker<TDetail>` at `src/trackers/<id>/index.ts` (see `src/trackers/Tracker.ts` for the interface).
2. Register it in `src/trackers/registry.ts`.
3. Add ingestion for it under `scripts/trackers/<id>.ts` and, if the raw format is new, a parser at `scripts/formats/`.
4. Commit data to `data/<id>/daily.json`.
5. (Optional) Expose tools for it from the MCP server by adding cases to `scripts/mcp-server.ts`.

The dashboard iterates over `registry.ts` — no core changes needed.

## Project layout

```
data/                   committed data (dashboard reads this)
  running/
    workouts.jsonl      append-only source of truth
    daily.json          derived aggregates + per-day details
public/                 PWA manifest + favicon
scripts/
  ingest.ts             CLI entry
  auto-ingest.sh        launchd wrapper: ingest + git push
  install-launchd.sh    installs / removes the daily agent
  com.life-heatmap.autoingest.plist   launchd template
  mcp-server.ts         stdio MCP server for Claude Desktop
  formats/              raw-format parsers (xml, incremental JSON)
  trackers/             ingest-side tracker helpers
src/
  components/           Heatmap, TrackerCard, DayPopover, StatsPanel, …
  trackers/             Tracker interface + running/ implementation
  utils/                date, colorScale, streaks
```
