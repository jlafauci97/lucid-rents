# Resumable Cursor-Based Sync

**Date:** 2026-04-07
**Status:** Approved
**Problem:** 4+ daily syncs consistently crash (HPD violations, evictions, LA 311, DOB permits, Miami unsafe, LA permits) due to exceeding the 150s Supabase edge function limit. Zombie sync_log entries accumulate. Backlog grows daily since failed syncs never catch up.

## Root Cause

The `/sync` edge function has a 150s execution limit (Supabase default, even on paid plan). When syncs fall behind, they need to fetch more pages, exceed the limit, and crash without updating sync_log. The stale cleanup marks them "failed" 30 minutes later. The next daily cron finds even more data to process → death spiral.

## Current Backlog (as of 2026-04-07)

| Sync | Last success | Days behind |
|------|-------------|-------------|
| dob_permits | Mar 19 | 19 days |
| la_311_complaints | Mar 25 | 13 days |
| evictions | Mar 25 | 13 days |
| chicago_crimes | Mar 27 | 11 days |
| hpd_violations | Apr 2 | 5 days |
| la_permits | Apr 5 | 2 days |
| miami_unsafe | never | all-time |

## Design

### 0. One-Time Backlog Drain (Before Deploy)

Clear all accumulated debt so the new system starts clean:

1. Write a local Node script (`scripts/drain-sync-backlog.mjs`) that calls each failing sync's API directly (SODA/ArcGIS) and upserts into Supabase in a loop with no time limit
2. Run for each backlogged source: `hpd`, `evictions`, `la-311`, `dob` (permits), `la-permits`, `miami-unsafe`, `chicago-crimes`
3. After drain completes, update `sync_log` with a successful entry so `getLastSyncDate` returns today
4. This is a one-time operation — the script is not deployed

### 1. `sync_cursors` Table

New table to track resumable position per sync type.

```sql
CREATE TABLE sync_cursors (
  sync_type TEXT PRIMARY KEY,
  cursor_value TEXT NOT NULL,       -- last processed date/offset (ISO string or integer depending on API type)
  cursor_offset INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

- Read before each sync to determine start position
- Falls back to existing `getLastSyncDate` logic if no cursor row exists
- Updated after each batch (not just at end)
- Reset to offset 0 when sync completes all available data
- `cursor_value` is flexible: ISO date for SODA APIs, integer string for ArcGIS `resultOffset` pagination

### 2. Crash-Safe Wrapper with Cursor Support

New `runWithCursor()` function that centralizes sync lifecycle management:

- Reads cursor from `sync_cursors`
- Creates sync_log entry
- Runs the sync function, passing cursor state
- **Saves cursor after each batch** for crash safety
- Finalizes sync_log with status:
  - `"completed"` — all data processed
  - `"partial"` — time budget hit, more data remains
  - `"failed"` — actual error
- On `"partial"`, fires self-chain (see below)

**Important refactor:** Currently each of the 34 sync functions calls `createSyncLog()` and `finalizeSyncLog()` internally. These calls must be **removed** from individual functions and centralized in `runWithCursor()`. Each sync function's signature changes to accept a cursor and return a result — it no longer manages its own sync_log lifecycle.

### 3. Self-Chaining on Partial Completion

When a sync exits with `"partial"` status, it fire-and-forgets a new POST to `/functions/v1/sync` with the same source param. This creates a chain of invocations that drains the backlog without waiting for the next daily cron.

**Self-chain request must include auth:**
```ts
fetch(`${supabaseUrl}/functions/v1/sync`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${Deno.env.get("CRON_SECRET")}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ source: syncType, chainDepth: depth + 1 }),
}).catch(() => {});
```

**Safety guardrails:**
- `chainDepth` counter passed in request body, capped at **10** for daily runs (prevents infinite loops)
- **Race condition prevention:** Before starting, check sync_log for a "running" entry for this sync_type with `started_at` within the last 5 minutes. If found, skip. Also check for "partial" entries within the last 5 minutes (meaning a chain is already in progress) — the daily cron should yield to an active chain.
- Skip linking phase on partial runs — only link on final `"completed"` run
- Max daily chain = 10 invocations x 240s = ~40 minutes continuous processing

### 4. Timeout + Time Budget Bump

- Edge function wall clock: **300s** (up from 150s default, paid Pro plan supports up to 400s)
- `SYNC_TIME_BUDGET_MS`: **240,000ms** (up from 120,000ms)
- Gives 60s buffer between budget and hard kill

### 5. Add `isTimeBudgetExceeded` to All Sync Loops

**Prerequisite for cursor-based early exit.** Several original NYC sync functions (HPD violations, 311 complaints, evictions, DOB violations, bedbugs, sidewalk sheds, HPD litigations) do NOT currently call `isTimeBudgetExceeded()` in their while loops — they only check `PAGE_SIZE` and `MAX_PAGES`. Without this check, these functions cannot exit gracefully when the time budget runs out.

Each sync function's while loop must add:
```ts
if (isTimeBudgetExceeded(syncStartMs)) {
  timeBudgetExceeded = true;
  break;
}
```

### 6. Sync Function Signature Changes

All 34 sync functions in the SOURCES map get mechanical changes:

1. **Remove** internal `createSyncLog()` and `finalizeSyncLog()` calls (centralized in `runWithCursor`)
2. **Accept cursor state** as input (start date + offset)
3. **Return updated cursor** (last record date + offset) alongside existing `SyncResult`
4. **Add `isTimeBudgetExceeded` check** in while loop if missing
5. **Add `timeBudgetExceeded` flag** to return value

The existing while-loop, batch upsert, and API call logic stays unchanged.

### 7. sync_log Status Column

Confirm `sync_log.status` is a free-text column (not an enum/check constraint) so `"partial"` can be added without a migration. If constrained, add `"partial"` to the allowed values.

## Affected Files

- `supabase/functions/sync/index.ts` — all changes happen here:
  - New constants: `SYNC_TIME_BUDGET_MS = 240_000`, `MAX_CHAIN_DEPTH = 10`
  - New functions: `getCursor()`, `saveCursor()`, `runWithCursor()`
  - Modified: all 34 `sync*` functions — remove sync_log calls, accept/return cursor, add time budget check
  - Modified: main handler to pass `chainDepth` and trigger re-invocation on partial
- New migration: `sync_cursors` table
- New script: `scripts/drain-sync-backlog.mjs` (one-time, not deployed)
- Edge function deploy config: 300s wall clock limit

## What This Does NOT Change

- Vercel cron schedules in `vercel.json` — unchanged
- `/api/cron/trigger` route — unchanged
- Standalone edge functions (sync-news, sync-energy, etc.) — unchanged
- Linking logic — unchanged
- Data schemas — unchanged

## Success Criteria

- Zero "stale timeout" failures in sync_log over 7 days
- All syncs show status `"completed"` or `"partial"` (never stuck "running")
- Backlogged syncs fully caught up within 24 hours of deploy
- No data gaps in violation/complaint/eviction tables
