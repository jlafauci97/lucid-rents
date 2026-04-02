# Mission Control Diagnostics & Linking Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Diagnose all data sync and linking failures across all cities using mission control, then fix the root causes so data flows end-to-end (fetch -> link -> building counts).

**Architecture:** Phase 1 queries the database directly to build a diagnostic picture of every sync source and linking pipeline. Phase 2 implements fixes based on findings. Phase 3 adds permanent monitoring to mission control so these issues surface automatically going forward.

**Tech Stack:** Supabase SQL (via MCP or direct queries), Next.js API routes, React dashboard

---

## Phase 1: Diagnostic Audit

### Task 1: Audit Sync Health Across All Cities

**Goal:** Get a complete picture of which syncs are running, failing, or stale.

**Files:**
- Read: `src/app/api/health/route.ts` (sync type definitions)
- Read: `vercel.json` (cron schedules)
- Query: `sync_log` table

- [ ] **Step 1: Query sync_log for latest status of every source**

Run this SQL against Supabase to get the full picture:

```sql
SELECT DISTINCT ON (sync_type)
  sync_type,
  status,
  started_at,
  completed_at,
  records_added,
  records_linked,
  EXTRACT(EPOCH FROM (NOW() - started_at)) / 3600 AS hours_ago,
  array_length(errors, 1) AS error_count,
  errors[1] AS first_error
FROM sync_log
ORDER BY sync_type, started_at DESC;
```

- [ ] **Step 2: Identify problem categories**

Classify each sync into:
- **GREEN**: Ran in last 26 hours, status=completed, records_added > 0
- **YELLOW**: Ran but records_added=0 or records_linked=0 (data pulled but not linking)
- **RED**: status=failed or hasn't run in >26 hours
- **MISSING**: No sync_log entry at all (never ran)

Document findings in a table format.

- [ ] **Step 3: Check for zombie syncs**

```sql
SELECT sync_type, started_at, status
FROM sync_log
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '20 minutes'
ORDER BY started_at DESC;
```

---

### Task 2: Audit Unlinked Records Per City/Source

**Goal:** Quantify the linking gap — how many records exist but aren't connected to buildings.

- [ ] **Step 1: Count unlinked violations per city**

> **IMPORTANT:** LAHD violations (LA) are stored in `hpd_violations` with `metro='los-angeles'`, NOT in `dob_violations`. LADBS violations are in `dob_violations` with `metro='los-angeles'`. Query both tables.

```sql
-- dob_violations: NYC DOB, LADBS, Chicago, Miami, Houston violations
SELECT metro,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE building_id IS NOT NULL) AS linked,
  COUNT(*) FILTER (WHERE building_id IS NULL) AS unlinked,
  ROUND(100.0 * COUNT(*) FILTER (WHERE building_id IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS link_pct
FROM dob_violations
GROUP BY metro
ORDER BY metro;

-- hpd_violations: NYC HPD + LA LAHD violations (shared table, differentiated by metro)
SELECT metro,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE building_id IS NOT NULL) AS linked,
  COUNT(*) FILTER (WHERE building_id IS NULL) AS unlinked,
  ROUND(100.0 * COUNT(*) FILTER (WHERE building_id IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS link_pct
FROM hpd_violations
GROUP BY metro
ORDER BY metro;
```

- [ ] **Step 2: Count unlinked 311 complaints per city**

```sql
SELECT metro,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE building_id IS NOT NULL) AS linked,
  COUNT(*) FILTER (WHERE building_id IS NULL) AS unlinked,
  ROUND(100.0 * COUNT(*) FILTER (WHERE building_id IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS link_pct
FROM complaints_311
GROUP BY metro
ORDER BY metro;
```

- [ ] **Step 3: Count unlinked crime reports per city**

```sql
SELECT metro,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE building_id IS NOT NULL) AS linked,
  COUNT(*) FILTER (WHERE building_id IS NULL) AS unlinked,
  ROUND(100.0 * COUNT(*) FILTER (WHERE building_id IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS link_pct
FROM nypd_complaints
GROUP BY metro
ORDER BY metro;
```

- [ ] **Step 4: Count unlinked permits per city**

```sql
SELECT metro,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE building_id IS NOT NULL) AS linked,
  COUNT(*) FILTER (WHERE building_id IS NULL) AS unlinked,
  ROUND(100.0 * COUNT(*) FILTER (WHERE building_id IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS link_pct
FROM dob_permits
GROUP BY metro
ORDER BY metro;
```

- [ ] **Step 5: Count unlinked NYC-specific + LA-specific tables**

