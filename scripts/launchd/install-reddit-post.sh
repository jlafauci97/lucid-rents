#!/usr/bin/env bash
# Install the com.lucidrents.reddit-post LaunchAgent — the scheduler for
# scripts/post-reddit-queue.mjs.
#
# WHY THIS EXISTS: the poster was only ever run by hand. The queue could be
# full of approved replies and generated self-posts and nothing would publish
# until a human remembered to run a command. This is the missing half of the
# pipeline; the scanner has had a LaunchAgent since #163.
#
# WHY A LaunchAgent AND NOT A CRON/CI JOB: the poster drives a logged-in
# Chrome profile, so it needs the always-on Mac (the Mac mini) with a GUI
# session. It cannot run on Vercel, in GitHub Actions, or over a plain SSH
# session.
#
# WHAT IT PUBLISHES: one queue item per run. The API serves approved replies
# first (highest relevance), then self-post drafts. Replies therefore still
# require a human to move them draft_ready -> approved in mission control;
# self-posts publish unattended by design.
#
# BROWSER: the poster launches its own Chrome (the real /Applications binary)
# against ~/.lucidrents/chrome-posting-profile via playwright-core, installed
# here under ~/.lucidrents. It does NOT touch the interactive browser and it
# does not use AppleScript, so there are no macOS Automation prompts and no
# collisions with the rent scrapers' Playwright Chrome instances. Sign the
# profile in once with: node scripts/setup-reddit-profile.mjs
#
# SCRAPER INTERLOCK: scrape.sh owns the machine's default route through a
# WireGuard tunnel for its whole run (up to ~2h30). Posting to Reddit through
# a commercial VPN IP is an account-health risk, so the runner defers to the
# next 15-minute tick while a scrape run is alive, and warns if some other
# VPN still holds the default route.
#
# TCC: launchd-spawned processes cannot read ~/Desktop, ~/Documents or
# ~/Downloads without Full Disk Access, so this copies the poster into
# ~/.lucidrents/ and bakes the env into the plist rather than reading
# .env.local at run time. Re-run this installer after pulling main if
# post-reddit-queue.mjs changed — it is a copy, not a symlink.
#
# Usage:
#   bash scripts/launchd/install-reddit-post.sh
#
# Pause posting without uninstalling (the kill switch):
#   touch ~/.lucidrents/PAUSE_POSTING
#   rm    ~/.lucidrents/PAUSE_POSTING     # resume
#
# Run one immediately:
#   launchctl kickstart -k "gui/$(id -u)/com.lucidrents.reddit-post"
#
# Tail logs:
#   tail -f ~/Library/Logs/lucidrents-reddit-post.log
#
# Uninstall:
#   launchctl bootout "gui/$(id -u)/com.lucidrents.reddit-post"
#   rm ~/Library/LaunchAgents/com.lucidrents.reddit-post.plist

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ ! -f "$REPO_ROOT/.env.local" ]; then
  echo "FATAL: $REPO_ROOT/.env.local not found. Run 'vercel env pull .env.local' first." >&2
  exit 1
fi

read_env() {
  grep "^$1=" "$REPO_ROOT/.env.local" | head -1 | sed -E "s/^$1=//; s/^\"//; s/\"$//" | tr -d '\n'
}

CRON_SECRET="$(read_env CRON_SECRET)"
REDDIT_USERNAME="$(read_env REDDIT_USERNAME)"
BASE_URL="${BASE_URL:-https://lucidrents.com}"

if [ -z "$CRON_SECRET" ]; then
  echo "FATAL: CRON_SECRET not set in $REPO_ROOT/.env.local" >&2
  exit 1
fi
if [ -z "$REDDIT_USERNAME" ]; then
  # Not fatal for self-posts alone, but preflight uses it to confirm the
  # profile is signed in as the right account, and it builds the r/u_<name>
  # self-post target. Without it the poster cannot verify who it is posting as.
  echo "FATAL: REDDIT_USERNAME not set in $REPO_ROOT/.env.local" >&2
  exit 1
fi

NODE_BIN="${NODE_BIN:-/opt/homebrew/bin/node}"
if [ ! -x "$NODE_BIN" ]; then
  NODE_BIN="$(command -v node || true)"
fi
if [ -z "$NODE_BIN" ]; then
  echo "FATAL: no node binary found (tried /opt/homebrew/bin/node and PATH)" >&2
  exit 1
fi
NPM_BIN="$(dirname "$NODE_BIN")/npm"
[ -x "$NPM_BIN" ] || NPM_BIN="$(command -v npm)"

INSTALL_DIR="$HOME/.lucidrents"
RUNNER="$INSTALL_DIR/run-reddit-post.sh"
PLIST_PATH="$HOME/Library/LaunchAgents/com.lucidrents.reddit-post.plist"
LOG_PATH="$HOME/Library/Logs/lucidrents-reddit-post.log"

mkdir -p "$INSTALL_DIR" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"

echo "[install] copying poster scripts -> $INSTALL_DIR/"
cp "$REPO_ROOT/scripts/post-reddit-queue.mjs" "$INSTALL_DIR/post-reddit-queue.mjs"
cp "$REPO_ROOT/scripts/setup-reddit-profile.mjs" "$INSTALL_DIR/setup-reddit-profile.mjs"

