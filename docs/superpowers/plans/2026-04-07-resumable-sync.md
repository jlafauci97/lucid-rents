# Resumable Cursor-Based Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix daily sync failures by adding cursor-based resumption, self-chaining, and crash-safe logging so syncs never fall behind again.

**Architecture:** Add a `sync_cursors` table for tracking position. Wrap all 34 sync functions in a `runWithCursor()` helper that manages sync_log lifecycle, saves cursor after each batch, and self-chains on partial completion. Bump edge function timeout to 300s.

**Tech Stack:** Supabase Edge Functions (Deno), PostgreSQL, SODA/ArcGIS APIs

**Spec:** `docs/superpowers/specs/2026-04-07-resumable-sync-design.md`

---

## Task 0: One-Time Backlog Drain Script

**Files:**
- Create: `scripts/drain-sync-backlog.mjs`

This is a local Node.js script (not deployed) that clears accumulated data debt by fetching directly from source APIs and upserting into Supabase with no time limit.

- [ ] **Step 1: Create the drain script skeleton**

```js
// scripts/drain-sync-backlog.mjs
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PAGE_SIZE = 5000;
const BATCH_SIZE = 500;

// Sources to drain with their last-success dates (from sync_log query on 2026-04-07):
const BACKLOG = {
  dob_permits:       { since: "2026-03-19", endpoint: "ic3t-wcy2", dateField: "filing_date",    table: "dob_permits",    uniqueKey: "job_filing_number" },
  la_311_complaints: { since: "2026-03-25", endpoint: null, /* ArcGIS */                         table: "complaints_311", uniqueKey: "unique_key" },
  evictions:         { since: "2026-03-25", endpoint: "6z8x-wfk4", dateField: "executed_date",   table: "evictions",      uniqueKey: "court_index_number" },
  chicago_crimes:    { since: "2026-03-27", endpoint: null, /* Chicago Socrata */                 table: "crime_incidents", uniqueKey: "unique_key" },
  hpd_violations:    { since: "2026-04-02", endpoint: "wvxf-dwi5", dateField: "inspectiondate",  table: "hpd_violations", uniqueKey: "violation_id" },
  la_permits:        { since: "2026-04-05", endpoint: null, /* LA open data */                    table: "dob_permits",    uniqueKey: "job_filing_number" },
  miami_unsafe:      { since: "2020-01-01", endpoint: null, /* ArcGIS */                          table: "miami_unsafe_structures", uniqueKey: "case_number" },
};

async function drainSodaSource(name, config) {
  console.log(`\n=== Draining ${name} (since ${config.since}) ===`);
  const appToken = process.env.NYC_OPEN_DATA_APP_TOKEN;
  let offset = 0;
  let totalAdded = 0;

  while (true) {
    const where = `${config.dateField} > '${config.since}'`;
    let url = `https://data.cityofnewyork.us/resource/${config.endpoint}.json`
      + `?$where=${encodeURIComponent(where)}`
      + `&$limit=${PAGE_SIZE}&$offset=${offset}`
      + `&$order=${encodeURIComponent(config.dateField + " ASC")}`;
    if (appToken) url += `&$$app_token=${appToken}`;

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  API error at offset ${offset}: ${res.status}`);
      break;
    }
    const records = await res.json();
    if (records.length === 0) break;

    // Transform and upsert — reuse the same row mapping as the edge function
    // (This will be filled in per-source in the actual implementation)
    console.log(`  Fetched ${records.length} records at offset ${offset}`);

    offset += PAGE_SIZE;
    totalAdded += records.length;

    // Brief pause to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`  Done: ${totalAdded} total records processed`);
}

// Entry point
const sourceName = process.argv[2];
if (!sourceName || !BACKLOG[sourceName]) {
  console.log(`Usage: node scripts/drain-sync-backlog.mjs <source>`);
  console.log(`Sources: ${Object.keys(BACKLOG).join(", ")}`);
  process.exit(1);
}

const config = BACKLOG[sourceName];
if (config.endpoint) {
  await drainSodaSource(sourceName, config);
} else {
  console.log(`${sourceName} uses a non-SODA API — implement per-source drain function`);
}
```

