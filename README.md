# Life Heatmap

A GitHub-contributions-style heatmap dashboard for metrics I track about myself.

First tracker: **running distance from Apple Health**. Built to accept more trackers (sleep, weight, reading, lifts) as drop-in modules.

## How it works

```
iOS (Apple Health)  ──export──▶  JSON/XML file
                                      │
                             (daily scheduled task)
                                      ▼
                          yarn ingest --json <path>
                                      │
                                      ▼
                         data/running/workouts.jsonl
                         data/running/daily.json    ◀── read at runtime
                                      │
                                      ▼
                           React dashboard (Netlify)
```

The dashboard is a static site. Data lives in `data/` and is committed to the repo. A scheduled task (running on your Mac) ingests new Apple Health exports daily and pushes the updated data files — Netlify auto-deploys.

## Developing

```sh
yarn install
yarn start       # dev server on :8081
yarn build       # production bundle
```

## Ingesting running data

### First-time full import (Apple Health export)

On iPhone: Health app → profile icon → **Export All Health Data** → AirDrop/save the `export.zip`. Unzip; you'll get an `export.xml`.

```sh
yarn ingest --xml /path/to/export.xml
```

This streams the XML, extracts every `HKWorkoutActivityTypeRunning` workout, and writes them into `data/running/workouts.jsonl`. It's idempotent — re-running won't duplicate workouts.

### Daily incremental updates (recommended workflow)

Each day, a small JSON file with just recent workouts is ingested:

```sh
yarn ingest --json /path/to/daily.json
# or a directory of files
yarn ingest --dir ~/iCloud/HealthExports
```

**Incremental JSON schema:**

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

Produce this however you like. Two easy options:

1. **iOS Shortcut**: "Find Health Samples → Type = Running → Get dictionary from health samples → Text → Save to iCloud Drive". Share this shortcut's output folder with your Mac.
2. **"Health Auto Export" app** (App Store): schedule daily JSON exports of running workouts to iCloud Drive.

### Scheduling

Configure a recurring task (Claude Desktop task, `launchd`, cron — whatever you use) to run, roughly:

```sh
cd ~/code/client
yarn ingest --dir ~/iCloud/HealthExports
git add data/
git diff --quiet --cached || git commit -m "daily ingest"
git push
```

Netlify picks up the push and redeploys the dashboard.

## Adding a new tracker

1. Define your tracker module at `src/trackers/<id>/index.ts` implementing `Tracker<TDetail>` (see `src/trackers/Tracker.ts`).
2. Register it in `src/trackers/registry.ts`.
3. Add an ingestion path under `scripts/trackers/<id>.ts` and, if needed, a new format parser under `scripts/formats/`.
4. Its daily aggregates go in `data/<id>/daily.json`.

No core changes needed — the dashboard iterates over the registry.

## Project layout

```
data/              committed data (source of truth for the dashboard)
scripts/           ingestion CLI
src/               React dashboard
  components/      Heatmap, TrackerCard, DayPopover, StatsPanel, …
  trackers/        Tracker interface + running/ implementation
  utils/           date, colorScale, streaks
```
