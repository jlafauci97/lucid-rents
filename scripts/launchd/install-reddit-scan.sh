#!/usr/bin/env bash
# Install the com.lucidrents.reddit-scan LaunchAgent.
#
# launchd-spawned processes can't read files under ~/Desktop, ~/Documents,
# or ~/Downloads without Full Disk Access. To avoid that whole TCC dance,
# this installer copies scan-and-draft-reddit.mjs into ~/.lucidrents/
# (a non-restricted path) and bakes the env vars into the plist.
#
# Re-run this script after pulling main if scan-and-draft-reddit.mjs has
# changed — it's a copy, not a symlink.
#
# Usage:
#   bash scripts/launchd/install-reddit-scan.sh
#
# Uninstall:
#   launchctl bootout "gui/$(id -u)/com.lucidrents.reddit-scan"
#   rm ~/Library/LaunchAgents/com.lucidrents.reddit-scan.plist
#   rm -rf ~/.lucidrents

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Resolve env vars from .env.local in the repo root.
if [ ! -f "$REPO_ROOT/.env.local" ]; then
  echo "FATAL: $REPO_ROOT/.env.local not found. Run 'vercel env pull .env.local' first." >&2
  exit 1
fi

CRON_SECRET="$(grep '^CRON_SECRET=' "$REPO_ROOT/.env.local" | head -1 | sed -E 's/^CRON_SECRET=//; s/^"//; s/"$//' | tr -d '\n')"
if [ -z "$CRON_SECRET" ]; then
  echo "FATAL: CRON_SECRET not set in $REPO_ROOT/.env.local" >&2
  exit 1
fi
BASE_URL="${BASE_URL:-https://lucidrents.com}"

# Resolve a stable node binary (nvm paths drift; homebrew is stable).
NODE_BIN="${NODE_BIN:-/opt/homebrew/bin/node}"
if [ ! -x "$NODE_BIN" ]; then
  NODE_BIN="$(command -v node || true)"
fi
if [ -z "$NODE_BIN" ]; then
  echo "FATAL: no node binary found (tried /opt/homebrew/bin/node and PATH)" >&2
  exit 1
fi

INSTALL_DIR="$HOME/.lucidrents"
PLIST_PATH="$HOME/Library/LaunchAgents/com.lucidrents.reddit-scan.plist"
LOG_PATH="$HOME/Library/Logs/lucidrents-reddit-scan.log"

mkdir -p "$INSTALL_DIR" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"

echo "[install] copying scan-and-draft-reddit.mjs -> $INSTALL_DIR/"
cp "$REPO_ROOT/scripts/scan-and-draft-reddit.mjs" "$INSTALL_DIR/scan-and-draft-reddit.mjs"

echo "[install] writing $PLIST_PATH"
cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.lucidrents.reddit-scan</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_BIN}</string>
        <string>${INSTALL_DIR}/scan-and-draft-reddit.mjs</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${INSTALL_DIR}</string>
    <key>StartInterval</key>
    <integer>21600</integer>
    <key>RunAtLoad</key>
    <false/>
    <key>StandardOutPath</key>
    <string>${LOG_PATH}</string>
    <key>StandardErrorPath</key>
    <string>${LOG_PATH}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/bin:/bin</string>
        <key>BASE_URL</key>
        <string>${BASE_URL}</string>
        <key>CRON_SECRET</key>
        <string>${CRON_SECRET}</string>
        <key>REDDIT_LOOKBACK_HOURS</key>
        <string>6</string>
    </dict>
</dict>
</plist>
PLIST

plutil -lint "$PLIST_PATH" >/dev/null

# Bootstrap (fresh) or replace the existing job.
if launchctl list | grep -q com.lucidrents.reddit-scan; then
  echo "[install] booting out existing job"
  launchctl bootout "gui/$(id -u)/com.lucidrents.reddit-scan" 2>/dev/null || true
fi

echo "[install] bootstrapping new job"
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"

echo "[install] kickstarting one run for verification"
launchctl kickstart -k "gui/$(id -u)/com.lucidrents.reddit-scan"
sleep 5

echo
echo "Status:    $(launchctl list | grep com.lucidrents.reddit-scan)"
echo "Plist:     $PLIST_PATH"
echo "Logs:      $LOG_PATH"
echo "Schedule:  every 6 hours"
echo
echo "Tail logs with: tail -f $LOG_PATH"
echo "Force run with: launchctl kickstart -k \"gui/\$(id -u)/com.lucidrents.reddit-scan\""