```sql
-- NYC-only tables
SELECT 'hpd_litigations' AS source, 'nyc' AS metro, COUNT(*) AS total, COUNT(*) FILTER (WHERE building_id IS NOT NULL) AS linked FROM hpd_litigations
UNION ALL
SELECT 'bedbug_reports', 'nyc', COUNT(*), COUNT(*) FILTER (WHERE building_id IS NOT NULL) FROM bedbug_reports
UNION ALL
SELECT 'evictions', 'nyc', COUNT(*), COUNT(*) FILTER (WHERE building_id IS NOT NULL) FROM evictions
UNION ALL
SELECT 'sidewalk_sheds', 'nyc', COUNT(*), COUNT(*) FILTER (WHERE building_id IS NOT NULL) FROM sidewalk_sheds
UNION ALL
-- LA-specific tables
SELECT 'lahd_evictions', 'los-angeles', COUNT(*), COUNT(*) FILTER (WHERE building_id IS NOT NULL) FROM lahd_evictions
UNION ALL
SELECT 'lahd_tenant_buyouts', 'los-angeles', COUNT(*), COUNT(*) FILTER (WHERE building_id IS NOT NULL) FROM lahd_tenant_buyouts
UNION ALL
SELECT 'lahd_ccris_cases', 'los-angeles', COUNT(*), COUNT(*) FILTER (WHERE building_id IS NOT NULL) FROM lahd_ccris_cases;
```

- [ ] **Step 6: Document the full linking gap matrix**

Create a table:
| City | Source | Total | Linked | Unlinked | Link % |
|------|--------|-------|--------|----------|--------|

Flag any source with link % < 50% as critical.

---

### Task 3: Diagnose WHY Records Aren't Linking

**Goal:** For each city with low link rates, determine the root cause.

- [ ] **Step 1: Check address quality for unlinked records (sample per city)**

For each city with low link rates, sample 20 unlinked records:

```sql
-- Example for Chicago violations
SELECT violation_id, house_number, street_name, metro
FROM dob_violations
WHERE building_id IS NULL AND metro = 'chicago'
ORDER BY imported_at DESC
LIMIT 20;
```

Check: Are addresses populated? Are they parseable? Do they look like real addresses?

- [ ] **Step 2: Check building coverage per city**

```sql
SELECT metro, COUNT(*) AS building_count
FROM buildings
GROUP BY metro
ORDER BY metro;
```

If a city has 0 buildings, linking will always fail (nothing to match against).

- [ ] **Step 3: Check address format mismatch**

Sample a building address and an unlinked record address for the same city. Compare normalization:

```sql
-- Building addresses
SELECT full_address FROM buildings WHERE metro = 'chicago' LIMIT 5;

-- Unlinked violation addresses
SELECT house_number, street_name FROM dob_violations
WHERE building_id IS NULL AND metro = 'chicago'
LIMIT 5;
```

Look for: case differences, abbreviation mismatches (ST vs STREET), missing components, different address formats.

- [ ] **Step 4: Check BBL linking health (NYC)**

```sql
-- NYC records with BBL but not linked
SELECT COUNT(*) AS unlinked_with_bbl
FROM hpd_violations
WHERE building_id IS NULL AND bbl IS NOT NULL AND bbl ~ '^\d{10}$';

-- NYC records with invalid/missing BBL
SELECT COUNT(*) AS no_valid_bbl
FROM hpd_violations
WHERE building_id IS NULL AND (bbl IS NULL OR bbl !~ '^\d{10}$');
```

- [ ] **Step 5: Check for linking time budget exhaustion**

```sql
SELECT sync_type, started_at, errors
FROM sync_log
WHERE sync_type LIKE '%link%'
  AND EXISTS (SELECT 1 FROM unnest(errors) e WHERE e LIKE '%time budget%')
ORDER BY started_at DESC
LIMIT 10;
```

- [ ] **Step 6: Check for maxLookups cap limiting linking**

> **IMPORTANT:** The `linkByAddress` function has a `maxLookups` parameter (default 200, sometimes 500) that silently caps how many distinct addresses get looked up per sync. This does NOT log a "time budget" error — it just stops. If a city has thousands of unlinked records and the link count per sync is consistently ~200, the cap is the bottleneck, not time budget.

```sql
-- Check if linked counts per sync are suspiciously capped
SELECT sync_type, started_at, records_linked,
  errors[1] AS first_error
FROM sync_log
WHERE sync_type IN ('lahd_violations', 'la_311_complaints', 'chicago_violations', 'chicago_311', 'miami_violations', 'houston_violations')
  AND status = 'completed'
ORDER BY started_at DESC
LIMIT 20;
```

