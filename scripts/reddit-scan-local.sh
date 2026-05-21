#!/usr/bin/env bash
# Wrapper for scripts/scan-and-draft-reddit.mjs intended to be run from the
# user's Mac (Reddit blocks Vercel + GitHub Actions egress, so the scanner
# has to run from a residential IP).
#
# Sources .env.local from the repo root, defaults BASE_URL, then invokes the
# Node script. Used by:
#   - ~/Library/LaunchAgents/com.lucidrents.reddit-scan.plist (every 6h)
#   - The /reddit-scan skill (manual)
#
# Logs go to stdout — launchd captures them per the plist's StandardOutPath.

set -euo pipefail

# Resolve repo root regardless of where this script is invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

if [ -f ".env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source ".env.local"
  set +a
fi

export BASE_URL="${BASE_URL:-https://lucidrents.com}"

if [ -z "${CRON_SECRET:-}" ]; then
  echo "[reddit-scan-local] FATAL: CRON_SECRET not set in .env.local" >&2
  exit 1
fi

NODE_BIN="${NODE_BIN:-/opt/homebrew/bin/node}"
if [ ! -x "$NODE_BIN" ]; then
  NODE_BIN="$(command -v node || true)"
fi
if [ -z "$NODE_BIN" ]; then
  echo "[reddit-scan-local] FATAL: no node binary found" >&2
  exit 1
fi

echo "[reddit-scan-local] $(date -u +%Y-%m-%dT%H:%M:%SZ) starting (BASE_URL=$BASE_URL)"
"$NODE_BIN" scripts/scan-and-draft-reddit.mjs "$@"
echo "[reddit-scan-local] $(date -u +%Y-%m-%dT%H:%M:%SZ) done"