NOTE: The actual row transformation logic for each source should be copied from the corresponding sync function in `supabase/functions/sync/index.ts`. Each source has its own field mapping. The implementer should read the existing sync function for the source they're draining and replicate the `.map()` transform.

- [ ] **Step 2: Implement per-source transform functions**

For each of the 7 backlogged sources, copy the row mapping from the corresponding sync function in `index.ts`:
- `hpd_violations` → lines 794-829
- `evictions` → lines 1575-1593
- `dob_permits` → lines 1878-1917 (uses `filing_date` ordering)
- `la_311_complaints` → uses LA Open Data ArcGIS API, lines 2226-2273
- `chicago_crimes` → uses Chicago Socrata, lines 3003-3049
- `la_permits` → uses LA building permits ArcGIS, lines 2458-2499
- `miami_unsafe` → uses Miami ArcGIS, lines 3570-3609

For ArcGIS sources, implement `drainArcGISSource()` using the same URL pattern as the edge function.

- [ ] **Step 3: Run the drain for each backlogged source**

Run each one sequentially (or in parallel terminals):
```bash
node scripts/drain-sync-backlog.mjs hpd_violations
node scripts/drain-sync-backlog.mjs evictions
node scripts/drain-sync-backlog.mjs dob_permits
node scripts/drain-sync-backlog.mjs la_311_complaints
node scripts/drain-sync-backlog.mjs chicago_crimes
node scripts/drain-sync-backlog.mjs la_permits
node scripts/drain-sync-backlog.mjs miami_unsafe
```

- [ ] **Step 4: Insert fresh sync_log success entries**

After each drain completes, insert a sync_log entry so `getLastSyncDate()` returns today:
```sql
INSERT INTO sync_log (sync_type, status, records_added, completed_at)
VALUES
  ('hpd_violations', 'completed', 0, NOW()),
  ('evictions', 'completed', 0, NOW()),
  ('dob_permits', 'completed', 0, NOW()),
  ('la_311_complaints', 'completed', 0, NOW()),
  ('chicago_crimes', 'completed', 0, NOW()),
  ('la_permits', 'completed', 0, NOW()),
  ('miami_unsafe', 'completed', 0, NOW());
```

---

## Task 1: Create `sync_cursors` Migration