If `records_linked` clusters around 200 or 500, the `maxLookups` cap is binding. The fix is to use the in-memory bulk linking path (`mode=link` cron) instead, which has no per-address lookup cap.

- [ ] **Step 7: Check for API errors masquerading as "no new data"**

> **IMPORTANT:** When a source API returns non-200 (rate limit, outage), the sync logs an error string and breaks out of the fetch loop. The sync still completes with `status=completed` and `records_added=0`. This looks identical to "no new data since last sync" in the dashboard.

```sql
-- Find completed syncs with 0 records that may be API failures
SELECT sync_type, started_at, records_added, errors
FROM sync_log
WHERE status = 'completed'
  AND records_added = 0
  AND array_length(errors, 1) > 0
  AND EXISTS (SELECT 1 FROM unnest(errors) e WHERE e LIKE '%API error%' OR e LIKE '%error%status%')
ORDER BY started_at DESC
LIMIT 20;
```

- [ ] **Step 8: Check for dataset schema drift**

> Source APIs occasionally change field names during dataset migrations. When this happens, the sync silently produces 0 rows per page because `.filter()` finds no matching fields. No error is logged.

Look for syncs that historically added records but recently dropped to 0:

```sql
SELECT sync_type,
  COUNT(*) FILTER (WHERE records_added > 0 AND started_at > NOW() - INTERVAL '7 days') AS recent_nonzero,
  COUNT(*) FILTER (WHERE records_added = 0 AND started_at > NOW() - INTERVAL '7 days') AS recent_zero,
  MAX(records_added) FILTER (WHERE started_at > NOW() - INTERVAL '30 days') AS max_30d
FROM sync_log
WHERE status = 'completed'
GROUP BY sync_type
HAVING COUNT(*) FILTER (WHERE records_added = 0 AND started_at > NOW() - INTERVAL '7 days') > 3
   AND MAX(records_added) FILTER (WHERE started_at > NOW() - INTERVAL '30 days') > 0
ORDER BY sync_type;
```

If a source historically added records but now consistently adds 0, check the external API for field name changes.

- [ ] **Step 9: Use existing count drift checker (shortcut for Task 4)**

The database already has a `check_building_count_drift(target_metro)` RPC function. Use it before running the manual count comparison:

```sql
SELECT * FROM check_building_count_drift('nyc') LIMIT 20;
SELECT * FROM check_building_count_drift('los-angeles') LIMIT 20;
SELECT * FROM check_building_count_drift('chicago') LIMIT 20;
SELECT * FROM check_building_count_drift('miami') LIMIT 20;
SELECT * FROM check_building_count_drift('houston') LIMIT 20;
```

- [ ] **Step 10: Document root causes per city**

For each city, document:
- Is it a building coverage issue (no buildings to match)?
- Is it an address format issue (normalization mismatch)?
- Is it a BBL issue (invalid/missing BBLs)?
- Is it a time budget issue (linking stops before finishing)?
- Is it a maxLookups cap issue (inline linking capped at 200/500)?
- Is it a source data issue (addresses not populated)?
- Is it an API failure issue (non-200 responses masked as empty syncs)?
- Is it a schema drift issue (source API changed field names)?

---

### Task 4: Check Building Count Accuracy

**Goal:** Verify building aggregate counts match actual linked records.

- [ ] **Step 1: Compare stored counts vs actual linked records (sample)**

```sql
SELECT b.id, b.full_address, b.metro,
  b.violation_count AS stored_violations,
  (SELECT COUNT(*) FROM hpd_violations v WHERE v.building_id = b.id) AS actual_hpd,
  (SELECT COUNT(*) FROM dob_violations v WHERE v.building_id = b.id) AS actual_dob,
  b.complaint_count AS stored_complaints,
  (SELECT COUNT(*) FROM complaints_311 c WHERE c.building_id = b.id) AS actual_311
FROM buildings b
WHERE b.metro = 'nyc'
ORDER BY b.violation_count DESC
LIMIT 10;
```

- [ ] **Step 2: Identify count drift**

If `stored_violations != actual_hpd + actual_dob`, the count update pipeline has a bug.

---

## Phase 2: Fix Root Causes

> Tasks in this phase depend on Phase 1 findings. Execute only the tasks whose root cause was confirmed.

### Task 5: Fix Missing Building Coverage

**Applies if:** A city has records but few/no buildings to match against.

**Files:**
- Modify: `src/app/api/cron/sync/route.ts` (linking section for affected city)

- [ ] **Step 1: Verify auto-creation is enabled for the affected city**