# playwright-core drives the system Chrome — no bundled-browser download, and
# nothing added to the web app's package.json.
if [ ! -d "$INSTALL_DIR/node_modules/playwright-core" ]; then
  echo "[install] installing playwright-core into $INSTALL_DIR"
  (cd "$INSTALL_DIR" && "$NPM_BIN" install --no-fund --no-audit --silent playwright-core)
else
  echo "[install] playwright-core already installed"
fi

# The runner exists for the kill switch and the scraper interlock. launchd has
# no concept of "installed but paused", and unloading the agent to stop
# posting is easy to forget to undo.
echo "[install] writing $RUNNER"
cat > "$RUNNER" <<RUNNER_EOF
#!/bin/bash
set -euo pipefail

if [ -f "$INSTALL_DIR/PAUSE_POSTING" ]; then
  echo "[runner] \$(date -u +%Y-%m-%dT%H:%M:%SZ) paused (PAUSE_POSTING present) — nothing posted"
  exit 0
fi

# Quiet hours: the poller ticks every 15 minutes around the clock, but
# posting overnight reads as a bot. Outside 9:00–20:59 local, do nothing.
hour=\$(date +%H)
if [ "\$hour" -lt 9 ] || [ "\$hour" -ge 21 ]; then
  exit 0
fi

# scrape.sh routes the whole machine through a WireGuard VPN for its entire
# run. Posting to Reddit from a commercial VPN IP is an account-health risk.
# With a 15-minute poll there is no need to sit and wait — defer to the next
# tick, which retries automatically until the scrape run ends.
if pgrep -f 'lucid-rents-sync/scripts/sync/scrape.sh' >/dev/null 2>&1; then
  echo "[runner] \$(date -u +%Y-%m-%dT%H:%M:%SZ) scrapers running (VPN owns egress) — deferring to next tick"
  exit 0
fi

# Belt and braces: the WireGuard tunnel captures egress WITHOUT appearing as
# the default-route interface ('route -n get default' still says en1 while
# the external IP is the VPN's), so check for the tunnel itself. Proton
# WireGuard configs always assign 10.2.0.2 to the interface. This catches a
# tunnel left up by a crashed scrape run or brought up by anything else.
if ifconfig 2>/dev/null | grep -q 'inet 10\.2\.0\.2'; then
  echo "[runner] \$(date -u +%Y-%m-%dT%H:%M:%SZ) WireGuard tunnel is up (10.2.0.2) — deferring to next tick"
  exit 0
fi

echo "[runner] \$(date -u +%Y-%m-%dT%H:%M:%SZ) starting"
"$NODE_BIN" "$INSTALL_DIR/post-reddit-queue.mjs" "\$@"
echo "[runner] \$(date -u +%Y-%m-%dT%H:%M:%SZ) done"
RUNNER_EOF
chmod +x "$RUNNER"

# Poll every 15 minutes: approving a reply in mission control should turn
# into a post within minutes, not at the next fixed slot. The cadence and
# ceilings live server-side in the queue API (replies: 5/day, 2/subreddit,
# 15-min gap; self-posts: 3/24h, 3h apart) — the poller is just a dumb pump,
# and the runner above keeps it inside 9:00–20:59 and off the scrapers' VPN.
echo "[install] writing $PLIST_PATH"
cat > "$PLIST_PATH" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.lucidrents.reddit-post</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${RUNNER}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${INSTALL_DIR}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>CRON_SECRET</key>
        <string>${CRON_SECRET}</string>
        <key>REDDIT_USERNAME</key>
        <string>${REDDIT_USERNAME}</string>
        <key>SCANNER_TARGET_URL</key>
        <string>${BASE_URL}</string>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
    <key>StartInterval</key>
    <integer>900</integer>
    <key>StandardOutPath</key>
    <string>${LOG_PATH}</string>
    <key>StandardErrorPath</key>
    <string>${LOG_PATH}</string>
    <key>ProcessType</key>
    <string>Interactive</string>
</dict>
</plist>
PLIST_EOF

chmod 600 "$PLIST_PATH"  # contains CRON_SECRET

echo "[install] (re)bootstrapping LaunchAgent"
launchctl bootout "gui/$(id -u)/com.lucidrents.reddit-post" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"

# The AppleScript era needed an ad-hoc-signed wrapper app for TCC; it is dead
# weight now and its Automation grant with it.
if [ -d "$INSTALL_DIR/LucidRentsPoster.app" ]; then
  echo "[install] removing obsolete LucidRentsPoster.app (AppleScript-era TCC wrapper)"
  rm -rf "$INSTALL_DIR/LucidRentsPoster.app"
  tccutil reset AppleEvents com.lucidrents.poster >/dev/null 2>&1 || true
fi

echo
echo "[install] done. Installed com.lucidrents.reddit-post"
echo "  schedule : every 15 min, 9:00-20:59 local — approve in mission control and it posts"
echo "  ceilings : server-side (replies 5/day + 15-min gap; self-posts 3/24h, 3h apart)"
echo "  logs     : $LOG_PATH"
echo "  pause    : touch $INSTALL_DIR/PAUSE_POSTING"
echo
echo "If the posting profile has never been signed in on this machine:"
echo "  $NODE_BIN $REPO_ROOT/scripts/setup-reddit-profile.mjs"
echo
echo "Verify before letting the schedule post for real:"
echo "  $NODE_BIN $INSTALL_DIR/post-reddit-queue.mjs --check"
echo "  $NODE_BIN $INSTALL_DIR/post-reddit-queue.mjs --dry-run"
