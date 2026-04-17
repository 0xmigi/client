#!/usr/bin/env bash
#
# Installs the life-heatmap auto-ingest launchd agent. Idempotent: safe to
# re-run (will unload an older copy first).
#
# Usage:
#   scripts/install-launchd.sh                       # uses iCloud HealthExports default
#   HEALTH_EXPORTS_DIR=/path/to/dir ./install-launchd.sh
#   scripts/install-launchd.sh --uninstall           # remove the agent

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.life-heatmap.autoingest"
AGENT_DIR="$HOME/Library/LaunchAgents"
AGENT_PATH="$AGENT_DIR/$LABEL.plist"
TEMPLATE="$REPO_ROOT/scripts/$LABEL.plist"
UID_NUM="$(id -u)"

case "$(uname -s)" in
  Darwin) ;;
  *)
    echo "error: launchd is macOS-only. On Linux use cron/systemd instead."
    exit 1
    ;;
esac

if [ "${1:-}" = "--uninstall" ]; then
  if [ -f "$AGENT_PATH" ]; then
    launchctl bootout "gui/$UID_NUM/$LABEL" 2>/dev/null || true
    rm -f "$AGENT_PATH"
    echo "uninstalled: $AGENT_PATH"
  else
    echo "no agent installed at $AGENT_PATH"
  fi
  exit 0
fi

: "${HEALTH_EXPORTS_DIR:=$HOME/Library/Mobile Documents/com~apple~CloudDocs/HealthExports}"

mkdir -p "$AGENT_DIR" "$REPO_ROOT/logs"

# Render the template: swap {{REPO_ROOT}}, {{HEALTH_EXPORTS_DIR}}, {{HOME}}.
# Using python for safe substitution (sed chokes on slashes and spaces).
python3 - "$TEMPLATE" "$AGENT_PATH" "$REPO_ROOT" "$HEALTH_EXPORTS_DIR" "$HOME" <<'PY'
import sys, pathlib
src, dst, repo, health, home = sys.argv[1:]
text = pathlib.Path(src).read_text()
for key, val in {"REPO_ROOT": repo, "HEALTH_EXPORTS_DIR": health, "HOME": home}.items():
    text = text.replace("{{" + key + "}}", val)
pathlib.Path(dst).write_text(text)
PY

# Reload if already present.
if launchctl print "gui/$UID_NUM/$LABEL" >/dev/null 2>&1; then
  launchctl bootout "gui/$UID_NUM/$LABEL" || true
fi

launchctl bootstrap "gui/$UID_NUM" "$AGENT_PATH"
launchctl enable "gui/$UID_NUM/$LABEL"

cat <<EOF

installed: $AGENT_PATH
    label: $LABEL
    source dir: $HEALTH_EXPORTS_DIR
    schedule: daily at 06:45 local

Useful commands:
    # test-run immediately (does a real ingest + push):
    launchctl kickstart -k gui/$UID_NUM/$LABEL

    # check status:
    launchctl print gui/$UID_NUM/$LABEL | head

    # tail logs:
    tail -f "$REPO_ROOT/logs/auto-ingest.log"

    # uninstall:
    scripts/install-launchd.sh --uninstall

EOF
