#!/bin/zsh
# One-shot setup for the nightly sitemap job on the Mac mini.
#
#   cd <repo> && ./scripts/setup-sitemaps-mini.sh
#
# Idempotent — re-run it any time (after pulling changes, to re-verify, etc).
# It will: pull main, install deps, fetch BLOB_READ_WRITE_TOKEN into
# .env.local (via the Vercel CLI, prompting a browser login if needed),
# rewrite the launchd plist for THIS machine's paths, install + load it,
# and smoke-test the generator for 60 seconds.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"
PLIST_SRC="$REPO_DIR/scripts/launchd/com.lucidrents.sitemaps.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.lucidrents.sitemaps.plist"
LABEL="com.lucidrents.sitemaps"

step() { print -P "%F{cyan}==>%f $1"; }
ok()   { print -P "%F{green}  ✓%f $1"; }
die()  { print -P "%F{red}  ✗%f $1"; exit 1; }

step "Updating repo (branch: main)"
git checkout -q main && git pull -q --ff-only
ok "$(git log -1 --format='%h %s' | head -c 70)"

step "Installing dependencies"
npm install --silent >/dev/null 2>&1 || npm install
ok "node_modules ready"

step "Checking .env.local"
touch .env.local
for key in NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY; do
  grep -q "^${key}=" .env.local || die "$key missing from .env.local — copy it from the working Mini env (the sync scripts use it) and re-run"
done
ok "Supabase keys present"

if ! grep -q "^BLOB_READ_WRITE_TOKEN=" .env.local; then
  step "Fetching BLOB_READ_WRITE_TOKEN from Vercel (may open a browser login)"
  TMPENV="$(mktemp)"
  npx vercel env pull "$TMPENV" --environment=production >/dev/null
  grep "^BLOB_READ_WRITE_TOKEN=" "$TMPENV" >> .env.local || { rm -f "$TMPENV"; die "token not found in Vercel env"; }
  rm -f "$TMPENV"
  ok "token added to .env.local"
else
  ok "BLOB_READ_WRITE_TOKEN already in .env.local"
fi

step "Smoke-testing the generator (60s — looking for the first chunk upload)"
LOG="$(mktemp)"
( npx tsx scripts/generate-sitemaps-blob.mts >"$LOG" 2>&1 & echo $! > "$LOG.pid" )
SMOKE_PID="$(cat "$LOG.pid")"
passed=""
for i in {1..60}; do
  sleep 1
  if grep -q "wrote l-0.xml" "$LOG"; then passed=1; break; fi
  if grep -q "missing env\|ERROR" "$LOG"; then break; fi
done
kill "$SMOKE_PID" 2>/dev/null || true
if [[ -n "$passed" ]]; then
  ok "generator authenticated and uploaded a chunk"
else
  print "----- last log lines -----"; tail -5 "$LOG"; print "--------------------------"
  die "smoke test failed — see log above"
fi

step "Installing launchd job (nightly 03:30 local)"
NPX_PATH="$(command -v npx)" || die "npx not on PATH"
mkdir -p "$HOME/Library/LaunchAgents"
# Rewrite the repo-committed plist for this machine: working dir + npx path.
sed -e "s|<string>/usr/local/bin/npx</string>|<string>${NPX_PATH}</string>|" \
    -e "s|<string>/Users/jesselafauci/Desktop/lucid-rents</string>|<string>${REPO_DIR}</string>|" \
    "$PLIST_SRC" > "$PLIST_DST"
launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load "$PLIST_DST"
launchctl list | grep -q "$LABEL" || die "launchctl did not register $LABEL"
ok "loaded $LABEL (logs: /tmp/lucidrents-sitemaps.log)"

print
print -P "%F{green}Done.%f The mini now regenerates sitemaps nightly at 03:30."
print "To watch a run:  tail -f /tmp/lucidrents-sitemaps.log"
print "To trigger one now:  launchctl start $LABEL"
