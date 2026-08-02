#!/usr/bin/env bash
# Self-healing wrapper for scripts/backfill-zip-rowwise.mjs.
#
# Designed to be run with nohup + disown so it survives terminal closes,
# session pauses, etc. Loops the node script: if it exits (crash, OOM,
# parent shell dying), waits and respawns. Exits only when every metro
# reports < 50 null-zip-with-coords rows.
#
# Usage:
#   source .env.local
#   nohup bash scripts/backfill-zip-self-healing.sh > /tmp/backfill-watchdog.log 2>&1 &
#   disown

set -u

if [[ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "[watchdog] missing env" >&2
  exit 1
fi

count_metro() {
  local metro="$1"
  curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
       -H "Prefer: count=exact" -H "Range: 0-0" \
       "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/buildings?zip_code=is.null&latitude=not.is.null&metro=eq.$metro&select=id" \
       -D /tmp/sh-headers-$metro.txt -o /dev/null --max-time 60 2>/dev/null
  grep -oE "content-range:.*/[0-9]+$" /tmp/sh-headers-$metro.txt 2>/dev/null | grep -oE "[0-9]+$" || echo "?"
}

all_done() {
  for m in nyc miami los-angeles houston chicago; do
    local c
    c=$(count_metro "$m")
    if [[ "$c" =~ ^[0-9]+$ ]] && [[ "$c" -lt 50 ]]; then
      continue
    fi
    return 1
  done
  return 0
}

iter=0
while true; do
  iter=$((iter + 1))
  echo "[$(date +%Y-%m-%dT%H:%M:%S) iter=$iter] starting node"

  # Run the node script. Pipe stdout to a per-run log + the global log.
  node scripts/backfill-zip-rowwise.mjs 2>&1
  rc=$?
  echo "[$(date +%Y-%m-%dT%H:%M:%S) iter=$iter] node exited rc=$rc"

  # Check if we're actually done
  if all_done; then
    echo "[$(date +%Y-%m-%dT%H:%M:%S)] all metros < 50 — backfill complete"
    exit 0
  fi

  # Not done — back off and respawn. 30s gives Postgres time to recover.
  echo "[$(date +%Y-%m-%dT%H:%M:%S)] not done — sleeping 30s before respawn"
  sleep 30
done