Check that the in-memory linking block for the affected city includes building auto-creation logic (the `if (!buildingId)` block that calls `supabase.from("buildings").insert(...)`).

If missing, add it following the Chicago/Miami/Houston pattern.

- [ ] **Step 2: Test by triggering a link-only sync**

```bash
curl "https://lucid-rents.vercel.app/api/cron/sync?mode=link&source=<city-source>" \
  -H "Authorization: Bearer $CRON_SECRET"
```

- [ ] **Step 3: Re-check unlinked counts after linking**

Re-run the unlinked count queries from Task 2 to verify improvement.

- [ ] **Step 4: Commit fix**

---

### Task 6: Fix Address Normalization Mismatches

**Applies if:** Records and buildings exist but normalization doesn't align them.

**Files:**
- Modify: `src/app/api/cron/sync/route.ts` (address normalization functions)

- [ ] **Step 1: Identify the specific mismatch pattern**

Common issues:
- Building stores "123 MAIN STREET" but record has "123 MAIN ST"
- Building uses "N MAIN ST" but record has "NORTH MAIN ST"
- Building has "123 W 4TH ST" but record has "123 WEST 4TH STREET"

- [ ] **Step 2: Add directional and suffix normalization**

Add to the normalization pipeline in the in-memory linking section:

```typescript
function normalizeStreetAddress(addr: string): string {
  return addr.toUpperCase()
    .replace(/[.,#]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\bSTREET\b/g, "ST")
    .replace(/\bAVENUE\b/g, "AVE")
    .replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\bDRIVE\b/g, "DR")
    .replace(/\bPLACE\b/g, "PL")
    .replace(/\bCOURT\b/g, "CT")
    .replace(/\bLANE\b/g, "LN")
    .replace(/\bROAD\b/g, "RD")
    .replace(/\bNORTH\b/g, "N")
    .replace(/\bSOUTH\b/g, "S")
    .replace(/\bEAST\b/g, "E")
    .replace(/\bWEST\b/g, "W")
    .replace(/\s+(APT|UNIT|#|FL|FLOOR|STE|SUITE|RM|ROOM)\b.*$/i, "")
    .trim();
}
```

Apply this normalization to BOTH building addresses (when building the map) AND record addresses (when looking up).

- [ ] **Step 3: Test normalization with known mismatches**

Manually check that a known unlinked record's address now matches after normalization.

- [ ] **Step 4: Commit fix**

---

### Task 7: Fix Time Budget Exhaustion

**Applies if:** Linking logs show "stopped at time budget" frequently.

**Files:**
- Modify: `src/app/api/cron/sync/route.ts`
- Modify: `vercel.json` (add more link cron slots)

- [ ] **Step 1: Split large linking jobs into per-source crons**

If a city has multiple tables that share a single link cron, split them:

```json
{
  "path": "/api/cron/sync?mode=link&source=chicago-violations",
  "schedule": "0 16 * * *"
},
{
  "path": "/api/cron/sync?mode=link&source=chicago-311",
  "schedule": "15 16 * * *"
}
```

Each source gets its own 300s budget.

- [ ] **Step 2: Commit and deploy**

---

### Task 8: Fix Stale Building Counts

**Applies if:** Task 4 showed count drift between stored and actual values.

- [ ] **Step 1: Run bulk count refresh**

```sql
SELECT * FROM bulk_update_building_counts(
  ARRAY(SELECT id FROM buildings WHERE metro = '<affected_city>' ORDER BY id LIMIT 1000)
);
```

> Note: The function returns `TABLE(building_id uuid, updated boolean, error text)` so `SELECT *` is required. Run in batches of 1000 by adding `OFFSET 1000`, `OFFSET 2000`, etc. until all buildings are refreshed.

- [ ] **Step 2: Verify counts match after refresh**

Re-run the count comparison query from Task 4.

---

## Phase 3: Add Permanent Monitoring

### Task 9: Add Linking Health Endpoint

**Goal:** Expose unlinked record counts per city/source so mission control can display them.

**Files:**
- Create: `src/app/api/health/linking/route.ts`

- [ ] **Step 1: Create the linking health API route**

