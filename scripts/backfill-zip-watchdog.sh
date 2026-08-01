#!/usr/bin/env bash
# Watchdog wrapper for scripts/backfill-zip-from-centroid.mjs.
#
# Pass --metro=<metro> to run only that metro. Without it, all 5 metros run
# sequentially. The watchdog restarts the node script whenever it exits
# without printing "All metros done." (or "done. total" for single-metro
# mode) — robust against transient timeouts and Cloudflare 524s.
#
# Usage:
#   source .env.local && bash scripts/backfill-zip-watchdog.sh
#   source .env.local && bash scripts/backfill-zip-watchdog.sh --metro=chicago

set -u

METRO_ARG=""
METRO=""
for a in "$@"; do
  case "$a" in
    --metro=*) METRO="${a#--metro=}"; METRO_ARG="$a";;
  esac
done

if [[ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "[watchdog${METRO:+ $METRO}] ERROR: missing env. source .env.local first." >&2
  exit 1
fi

TAG="watchdog${METRO:+ $METRO}"

count_metro_remaining() {
  local metro="$1"
  curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
       -H "Prefer: count=exact" \
       -H "Range: 0-0" \
       "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/buildings?zip_code=is.null&latitude=not.is.null&metro=eq.$metro&select=id" \
       -D /tmp/watchdog-headers-$metro.txt -o /dev/null \
       --max-time 60 2>/dev/null
  local r
  r=$(grep -oE "content-range:.*/[0-9]+$" /tmp/watchdog-headers-$metro.txt 2>/dev/null | grep -oE "[0-9]+$")
  echo "${r:-?}"
}

iter=0
while true; do
  iter=$((iter + 1))

  if [[ -n "$METRO" ]]; then
    r=$(count_metro_remaining "$METRO")
    echo "[$TAG $(date +%H:%M:%S) iter=$iter] remaining=$r"
    if [[ "$r" =~ ^[0-9]+$ ]] && [[ "$r" -lt 100 ]]; then
      echo "[$TAG DONE] remaining=$r (< 100) at $(date +%H:%M:%S)"
      exit 0
    fi
  else
    chi=$(count_metro_remaining chicago)
    hou=$(count_metro_remaining houston)
    la=$(count_metro_remaining los-angeles)
    mia=$(count_metro_remaining miami)
    nyc=$(count_metro_remaining nyc)
    echo "[$TAG $(date +%H:%M:%S) iter=$iter] chicago=$chi houston=$hou la=$la miami=$mia nyc=$nyc"
    done_count=0
    for v in "$chi" "$hou" "$la" "$mia" "$nyc"; do
      if [[ "$v" =~ ^[0-9]+$ ]] && [[ "$v" -lt 100 ]]; then
        done_count=$((done_count + 1))
      fi
    done
    if [[ $done_count -ge 5 ]]; then
      echo "[$TAG DONE] all metros < 100 at $(date +%H:%M:%S)"
      exit 0
    fi
  fi

  log_file=$(mktemp -t watchdog-run.XXXXXXXX) || log_file=/tmp/watchdog-run-$$-$iter.log
  if [[ -n "$METRO_ARG" ]]; then
    node scripts/backfill-zip-from-centroid.mjs "$METRO_ARG" 2>&1 | tee "$log_file"
  else
    node scripts/backfill-zip-from-centroid.mjs 2>&1 | tee "$log_file"
  fi
  rc=$?
  done_marker=$(tail -5 "$log_file" | grep -oE "All metros done\.|done\. total:" | head -1)
  rm -f "$log_file"
  if [[ -n "$done_marker" ]] && [[ -n "$METRO" ]]; then
    # Single-metro mode: node already printed "done. total: NNN" — verify count is low
    r=$(count_metro_remaining "$METRO")
    if [[ "$r" =~ ^[0-9]+$ ]] && [[ "$r" -lt 100 ]]; then
      echo "[$TAG DONE] node reported done, remaining=$r at $(date +%H:%M:%S)"
      exit 0
    fi
  elif [[ "$done_marker" == "All metros done." ]]; then
    echo "[$TAG DONE] node reported 'All metros done.' at $(date +%H:%M:%S)"
    exit 0
  fi
  echo "[$TAG $(date +%H:%M:%S)] node exited rc=$rc — sleeping 60s then respawning"
  sleep 60
done
