#!/usr/bin/env bash
# Install the com.lucidrents.reddit-post LaunchAgent — the scheduler for
# scripts/post-reddit-queue.mjs.
#
# WHY THIS EXISTS: the poster was only ever run by hand. The queue could be
# full of approved replies and generated self-posts and nothing would publish
# until a human remembered to run a command. This is the missing half of the
# pipeline; the scanner has had a LaunchAgent since #163.
#
# WHY A LaunchAgent AND NOT A CRON/CI JOB: the poster drives Chrome through
# AppleScript, so it needs a logged-in GUI session with Chrome signed in to the
# posting account. It cannot run on Vercel, in GitHub Actions, or over a plain
# SSH session. This must be installed on the always-on Mac (the Mac mini).
#
# WHAT IT PUBLISHES: one queue item per run. The API serves approved replies
# first (highest relevance), then self-post drafts. Replies therefore still
# require a human to move them draft_ready -> approved in mission control;
# self-posts publish unattended by design.
#
# TCC: launchd-spawned processes cannot read ~/Desktop, ~/Documents or
# ~/Downloads without Full Disk Access, so this copies the poster into
# ~/.lucidrents/ and bakes the env into the plist rather than reading
# .env.local at run time. Re-run this installer after pulling main if
# post-reddit-queue.mjs changed — it is a copy, not a symlink.
#
# ONE-TIME PROMPT: the first run asks for permission to control Google Chrome
# (System Settings -> Privacy & Security -> Automation). Approve it or every
# run fails at preflight. Chrome must also have "Allow JavaScript from Apple
# Events" enabled (View -> Developer).
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
  # Not fatal for self-posts alone, but preflight uses it to confirm Chrome is
  # signed in as the right account, and it builds the r/u_<name> self-post
  # target. Without it the poster cannot verify who it is posting as.
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

INSTALL_DIR="$HOME/.lucidrents"
RUNNER="$INSTALL_DIR/run-reddit-post.sh"
PLIST_PATH="$HOME/Library/LaunchAgents/com.lucidrents.reddit-post.plist"
LOG_PATH="$HOME/Library/Logs/lucidrents-reddit-post.log"

mkdir -p "$INSTALL_DIR" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"

echo "[install] copying post-reddit-queue.mjs -> $INSTALL_DIR/"
cp "$REPO_ROOT/scripts/post-reddit-queue.mjs" "$INSTALL_DIR/post-reddit-queue.mjs"

# The runner exists purely for the kill switch. launchd has no concept of
# "installed but paused", and unloading the agent to stop posting is easy to
# forget to undo.
echo "[install] writing $RUNNER"
cat > "$RUNNER" <<RUNNER_EOF
#!/bin/bash
set -euo pipefail

if [ -f "$INSTALL_DIR/PAUSE_POSTING" ]; then
  echo "[runner] \$(date -u +%Y-%m-%dT%H:%M:%SZ) paused (PAUSE_POSTING present) — nothing posted"
  exit 0
fi

echo "[runner] \$(date -u +%Y-%m-%dT%H:%M:%SZ) starting"
"$NODE_BIN" "$INSTALL_DIR/post-reddit-queue.mjs" "\$@"
echo "[runner] \$(date -u +%Y-%m-%dT%H:%M:%SZ) done"
RUNNER_EOF
chmod +x "$RUNNER"

# Four fixed times rather than StartInterval: posting overnight reads as a bot,
# and fixed hours keep runs inside the window where the machine is awake and
# somebody could notice a bad post. Each run publishes at most one item, so
# this is a ceiling of 4 posts/day.
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
    <key>StartCalendarInterval</key>
    <array>
        <dict><key>Hour</key><integer>10</integer><key>Minute</key><integer>20</integer></dict>
        <dict><key>Hour</key><integer>13</integer><key>Minute</key><integer>20</integer></dict>
        <dict><key>Hour</key><integer>16</integer><key>Minute</key><integer>20</integer></dict>
        <dict><key>Hour</key><integer>19</integer><key>Minute</key><integer>20</integer></dict>
    </array>
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

echo
echo "[install] done. Installed com.lucidrents.reddit-post"
echo "  schedule : 10:20, 13:20, 16:20, 19:20 local — one item per run (max 4/day)"
echo "  logs     : $LOG_PATH"
echo "  pause    : touch $INSTALL_DIR/PAUSE_POSTING"
echo
echo "Verify with a dry run before letting the schedule post for real:"
echo "  $NODE_BIN $INSTALL_DIR/post-reddit-queue.mjs --dry-run"
