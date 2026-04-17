#!/usr/bin/env bash
#
# Daily auto-ingest: pulls recent Apple Health export files from the configured
# directory, runs the ingest CLI, and pushes any new data. Designed to run
# from launchd (see scripts/com.life-heatmap.autoingest.plist) but works fine
# as a cron job too.
#
# Config via env (all optional):
#   HEALTH_EXPORTS_DIR  directory holding per-day JSON exports from iOS
#                       Health Auto Export (default: iCloud Drive/HealthExports)
#   AUTO_INGEST_BRANCH  override the branch to pull/push (defaults to current)
#
# Exits 0 on clean run, non-zero on failure — launchd will surface the stderr.

set -euo pipefail

# Resolve repo root regardless of how this was invoked.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# launchd agents don't inherit your interactive shell PATH. Make sure Node
# tooling is findable. Adjust PATHs in your plist if these miss.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
fi

LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/auto-ingest.log"
exec >>"$LOG" 2>&1

echo
echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) auto-ingest starting ==="

: "${HEALTH_EXPORTS_DIR:=$HOME/Library/Mobile Documents/com~apple~CloudDocs/HealthExports}"
echo "source dir: $HEALTH_EXPORTS_DIR"

if [ ! -d "$HEALTH_EXPORTS_DIR" ]; then
  echo "error: HEALTH_EXPORTS_DIR does not exist"
  exit 1
fi

# Skip work if there are no json files (common if iOS hasn't synced yet).
if ! find "$HEALTH_EXPORTS_DIR" -maxdepth 1 -type f -name '*.json' -print -quit | grep -q .; then
  echo "no *.json files in source dir; nothing to ingest"
  exit 0
fi

# Install deps if missing (first run only).
if [ ! -d node_modules ]; then
  echo "node_modules missing; running yarn install"
  yarn install --frozen-lockfile --ignore-engines
fi

yarn ingest --dir "$HEALTH_EXPORTS_DIR"

BRANCH="${AUTO_INGEST_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
echo "branch: $BRANCH"

# If ingest produced changes, commit & push. Idempotent when nothing changed.
if git diff --quiet -- data/; then
  echo "no data changes"
else
  # Rebase in case Netlify or another machine pushed.
  git pull --rebase --autostash origin "$BRANCH" || {
    echo "warn: rebase failed; aborting to avoid clobbering remote"
    exit 1
  }
  git add data/
  git commit -m "daily ingest: $(date -u +%Y-%m-%d)"
  git push origin "$BRANCH"
  echo "pushed new data"
fi

echo "=== done ==="
