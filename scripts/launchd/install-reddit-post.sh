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
# WHY THE APP BUNDLE: macOS never shows the Automation prompt for Apple
# platform binaries (/bin/bash, osascript) running as launchd jobs — tccd
# denies them instantly with -1723 and no dialog. The job therefore runs
# through a tiny ad-hoc-signed app bundle (LucidRentsPoster.app) whose
# compiled launcher spawns the runner as a child, so the bundle stays the
# TCC "responsible process" and the prompt can appear and be remembered.
# The grant is tied to the ad-hoc signature (cdhash), so the installer only
# builds the app when it is missing; deleting the app forces a rebuild and
# a fresh one-time prompt.
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

# The rent scrapers launch their own copies of /Applications/Google Chrome
# through Playwright. While any of those are alive, "tell application
# \"Google Chrome\"" routes Apple Events nondeterministically — the poster can
# end up reading the scraper's headless instance (not signed in, JS from
# Apple Events off) and fail preflight with a misleading error. The scrapers
# relaunch Chrome between boroughs, so waiting for a momentary Chrome-free gap
# is a race; wait for the whole scrape run (the scrape.sh parents) to finish.
# Scrape phases are wall-clock-capped around 2h30, so a colliding slot posts
# late rather than failing; if somehow still busy after 3 hours, leave the
# queue item untouched for the next scheduled slot. launchd skips calendar
# fires while the job is running, so a delayed run cannot stack with the next.
scrapers_busy() {
  pgrep -f 'lucid-rents-sync/scripts/sync/scrape.sh' >/dev/null 2>&1 ||
    pgrep -f 'playwright_chromiumdev_profile' >/dev/null 2>&1
}
waited=0
while scrapers_busy; do
  if [ "\$waited" -ge 10800 ]; then
    echo "[runner] \$(date -u +%Y-%m-%dT%H:%M:%SZ) scrapers still running after 3h — skipping this slot"
    exit 1
  fi
  if [ "\$waited" -eq 0 ]; then
    echo "[runner] \$(date -u +%Y-%m-%dT%H:%M:%SZ) scrapers running — waiting for them to finish"
  fi
  sleep 60
  waited=\$((waited + 60))
done
if [ "\$waited" -gt 0 ]; then
  echo "[runner] \$(date -u +%Y-%m-%dT%H:%M:%SZ) scrapers clear after \${waited}s"
  # One more settle: a fresh scrape phase sometimes starts within a minute.
  sleep 30
  if scrapers_busy; then
    echo "[runner] \$(date -u +%Y-%m-%dT%H:%M:%SZ) scrapers restarted during settle — skipping this slot"
    exit 1
  fi
fi

echo "[runner] \$(date -u +%Y-%m-%dT%H:%M:%SZ) starting"
"$NODE_BIN" "$INSTALL_DIR/post-reddit-queue.mjs" "\$@"
echo "[runner] \$(date -u +%Y-%m-%dT%H:%M:%SZ) done"
RUNNER_EOF
chmod +x "$RUNNER"

# Build the TCC wrapper app if it does not exist yet (see header comment).
# Rebuilding would change the ad-hoc cdhash and invalidate the recorded
# Automation grant, so an existing app is left alone.
APP_DIR="$INSTALL_DIR/LucidRentsPoster.app"
APP_BIN="$APP_DIR/Contents/MacOS/poster"
if [ ! -x "$APP_BIN" ]; then
  echo "[install] building $APP_DIR"
  if ! command -v clang >/dev/null; then
    echo "FATAL: clang not found — install Xcode Command Line Tools (xcode-select --install)" >&2
    exit 1
  fi
  mkdir -p "$APP_DIR/Contents/MacOS"
  cat > "$APP_DIR/Contents/Info.plist" <<'APP_PLIST_EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>com.lucidrents.poster</string>
  <key>CFBundleName</key><string>LucidRentsPoster</string>
  <key>CFBundleExecutable</key><string>poster</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>LSUIElement</key><true/>
  <key>NSAppleEventsUsageDescription</key><string>Posts queued LucidRents content to Reddit through the signed-in Chrome session.</string>
</dict></plist>
APP_PLIST_EOF
  LAUNCHER_SRC="$(mktemp -t poster-launcher).c"
  cat > "$LAUNCHER_SRC" <<LAUNCHER_EOF
#include <spawn.h>
#include <stdio.h>
#include <sys/wait.h>
extern char **environ;
int main(int argc, char *argv[]) {
    /* Spawn (not exec) so this signed bundle binary stays alive as the
       TCC "responsible process" for the Apple Events the child sends. */
    char *args[argc + 3];
    args[0] = "/bin/bash";
    args[1] = "$RUNNER";
    for (int i = 1; i < argc; i++) args[i + 1] = argv[i];
    args[argc + 1] = NULL;
    pid_t pid;
    int rc = posix_spawn(&pid, "/bin/bash", NULL, NULL, args, environ);
    if (rc != 0) { fprintf(stderr, "posix_spawn failed: %d\n", rc); return 1; }
    int status = 0;
    if (waitpid(pid, &status, 0) < 0) { perror("waitpid"); return 1; }
    return WIFEXITED(status) ? WEXITSTATUS(status) : 1;
}
LAUNCHER_EOF
  clang -o "$APP_BIN" "$LAUNCHER_SRC"
  rm -f "$LAUNCHER_SRC"
  codesign --force --sign - --identifier com.lucidrents.poster "$APP_DIR"
else
  echo "[install] $APP_DIR already built — keeping it (and its Automation grant)"
fi

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
        <string>${APP_BIN}</string>
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