**Files:**
- Create: `supabase/migrations/20260407000000_sync_cursors.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260407000000_sync_cursors.sql
CREATE TABLE IF NOT EXISTS sync_cursors (
  sync_type TEXT PRIMARY KEY,
  cursor_value TEXT NOT NULL,
  cursor_offset INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sync_cursors IS 'Tracks resumable position for each sync source so partial runs can continue where they left off';
COMMENT ON COLUMN sync_cursors.cursor_value IS 'Last processed date (ISO) or offset depending on API type';
COMMENT ON COLUMN sync_cursors.cursor_offset IS 'Page offset within the current cursor_value date range';

-- RLS: only service role needs access
ALTER TABLE sync_cursors ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Apply the migration**

```bash
supabase db push
```
Or apply via MCP:
```sql
CREATE TABLE IF NOT EXISTS sync_cursors (
  sync_type TEXT PRIMARY KEY,
  cursor_value TEXT NOT NULL,
  cursor_offset INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE sync_cursors ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260407000000_sync_cursors.sql
git commit -m "feat: add sync_cursors table for resumable syncs"
```

---

## Task 2: Add Cursor Helpers and Updated SyncResult Type

**Files:**
- Modify: `supabase/functions/sync/index.ts` (lines 725-730 for SyncResult, add new functions after line 230)

- [ ] **Step 1: Update SyncResult interface**

At line 725, replace the existing interface:

```ts
interface CursorState {
  cursorValue: string;   // ISO date or offset string
  cursorOffset: number;  // page offset within range
}

interface SyncResult {
  totalAdded: number;
  totalLinked: number;
  errors: string[];
  affectedBuildingIds: Set<string>;
  timeBudgetExceeded?: boolean;
  newCursor?: CursorState;
}
```

- [ ] **Step 2: Add cursor read/write helpers**

Insert after `finalizeSyncLog` (after line 230):

```ts
/** Read the saved cursor for a sync type. Returns null if none exists. */
async function getCursor(
  supabase: SupabaseClient,
  syncType: string
): Promise<CursorState | null> {
  const { data } = await supabase
    .from("sync_cursors")
    .select("cursor_value, cursor_offset")
    .eq("sync_type", syncType)
    .single();

  if (!data) return null;
  return { cursorValue: data.cursor_value, cursorOffset: data.cursor_offset };
}

/** Save/update cursor position. Called after each batch for crash safety. */
async function saveCursor(
  supabase: SupabaseClient,
  syncType: string,
  cursor: CursorState
): Promise<void> {
  await supabase
    .from("sync_cursors")
    .upsert({
      sync_type: syncType,
      cursor_value: cursor.cursorValue,
      cursor_offset: cursor.cursorOffset,
      updated_at: new Date().toISOString(),
    }, { onConflict: "sync_type" });
}

/** Clear cursor when sync completes all available data. */
async function clearCursor(
  supabase: SupabaseClient,
  syncType: string
): Promise<void> {
  await supabase
    .from("sync_cursors")
    .delete()
    .eq("sync_type", syncType);
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/sync/index.ts
git commit -m "feat: add CursorState type and cursor CRUD helpers"
```

---

## Task 3: Add `runWithCursor` Wrapper

**Files:**
- Modify: `supabase/functions/sync/index.ts` (insert after cursor helpers)

- [ ] **Step 1: Write the runWithCursor function**

```ts
const MAX_CHAIN_DEPTH = 10;

/**
 * Wraps a sync function with cursor management, crash-safe logging, and self-chaining.
 * The sync function receives a start date (from cursor or getLastSyncDate fallback)
 * and the global sync start time for time budget checks.
 */
async function runWithCursor(
  supabase: SupabaseClient,
  syncType: string,
  syncLogType: string,
  syncFn: (startDate: string, syncStartMs: number) => Promise<SyncResult>,
  chainDepth: number = 0,
  sinceOverride?: string,
): Promise<SyncResult> {
  // Race condition guard: skip if another run is active or a chain is in progress
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: activeRuns } = await supabase
    .from("sync_log")
    .select("id, status, started_at")
    .eq("sync_type", syncLogType)
    .in("status", ["running", "partial"])
    .gte("started_at", fiveMinAgo)
    .limit(1);

  if (activeRuns && activeRuns.length > 0) {
    const activeStatus = activeRuns[0].status;
    return {
      totalAdded: 0,
      totalLinked: 0,
      errors: [`Skipped: ${syncLogType} has a recent "${activeStatus}" entry (chain in progress or already running)`],
      affectedBuildingIds: new Set(),
    };
  }

  // Determine start position: sinceOverride > cursor > getLastSyncDate
  let startDate: string;
  if (sinceOverride) {
    startDate = sinceOverride;
  } else {
    const cursor = await getCursor(supabase, syncLogType);
    if (cursor) {
      startDate = cursor.cursorValue;
    } else {
      startDate = await getLastSyncDate(supabase, syncLogType);
    }
  }

  const logId = await createSyncLog(supabase, syncLogType);
  const syncStartMs = Date.now();

  let result: SyncResult;
  try {
    result = await syncFn(startDate, syncStartMs);
  } catch (err) {
    // Crash-safe: always finalize log even on error
    await finalizeSyncLog(supabase, logId, "failed", 0, 0, [String(err)]).catch(() => {});
    return {
      totalAdded: 0,
      totalLinked: 0,
      errors: [`${syncLogType} fatal error: ${String(err)}`],
      affectedBuildingIds: new Set(),
    };
  }

  // Save or clear cursor
  if (result.timeBudgetExceeded && result.newCursor) {
    await saveCursor(supabase, syncLogType, result.newCursor);
  } else {
    await clearCursor(supabase, syncLogType);
  }

  // Finalize log
  const status = result.timeBudgetExceeded ? "partial" : "completed";
  await finalizeSyncLog(supabase, logId, status, result.totalAdded, result.totalLinked, result.errors);

  // Self-chain on partial if under max depth
  if (result.timeBudgetExceeded && chainDepth < MAX_CHAIN_DEPTH) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (supabaseUrl && cronSecret) {
      fetch(`${supabaseUrl}/functions/v1/sync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cronSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ source: syncType, chainDepth: chainDepth + 1 }),
      }).catch((err) => console.error(`Self-chain failed for ${syncType}:`, err));
    }
  }

  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/sync/index.ts
git commit -m "feat: add runWithCursor wrapper with crash safety and self-chaining"
```

---

## Task 4: Update Constants and Time Budget

**Files:**
- Modify: `supabase/functions/sync/index.ts` (lines 28-31)

- [ ] **Step 1: Update constants**

Replace lines 28-31:

```ts
const MAX_PAGES = 10; // Safety limit: max API pages per sync
const SYNC_TIME_BUDGET_MS = 240_000; // Stop fetching new pages after 240s to leave buffer before 300s edge function limit
const STALE_SYNC_MINUTES = 30; // Mark "running" syncs older than this as "failed"
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/sync/index.ts
git commit -m "feat: bump sync time budget to 240s for 300s edge function limit"
```

---

## Task 5: Refactor NYC Sync Functions (HPD, 311, Litigations, DOB, NYPD, Bedbugs, Evictions, Sheds, Permits)

**Files:**
- Modify: `supabase/functions/sync/index.ts` (lines 756-1940)

This is the largest task. Each NYC sync function needs:
1. Remove internal `createSyncLog` / `finalizeSyncLog` calls
2. Accept `startDate` and `syncStartMs` params instead of calling `getLastSyncDate`
3. Add `isTimeBudgetExceeded(syncStartMs)` to while loop if missing
4. Track and return `timeBudgetExceeded` flag and `newCursor`

**The pattern is the same for all functions.** Here's HPD violations as the template:

- [ ] **Step 1: Refactor `syncHPDViolations`** (line 756)

Change signature from:
```ts
async function syncHPDViolations(supabase: SupabaseClient, sinceOverride?: string): Promise<SyncResult> {
```
To:
```ts
async function syncHPDViolations(supabase: SupabaseClient, startDate: string, syncStartMs: number): Promise<SyncResult> {
```

Remove these lines inside the function:
- `const lastSync = sinceOverride || await getLastSyncDate(supabase, "hpd_violations");`
- `const logId = await createSyncLog(supabase, "hpd_violations");`
- `const syncStartTime = new Date().toISOString();`
- `await finalizeSyncLog(supabase, logId, "completed", ...);` (in try block)
- `await finalizeSyncLog(supabase, logId, "failed", ...);` (in catch block)

Replace with:
- Use `startDate` parameter directly instead of `lastSync`
- Add `const syncStartTime = new Date().toISOString();` (keep this — it's used for linking)
- Add tracking variables at top: `let timeBudgetExceeded = false; let lastRecordDate = startDate;`

Change the while loop termination (line 834) from:
```ts
if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES) {
  hasMore = false;
} else {
  offset += PAGE_SIZE;
}
```
To:
```ts
// Track last record date for cursor
if (records.length > 0) {
  const lastRecord = records[records.length - 1];
  if (lastRecord.inspectiondate) lastRecordDate = lastRecord.inspectiondate.slice(0, 10);
}

pagesFetched++;
if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES) {
  hasMore = false;
} else if (isTimeBudgetExceeded(syncStartMs)) {
  timeBudgetExceeded = true;
  errors.push(`HPD: time budget exceeded after ${pagesFetched} pages`);
  hasMore = false;
} else {
  offset += PAGE_SIZE;
}

// Save cursor after each batch for crash safety
await saveCursor(supabase, "hpd_violations", { cursorValue: lastRecordDate, cursorOffset: offset });
```

Skip linking if `timeBudgetExceeded` (wrap existing linking block):
```ts
if (!timeBudgetExceeded) {
  try {
    const linkResult = await linkByBbl(supabase, "hpd_violations", syncStartTime, errors, "HPD", true);
    totalLinked = linkResult.linked;
    for (const id of linkResult.affectedBuildingIds) affectedBuildingIds.add(id);
  } catch (linkErr) {
    errors.push(`HPD linking phase error: ${String(linkErr)}`);
  }
}
```

Remove the outer try/catch that calls `finalizeSyncLog` — `runWithCursor` handles this now.

Return with cursor:
```ts
return {
  totalAdded,
  totalLinked,
  errors,
  affectedBuildingIds,
  timeBudgetExceeded,
  newCursor: timeBudgetExceeded ? { cursorValue: lastRecordDate, cursorOffset: offset } : undefined,
};
```

- [ ] **Step 2: Apply the same pattern to remaining NYC sync functions**

Apply the identical refactor pattern to each function. The only differences per function are:
- The date field name used for `lastRecordDate` tracking
- The `syncLogType` string and label in error messages

| Function | Line | Date field for cursor | Sync log type | Has `isTimeBudgetExceeded`? |
|----------|------|-----------------------|---------------|---------------------------|
| `sync311Complaints` | 878 | `created_date` | `complaints_311` | Has own 35s budget — replace with global |
| `syncHPDLitigations` | 1043 | `caseopendate` | `hpd_litigations` | No — add |
| `syncDOBViolations` | 1152 | `issue_date` | `dob_violations` | No — add |
| `syncNYPDComplaints` | 1276 | `cmplnt_fr_dt` | `nypd_complaints` | Yes |
| `syncBedBugReports` | 1426 | `filing_date` | `bedbug_reports` | No — add |
| `syncEvictions` | 1537 | `executed_date` | `evictions` | No — add |
| `syncSidewalkSheds` | 1720 | `permit_issuance_date` | `sidewalk_sheds` | No — add |
| `syncDobPermits` | 1843 | `filing_date` | `dob_permits` | Yes |

For `sync311Complaints`: Remove the hardcoded 35s time budget (`Date.now() - fnStart > 35_000`) and replace with the standard `isTimeBudgetExceeded(syncStartMs)` check.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/sync/index.ts
git commit -m "refactor: NYC sync functions to support cursor-based resumption"
```

---

## Task 6: Refactor LA Sync Functions

**Files:**
- Modify: `supabase/functions/sync/index.ts` (lines 2143-2860)

Same pattern as Task 5. LA functions already have `isTimeBudgetExceeded`.

- [ ] **Step 1: Refactor all LA sync functions**

| Function | Line | Date field | Sync log type |
|----------|------|-----------|---------------|
| `syncLAHDViolations` | 2143 | date field from API | `lahd_violations` |
| `syncLA311Complaints` | 2217 | `created_date` | `la_311_complaints` |
| `syncLADBSViolations` | 2296 | date field | `ladbs_violations` |
| `syncLAPDCrimeData` | 2371 | date field | `lapd_crimes` |
| `syncLAPermits` | 2449 | date field | `la_permits` |
| `syncLASoftStory` | 2522 | (full refresh) | `la_soft_story` |
| `syncLAHDEvictions` | 2574 | date field | `lahd_evictions` |
| `syncLAHDTenantBuyouts` | 2646 | date field | `lahd_tenant_buyouts` |
| `syncLAHDCCRIS` | 2707 | date field | `lahd_ccris` |
| `syncLAHDViolationSummary` | 2771 | date field | `lahd_violation_summary` |

**Special cases:**
- `syncLASoftStory` (full refresh, no date filter): Does a full table replace, so cursor-based resumption doesn't apply the same way. Keep it as-is but still remove sync_log management and let `runWithCursor` handle it. Use offset as the cursor.
- `syncLAHDViolationSummary`: Also a full-refresh function (no `getLastSyncDate` call). Same treatment as `syncLASoftStory` — remove sync_log calls, accept params, use offset cursor.

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/sync/index.ts
git commit -m "refactor: LA sync functions to support cursor-based resumption"
```

---

## Task 7: Refactor Chicago Sync Functions

**Files:**
- Modify: `supabase/functions/sync/index.ts` (lines 2867-3245)

- [ ] **Step 1: Refactor all Chicago sync functions**

| Function | Line | Sync log type |
|----------|------|---------------|
| `syncChicagoViolations` | 2867 | `chicago_violations` |
| `syncChicago311` | 2930 | `chicago_311` |
| `syncChicagoCrimes` | 2994 | `chicago_crimes` |
| `syncChicagoPermits` | 3069 | `chicago_permits` |
| `syncChicagoRLTO` | 3136 | `chicago_rlto` |
| `syncChicagoLead` | 3197 | `chicago_lead` |

All already have `isTimeBudgetExceeded`. Apply the standard refactor pattern.

**Special case:** `syncChicagoLead` is a disabled stub — it immediately returns with a "disabled" message. Just remove its internal sync_log calls and let `runWithCursor` handle it. No cursor logic needed.

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/sync/index.ts
git commit -m "refactor: Chicago sync functions to support cursor-based resumption"
```

---

## Task 8: Refactor Miami Sync Functions

**Files:**
- Modify: `supabase/functions/sync/index.ts` (lines 3249-3700)

- [ ] **Step 1: Refactor all Miami sync functions**

| Function | Line | Sync log type |
|----------|------|---------------|
| `syncMiamiViolations` | 3249 | `miami_violations` |
| `syncMiami311` | 3323 | `miami_311` |
| `syncMiamiCrimes` | 3394 | `miami_crimes` |
| `syncMiamiPermits` | 3485 | `miami_permits` |
| `syncMiamiUnsafeStructures` | 3561 | `miami_unsafe` |
| `syncMiamiRecertifications` | 3632 | `miami_recerts` |

**Special case:** `syncMiamiRecertifications` is a disabled stub (data source unavailable). Just remove its internal sync_log calls. No cursor logic needed.

These use ArcGIS APIs. The cursor `cursorValue` for these should be the ArcGIS `resultOffset` as a string (not a date), since ArcGIS pagination is offset-based.

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/sync/index.ts
git commit -m "refactor: Miami sync functions to support cursor-based resumption"
```

---

## Task 9: Refactor Houston Sync Functions

**Files:**
- Modify: `supabase/functions/sync/index.ts` (lines 3709-3940)

- [ ] **Step 1: Refactor all Houston sync functions**

| Function | Line | Sync log type |
|----------|------|---------------|
| `syncHoustonViolations` | 3709 | `houston_violations` |
| `syncHouston311` | 3780 | `houston_311` |
| `syncHoustonCrimes` | 3851 | `houston_crimes` |

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/sync/index.ts
git commit -m "refactor: Houston sync functions to support cursor-based resumption"
```

---

## Task 10: Update SOURCES Map and Main Handler

**Files:**
- Modify: `supabase/functions/sync/index.ts` (lines 3950-4330)

- [ ] **Step 1: Update SOURCES map type signature**

The SOURCES map currently has type:
```ts
Record<string, (supabase: SupabaseClient, sinceOverride?: string) => Promise<SyncResult>>
```

Change to:
```ts
Record<string, (supabase: SupabaseClient, startDate: string, syncStartMs: number) => Promise<SyncResult>>
```

Also create a mapping from source param name to sync_log type (they differ for some sources):
```ts
const SOURCE_LOG_TYPES: Record<string, string> = {
  hpd: "hpd_violations",
  complaints: "complaints_311",
  litigations: "hpd_litigations",
  dob: "dob_violations",
  nypd: "nypd_complaints",
  bedbugs: "bedbug_reports",
  evictions: "evictions",
  sheds: "sidewalk_sheds",
  permits: "dob_permits",
  lahd: "lahd_violations",
  "la-311": "la_311_complaints",
  ladbs: "ladbs_violations",
  lapd: "lapd_crime",
  "la-permits": "la_permits",
  "la-soft-story": "la_soft_story",
  "la-evictions": "lahd_evictions",
  "la-buyouts": "lahd_tenant_buyouts",
  "la-ccris": "lahd_ccris",
  "la-violation-summary": "lahd_violation_summary",
  "chicago-violations": "chicago_violations",
  "chicago-311": "chicago_311",
  "chicago-crimes": "chicago_crimes",
  "chicago-permits": "chicago_permits",
  "chicago-rlto": "chicago_rlto",
  "chicago-lead": "chicago_lead",
  "miami-violations": "miami_violations",
  "miami-311": "miami_311",
  "miami-crimes": "miami_crimes",
  "miami-permits": "miami_permits",
  "miami-unsafe": "miami_unsafe",
  "miami-recerts": "miami_recerts",
  "houston-violations": "houston_violations",
  "houston-311": "houston_311",
  "houston-crimes": "houston_crimes",
};
```

- [ ] **Step 2: Update main handler to use `runWithCursor`**

Parse `chainDepth` from request body (add after line 4206):
```ts
const chainDepth = body.chainDepth || 0;
```

Replace the sync execution loop (lines 4242-4252) from:
```ts
for (const [name, syncFn] of sourcesToRun) {
  const result = await syncFn(supabase, sinceOverride);
  results[name] = result;
  for (const id of result.affectedBuildingIds) {
    allAffectedIds.add(id);
  }
}
```

To:
```ts
for (const [name, syncFn] of sourcesToRun) {
  const logType = SOURCE_LOG_TYPES[name] || name;
  const result = await runWithCursor(
    supabase,
    name,       // source param for self-chaining
    logType,    // sync_log type
    (startDate, syncStartMs) => syncFn(supabase, startDate, syncStartMs),
    chainDepth,
    sinceOverride,
  );
  results[name] = result;
  for (const id of result.affectedBuildingIds) {
    allAffectedIds.add(id);
  }
}
```

- [ ] **Step 3: Skip slug backfill and revalidation on partial/chained runs**

Wrap the slug backfill and revalidation blocks (lines 4257-4285) in a check:
```ts
const anyPartial = Object.values(results).some(r => r.timeBudgetExceeded);
const isChainedRun = chainDepth > 0;

if (!anyPartial && !isChainedRun) {
  // Slug backfill...
  // Revalidation...
  // IndexNow...
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/sync/index.ts
git commit -m "feat: wire up runWithCursor in main handler with self-chaining support"
```

---

## Task 11: Deploy with Increased Timeout

- [ ] **Step 1: Deploy the edge function with 300s wall clock**

```bash
supabase functions deploy sync --no-verify-jwt
```

Then set the execution time limit to 300s in the Supabase dashboard:
Dashboard → Edge Functions → sync → Settings → Execution time limit → 300s

(Alternatively, if `supabase functions deploy` supports `--wall-clock-limit`, use that flag.)

- [ ] **Step 2: Verify deployment**

Trigger a small sync to confirm everything works:
```bash
curl -X POST "$SUPABASE_URL/functions/v1/sync" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"source": "litigations"}'
```

Check sync_log for a successful entry.

- [ ] **Step 3: Trigger each previously-failing sync and verify chaining**

```bash
# These should now self-chain if they hit the time budget
curl -X POST "$SUPABASE_URL/functions/v1/sync" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"source": "hpd"}'
```

Monitor sync_log for `"partial"` → `"partial"` → `"completed"` chain.

- [ ] **Step 4: Commit any config files if needed**

```bash
git add -A && git commit -m "chore: deploy sync function with 300s timeout"
```

---

## Task 12: Verify All Syncs Healthy

- [ ] **Step 1: Wait for next daily cron cycle and check sync_log**

```sql
SELECT sync_type, status, records_added, started_at, completed_at,
       EXTRACT(EPOCH FROM (completed_at::timestamp - started_at::timestamp))::int as duration_sec
FROM sync_log
WHERE started_at >= NOW() - INTERVAL '24 hours'
ORDER BY started_at DESC;
```

**Expected:** All syncs show `"completed"` or `"partial"` (never stuck `"running"` or `"failed"` from stale timeout). Partial runs should be followed by chained completions.

- [ ] **Step 2: Verify no data gaps**

```sql
-- Check each source has recent data
SELECT 'hpd_violations' as source, MAX(imported_at) as latest FROM hpd_violations
UNION ALL SELECT 'dob_violations', MAX(imported_at) FROM dob_violations
UNION ALL SELECT 'complaints_311', MAX(imported_at) FROM complaints_311 WHERE metro = 'nyc'
UNION ALL SELECT 'evictions', MAX(imported_at) FROM evictions
UNION ALL SELECT 'dob_permits', MAX(imported_at) FROM dob_permits WHERE metro = 'nyc'
ORDER BY source;
```

**Expected:** All `latest` dates within last 24-48 hours.

- [ ] **Step 3: Check sync_cursors table is clean**

```sql
SELECT * FROM sync_cursors;
```

**Expected:** Empty (all cursors cleared after successful completion) or only entries for syncs that are mid-chain.