```typescript
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const revalidate = 0;
export const maxDuration = 30;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface LinkingStats {
  table: string;
  label: string;
  metro: string;
  total: number;
  linked: number;
  unlinked: number;
  link_pct: number;
}

// All tables are multi-metro (metro: null) so we query per city.
// hpd_violations is shared between NYC HPD and LA LAHD — must query both metros.
const TABLES = [
  { table: "hpd_violations", label: "HPD / LAHD Violations" },
  { table: "dob_violations", label: "DOB / Code Violations" },
  { table: "complaints_311", label: "311 Complaints" },
  { table: "nypd_complaints", label: "Crime Reports" },
  { table: "dob_permits", label: "Permits" },
  { table: "hpd_litigations", label: "HPD Litigations" },
  { table: "bedbug_reports", label: "Bedbug Reports" },
  { table: "evictions", label: "Evictions" },
  { table: "sidewalk_sheds", label: "Sidewalk Sheds" },
  // LA-specific tables
  { table: "lahd_evictions", label: "LAHD Evictions" },
  { table: "lahd_tenant_buyouts", label: "LAHD Buyouts" },
  { table: "lahd_ccris_cases", label: "LAHD CCRIS" },
];

const METROS = ["nyc", "los-angeles", "chicago", "miami", "houston"];

async function countForTableMetro(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  label: string,
  metro: string
): Promise<LinkingStats | null> {
  try {
    const [totalRes, linkedRes] = await Promise.all([
      supabase.from(table).select("*", { count: "exact", head: true }).eq("metro", metro),
      supabase.from(table).select("*", { count: "exact", head: true }).eq("metro", metro).not("building_id", "is", null),
    ]);
    const t = totalRes.count ?? 0;
    const l = linkedRes.count ?? 0;
    if (t === 0) return null;
    return {
      table, label, metro,
      total: t, linked: l, unlinked: t - l,
      link_pct: Math.round(1000 * l / t) / 10,
    };
  } catch {
    return null; // Table may not exist yet
  }
}

export async function GET() {
  const supabase = getSupabaseAdmin();

  // Run ALL queries in parallel to stay within maxDuration=30
  const promises: Promise<LinkingStats | null>[] = [];
  for (const { table, label } of TABLES) {
    for (const metro of METROS) {
      promises.push(countForTableMetro(supabase, table, label, metro));
    }
  }

  const rawResults = await Promise.all(promises);
  const results = rawResults.filter((r): r is LinkingStats => r !== null);

  return NextResponse.json({
    checked_at: new Date().toISOString(),
    linking: results,
    critical: results.filter(r => r.link_pct < 50 && r.total > 100),
  });
}
```

- [ ] **Step 2: Test the endpoint locally**

```bash
curl http://localhost:3000/api/health/linking | jq '.critical'
```

- [ ] **Step 3: Commit**

---

### Task 10: Add Linking Stats to Mission Control Dashboard

**Goal:** Show linking health per city/source directly in mission control.

**Files:**
- Modify: `src/app/dashboard/mission-control/page.tsx`

- [ ] **Step 1: Add linking data fetch**

In `MissionControlPage`, add a new state and fetch:

```typescript
const [linking, setLinking] = useState<LinkingStats[] | null>(null);

// In fetchHealth callback, add:
const linkRes = await fetch("/api/health/linking");
if (linkRes.ok) {
  const linkData = await linkRes.json();
  setLinking(linkData.linking);
}
```

- [ ] **Step 2: Add LinkingHealth component**

Add a new section to the dashboard below "Data Syncs" that shows:
- Per-city linking stats table with: Source, Total, Linked, Unlinked, Link %
- Color code: green (>80%), yellow (50-80%), red (<50%)
- Filter by selected metro tab

- [ ] **Step 3: Add critical alerts banner**

If any source has link % < 50% with > 100 records, show a red alert banner at the top of mission control.

- [ ] **Step 4: Commit**

---

### Task 11: Add Sync Error Detail View

**Goal:** Let operators click on a sync to see full error details instead of truncated 200-char previews.

**Files:**
- Modify: `src/app/dashboard/mission-control/page.tsx`

- [ ] **Step 1: Add expandable error rows**

When a sync row is clicked, expand to show the full `errors[]` array from sync_log. Fetch the full entry:

```typescript
const { data } = await supabase
  .from("sync_log")
  .select("errors")
  .eq("sync_type", syncType)
  .order("started_at", { ascending: false })
  .limit(1)
  .single();
```

- [ ] **Step 2: Display errors in a scrollable panel**

Render each error string in a monospace, scrollable container below the sync row.

- [ ] **Step 3: Commit**

---

### Task 12: Final Verification

- [ ] **Step 1: Open mission control and verify all cities show sync indicators**
- [ ] **Step 2: Verify linking stats section shows data for all cities**
- [ ] **Step 3: Verify critical alerts show for any source with low link rates**
- [ ] **Step 4: Trigger a manual sync for one source and verify it appears in the dashboard**
- [ ] **Step 5: Commit all changes and deploy**
