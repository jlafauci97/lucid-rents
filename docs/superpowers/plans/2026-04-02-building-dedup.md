# Building Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate 637K duplicate building rows, prevent future duplicates via unique constraints, and deduplicate NYC condo lot search results in the display layer.

**Architecture:** Four-phase approach: (1) fix ingestion scripts to stop creating new dupes, (2) run parallel per-metro dedup script that merges data, re-points FKs, and deletes losers, (3) add unique constraints after data is clean, (4) deduplicate NYC condo lots in search display.

**Tech Stack:** Node.js (mjs scripts), Supabase JS client, PostgreSQL, Next.js API routes

**Spec:** `docs/superpowers/specs/2026-04-02-building-dedup-design.md`

---

## File Structure

### Scripts (new)
- `scripts/dedup-buildings.mjs` — Main dedup script with parallel metro workers

### Scripts (modify)
- `scripts/backfill-la-buildings.mjs:~200` — Change `.insert()` to SELECT-before-INSERT
- `scripts/backfill-chicago-buildings.mjs:~187` — Change `.insert()` to SELECT-before-INSERT
- `scripts/backfill-miami-311.mjs:~67` — Change `.insert()` to SELECT-before-INSERT

### API Routes (modify)
- `src/app/api/cron/sync/route.ts:~4776,~4960,~5139` — Change Chicago/Miami/Houston `.insert()` to SELECT-before-INSERT

### Database (new)
- `supabase/migrations/20260402100000_building_unique_constraints.sql` — Unique indexes on natural keys + (metro, borough, slug)

### Search (modify)
- `src/app/api/search/route.ts` — Add address-based dedup to search results
- RPC `search_buildings_ranked` — Add DISTINCT ON or post-processing for NYC condo lots

---

## Task 1: Fix LA Backfill Script

**Files:**
- Modify: `scripts/backfill-la-buildings.mjs:~195-210`

- [ ] **Step 1: Read the current insert logic**

Read the file around line 200 to understand the current batch insert pattern.

- [ ] **Step 2: Replace `.insert(batch)` with SELECT-before-INSERT**

Replace the batch insert with a loop that checks for existing buildings by slug before inserting:

```javascript
// Replace the batch .insert() with individual select-before-insert
for (const row of batch) {
  const { data: existing } = await supabase
    .from("buildings")
    .select("id")
    .eq("slug", row.slug)
    .eq("metro", "los-angeles")
    .eq("borough", row.borough)
    .maybeSingle();

  if (existing) {
    // Update non-null fields from this row into the existing building
    const updates = {};
    for (const [key, val] of Object.entries(row)) {
      if (val != null && key !== "slug" && key !== "id") updates[key] = val;
    }
    if (Object.keys(updates).length > 0) {
      await supabase.from("buildings").update(updates).eq("id", existing.id);
    }
    stats.updated++;
  } else {
    const { error } = await supabase.from("buildings").insert(row);
    if (error && error.code !== "23505") {
      console.error("Insert error:", error.message);
      stats.errors++;
    } else {
      stats.inserted++;
    }
  }
}
```

- [ ] **Step 3: Test by running the script in dry-run mode (first 100 rows)**

Run: `node scripts/backfill-la-buildings.mjs --limit 100 2>&1 | tail -20`

Verify: No new duplicate rows created, existing rows updated.

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-la-buildings.mjs
git commit -m "fix: LA backfill uses select-before-insert to prevent duplicates"
```

---

## Task 2: Fix Chicago Backfill Script

**Files:**
- Modify: `scripts/backfill-chicago-buildings.mjs:~185-195`

- [ ] **Step 1: Read the current insert logic**

Read the file around lines 185-200.

- [ ] **Step 2: Replace `.insert(batch)` and single-row fallback with SELECT-before-INSERT**

Same pattern as Task 1 — loop through batch, check by slug + metro + borough before inserting:

```javascript
for (const row of batch) {
  const { data: existing } = await supabase
    .from("buildings")
    .select("id")
    .eq("slug", row.slug)
    .eq("metro", "chicago")
    .eq("borough", row.borough)
    .maybeSingle();

  if (existing) {
    const updates = {};
    for (const [key, val] of Object.entries(row)) {
      if (val != null && key !== "slug" && key !== "id") updates[key] = val;
    }
    if (Object.keys(updates).length > 0) {
      await supabase.from("buildings").update(updates).eq("id", existing.id);
    }
    stats.updated++;
  } else {
    const { error } = await supabase.from("buildings").insert(row);
    if (error && error.code !== "23505") {
      console.error("Insert error:", error.message);
      stats.errors++;
    } else {
      stats.inserted++;
    }
  }
}
```

- [ ] **Step 3: Test with a small batch**

Run: `node scripts/backfill-chicago-buildings.mjs --limit 100 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-chicago-buildings.mjs
git commit -m "fix: Chicago backfill uses select-before-insert to prevent duplicates"
```

---

## Task 3: Fix Miami Backfill Script

**Files:**
- Modify: `scripts/backfill-miami-311.mjs:~60-75`

- [ ] **Step 1: Read the current insert logic**

Read the file around lines 60-75. This script creates buildings inline when processing 311 complaints.

- [ ] **Step 2: Add SELECT check before INSERT**

Wrap the existing insert with a slug check:

```javascript
// Check if building already exists by slug + metro + borough
const { data: existing } = await supabase
  .from("buildings")
  .select("id")
  .eq("slug", slug)
  .eq("metro", "miami")
  .eq("borough", "Miami-Dade")
  .maybeSingle();

let buildingId;
if (existing) {
  buildingId = existing.id;
} else {
  const { data: nb, error: ce } = await supabase.from("buildings").insert({
    full_address: `${addr}, MIAMI, FL`,
    house_number: parts?.[1] || "",
    street_name: parts?.[2] || addr,
    city: "Miami", state: "FL", metro: "miami",
    slug,
    violation_count: 0, complaint_count: 0, review_count: 0, overall_score: null,
  }).select("id").single();

  if (ce && ce.code !== "23505") {
    console.error("Create error:", ce.message);
    continue;
  }
  buildingId = nb?.id;
}
```

- [ ] **Step 3: Test with a small batch**

Run: `node scripts/backfill-miami-311.mjs --limit 100 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-miami-311.mjs
git commit -m "fix: Miami backfill uses select-before-insert to prevent duplicates"
```

---

## Task 4: Fix Cron Sync Route (Chicago/Miami/Houston inserts)

**Files:**
- Modify: `src/app/api/cron/sync/route.ts:~4776,~4960,~5139`

- [ ] **Step 1: Read the three insert blocks**

Read lines 4770-4810, 4955-4990, 5135-5170 in the cron sync route.

- [ ] **Step 2: Extract a shared helper function**

Add a helper near the top of the file (after existing helpers) that does SELECT-before-INSERT:

```typescript
async function findOrCreateBuilding(
  supabase: SupabaseClient,
  slug: string,
  metro: string,
  buildingData: Record<string, unknown>
): Promise<string | null> {
  // Try to find existing building by slug + metro
  const { data: existing } = await supabase
    .from("buildings")
    .select("id")
    .eq("slug", slug)
    .eq("metro", metro)
    .maybeSingle();

  if (existing) return existing.id;

  // Insert new building
  const { data: created, error } = await supabase
    .from("buildings")
    .insert(buildingData)
    .select("id")
    .single();

  if (error) {
    // Handle race condition: another worker may have inserted
    if (error.code === "23505") {
      const { data: retry } = await supabase
        .from("buildings")
        .select("id")
        .eq("slug", slug)
        .eq("metro", metro)
        .maybeSingle();
      return retry?.id ?? null;
    }
    console.error(`Create building error (${metro}):`, error.message);
    return null;
  }
  return created?.id ?? null;
}
```

- [ ] **Step 3: Replace the Chicago insert block (~line 4776)**

Replace the `.insert()` call and `23505` fallback with:

```typescript
const buildingId = await findOrCreateBuilding(supabase, slug, "chicago", {
  full_address: fullAddr,
  house_number: houseNum,
  street_name: streetName,
  city: "Chicago", state: "IL", borough: "Chicago", metro: "chicago",
  slug,
  latitude: coords?.lat ?? null,
  longitude: coords?.lng ?? null,
  violation_count: 0, complaint_count: 0, review_count: 0, overall_score: null,
});
```

- [ ] **Step 4: Replace the Miami insert block (~line 4960)**

Same pattern with `metro: "miami"`.

- [ ] **Step 5: Replace the Houston insert block (~line 5139)**

Same pattern with `metro: "houston"`.

- [ ] **Step 6: Verify the sync route compiles**

Run: `npx next build 2>&1 | head -30`

Check for TypeScript/build errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/cron/sync/route.ts
git commit -m "fix: cron sync uses select-before-insert for non-NYC building creation"
```

---

## Task 5: Create the Parallel Dedup Script

**Files:**
- Create: `scripts/dedup-buildings.mjs`

This is the largest task. The script runs 5 concurrent metro workers that each:
1. Find duplicate groups by `(full_address, city)`
2. Pick a keeper (row with natural key, most data)
3. Merge non-null columns from losers into keeper
4. Re-point all FK children
5. Delete losers

- [ ] **Step 1: Create the script scaffold with CLI args and Supabase setup**

```javascript
#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "fs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 500;
const METRO_NATURAL_KEY = {
  "nyc": "bbl",
  "los-angeles": "apn",
  "chicago": "pin",
  "houston": "hcad_account",
  "miami": "folio_number",
};

// All tables with building_id FK — grouped by handling needed
const FK_TABLES_REPOINT = [
  // CASCADE tables (will lose data if we don't re-point first)
  "building_amenities", "building_listings", "building_rents", "building_scores",
  "dewey_building_rents", "dwellsy_building_meta",
  "monitored_buildings", "reviews", "saved_buildings",
  "unit_listings", "unit_rent_history", "units",
  // SET NULL tables
  "bedbug_reports", "complaints_311", "dob_permits", "dob_violations",
  "energy_benchmarks", "evictions", "hpd_lead_violations", "hpd_litigations",
  "hpd_violations", "lahd_ccris_cases", "lahd_evictions",
  "lahd_tenant_buyouts", "lahd_violation_summary",
  "rent_stabilization", "sidewalk_sheds",
  // NO ACTION tables (will hard-fail delete if missed)
  "chicago_affordable_units", "chicago_demolitions", "chicago_lead_inspections",
  "chicago_rlto_violations", "chicago_scofflaws",
  "houston_affordable_housing", "houston_dangerous_buildings",
  "houston_flood_risk", "houston_land_use_conflicts",
  "miami_flood_claims", "miami_forty_year_recerts", "miami_unsafe_structures",
  "nypd_complaints", "review_amenities",
];

// Tables with unique constraints that need ON CONFLICT handling during re-point
const FK_TABLES_WITH_UNIQUE = new Set(["building_amenities"]);

function progressPath(metro) {
  return `scripts/.dedup-progress-${metro}.json`;
}

function loadProgress(metro) {
  const p = progressPath(metro);
  if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  return { completed: 0, lastAddress: null, noKeyGroups: 0 };
}

function saveProgress(metro, progress) {
  writeFileSync(progressPath(metro), JSON.stringify(progress, null, 2));
}
```

- [ ] **Step 2: Add the keeper selection function**

```javascript
function pickKeeper(rows, naturalKey) {
  // Prefer row with populated natural key
  const withKey = rows.filter(r => r[naturalKey] != null);
  if (withKey.length > 0) {
    // Among those with key, pick the one with most non-null columns
    return withKey.sort((a, b) => countNonNull(b) - countNonNull(a))[0];
  }
  // Fallback: most non-null columns, then earliest created_at
  return rows.sort((a, b) => {
    const diff = countNonNull(b) - countNonNull(a);
    if (diff !== 0) return diff;
    return new Date(a.created_at) - new Date(b.created_at);
  })[0];
}

function countNonNull(row) {
  return Object.values(row).filter(v => v != null).length;
}
```

- [ ] **Step 3: Add the transactional dedup RPC**

Instead of multiple Supabase JS calls (no transaction safety), the entire merge+repoint+delete triplet runs inside a single Postgres function. Add this to the dedup helpers migration:

```sql
-- Transactional dedup: merge, repoint all FKs, delete losers — all atomic
CREATE OR REPLACE FUNCTION dedup_building_group(
  keeper_id uuid,
  loser_ids uuid[],
  merge_updates jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
DECLARE
  tbl text;
BEGIN
  -- Step A: Merge non-null columns from losers into keeper
  IF merge_updates != '{}'::jsonb THEN
    UPDATE buildings
    SET
      house_number = COALESCE(buildings.house_number, (merge_updates->>'house_number')),
      street_name = COALESCE(buildings.street_name, (merge_updates->>'street_name')),
      zip_code = COALESCE(buildings.zip_code, (merge_updates->>'zip_code')),
      year_built = COALESCE(buildings.year_built, (merge_updates->>'year_built')::int),
      num_floors = COALESCE(buildings.num_floors, (merge_updates->>'num_floors')::int),
      total_units = COALESCE(buildings.total_units, (merge_updates->>'total_units')::int),
      residential_units = COALESCE(buildings.residential_units, (merge_updates->>'residential_units')::int),
      owner_name = COALESCE(buildings.owner_name, (merge_updates->>'owner_name')),
      latitude = COALESCE(buildings.latitude, (merge_updates->>'latitude')::double precision),
      longitude = COALESCE(buildings.longitude, (merge_updates->>'longitude')::double precision),
      name = COALESCE(buildings.name, (merge_updates->>'name')),
      apn = COALESCE(buildings.apn, (merge_updates->>'apn')),
      pin = COALESCE(buildings.pin, (merge_updates->>'pin')),
      hcad_account = COALESCE(buildings.hcad_account, (merge_updates->>'hcad_account')),
      folio_number = COALESCE(buildings.folio_number, (merge_updates->>'folio_number'))
    WHERE buildings.id = keeper_id;
  END IF;

  -- Step B: Re-point building_amenities (has unique constraint)
  DELETE FROM building_amenities ba
  WHERE ba.building_id = ANY(loser_ids)
    AND EXISTS (
      SELECT 1 FROM building_amenities ka
      WHERE ka.building_id = keeper_id AND ka.source = ba.source AND ka.amenity = ba.amenity
    );
  UPDATE building_amenities SET building_id = keeper_id WHERE building_id = ANY(loser_ids);

  -- Step B: Re-point all other FK tables
  FOREACH tbl IN ARRAY ARRAY[
    'building_listings', 'building_rents', 'building_scores',
    'dewey_building_rents', 'dwellsy_building_meta',
    'monitored_buildings', 'reviews', 'saved_buildings',
    'unit_listings', 'unit_rent_history', 'units',
    'bedbug_reports', 'complaints_311', 'dob_permits', 'dob_violations',
    'energy_benchmarks', 'evictions', 'hpd_lead_violations', 'hpd_litigations',
    'hpd_violations', 'lahd_ccris_cases', 'lahd_evictions',
    'lahd_tenant_buyouts', 'lahd_violation_summary',
    'rent_stabilization', 'sidewalk_sheds',
    'chicago_affordable_units', 'chicago_demolitions', 'chicago_lead_inspections',
    'chicago_rlto_violations', 'chicago_scofflaws',
    'houston_affordable_housing', 'houston_dangerous_buildings',
    'houston_flood_risk', 'houston_land_use_conflicts',
    'miami_flood_claims', 'miami_forty_year_recerts', 'miami_unsafe_structures',
    'nypd_complaints', 'review_amenities'
  ] LOOP
    -- Skip tables that don't exist (handles optional/legacy tables)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl AND table_schema = 'public') THEN
      EXECUTE format('UPDATE %I SET building_id = $1 WHERE building_id = ANY($2)', tbl)
        USING keeper_id, loser_ids;
    END IF;
  END LOOP;

  -- Step C: Delete losers
  DELETE FROM buildings WHERE id = ANY(loser_ids);
END;
$$ LANGUAGE plpgsql;
```

The JS-side `dedupGroup` function becomes a single RPC call:

```javascript
async function dedupGroup(keeperId, loserIds, rows) {
  const keeper = rows.find(r => r.id === keeperId);
  const losers = rows.filter(r => loserIds.includes(r.id));

  // Build merge updates from losers (non-null values keeper is missing)
  const mergeUpdates = {};
  for (const loser of losers) {
    for (const [key, val] of Object.entries(loser)) {
      if (val != null && keeper[key] == null && key !== "id" && key !== "created_at" && key !== "updated_at") {
        mergeUpdates[key] = val;
      }
    }
  }

  const { error } = await supabase.rpc("dedup_building_group", {
    keeper_id: keeperId,
    loser_ids: loserIds,
    merge_updates: mergeUpdates,
  });
  if (error) throw new Error(`Dedup group failed for ${keeperId}: ${error.message}`);
}
```

- [ ] **Step 4: Add the per-metro worker function**

The worker fetches duplicate groups in batches of 500 using LIMIT/OFFSET, and tracks progress by completed count. Resume works because completed groups no longer appear in the query results (they're no longer duplicates), so `OFFSET 0` after a resume naturally skips already-processed groups.

```javascript
async function dedupMetro(metro) {
  const naturalKey = METRO_NATURAL_KEY[metro];
  const progress = loadProgress(metro);
  console.log(`[${metro}] Starting dedup (${progress.deduped || 0} rows removed previously)`);

  let totalProcessed = progress.completed || 0;
  let deduped = progress.deduped || 0;
  let noKeyGroups = progress.noKeyGroups || 0;
  let hasMore = true;

  while (hasMore) {
    // Fetch next batch of duplicate groups
    // Always OFFSET 0 because completed groups disappear from results
    const { data: groups, error } = await supabase.rpc("get_duplicate_groups_batch", {
      metro_filter: metro,
      batch_limit: BATCH_SIZE,
    });
    if (error) throw new Error(`[${metro}] Failed to get groups: ${error.message}`);

    if (!groups || groups.length === 0) {
      hasMore = false;
      break;
    }

    for (const group of groups) {
      // Fetch full rows for this group
      const { data: rows } = await supabase
        .from("buildings")
        .select("*")
        .eq("full_address", group.full_address)
        .eq("metro", metro);

      if (!rows || rows.length <= 1) {
        totalProcessed++;
        continue;
      }

      // NYC special logic: sub-group by BBL
      if (metro === "nyc") {
        const bblGroups = {};
        for (const row of rows) {
          const key = row.bbl || "null";
          if (!bblGroups[key]) bblGroups[key] = [];
          bblGroups[key].push(row);
        }

        for (const [bbl, bblRows] of Object.entries(bblGroups)) {
          if (bblRows.length <= 1) continue; // No dupes within this BBL
          const keeper = pickKeeper(bblRows, naturalKey);
          const loserIds = bblRows.filter(r => r.id !== keeper.id).map(r => r.id);
          await dedupGroup(keeper.id, loserIds, bblRows);
          deduped += loserIds.length;
        }
      } else {
        // Non-NYC: all rows in the group are true duplicates
        const keeper = pickKeeper(rows, naturalKey);
        const loserIds = rows.filter(r => r.id !== keeper.id).map(r => r.id);
        if (keeper[naturalKey] == null) noKeyGroups++;
        await dedupGroup(keeper.id, loserIds, rows);
        deduped += loserIds.length;
      }

      totalProcessed++;
    }

    // Save progress after each batch
    saveProgress(metro, { completed: totalProcessed, deduped, noKeyGroups });
    console.log(`[${metro}] ${totalProcessed} groups processed, ${deduped} rows removed`);
  }

  saveProgress(metro, { completed: totalProcessed, deduped, noKeyGroups, done: true });
  console.log(`[${metro}] COMPLETE: ${deduped} duplicate rows removed from ${totalProcessed} groups`);
  if (noKeyGroups > 0) {
    console.log(`[${metro}] WARNING: ${noKeyGroups} groups had no natural key populated`);
  }
}
```

- [ ] **Step 5: Add table existence check and main entry point**

```javascript
// Table existence is checked inside the dedup_building_group RPC itself
// (via information_schema lookup), so no client-side check needed.

// Main
const metroArg = process.argv[2]; // Optional: run single metro

async function main() {
  console.log("Building dedup script starting...");

  const metros = metroArg
    ? [metroArg]
    : ["nyc", "chicago", "los-angeles", "houston", "miami"];

  console.log(`Running dedup for: ${metros.join(", ")}`);

  await Promise.all(metros.map(metro => dedupMetro(metro)));

  console.log("\nAll metros complete!");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

- [ ] **Step 6: Create the RPC function for getting duplicate groups**

This RPC is needed because Supabase JS client can't do GROUP BY/HAVING. Create a migration:

```sql
-- File: supabase/migrations/20260402050000_dedup_helpers.sql

-- RPC to get a batch of duplicate building groups for a metro
-- Always returns the next batch (completed groups disappear from results)
CREATE OR REPLACE FUNCTION get_duplicate_groups_batch(
  metro_filter text,
  batch_limit int DEFAULT 500
)
RETURNS TABLE(full_address text, city text, cnt bigint) AS $$
  SELECT b.full_address, b.city, COUNT(*) as cnt
  FROM buildings b
  WHERE b.metro = metro_filter
    AND b.full_address IS NOT NULL
  GROUP BY b.full_address, b.city
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC
  LIMIT batch_limit;
$$ LANGUAGE sql STABLE;

-- RPC to re-point building_amenities with conflict handling
CREATE OR REPLACE FUNCTION repoint_building_amenities(keeper_id uuid, loser_ids uuid[])
RETURNS void AS $$
BEGIN
  -- Delete loser amenities that conflict with keeper amenities
  DELETE FROM building_amenities ba
  WHERE ba.building_id = ANY(loser_ids)
    AND EXISTS (
      SELECT 1 FROM building_amenities ka
      WHERE ka.building_id = keeper_id
        AND ka.source = ba.source
        AND ka.amenity = ba.amenity
    );

  -- Re-point remaining loser amenities to keeper
  UPDATE building_amenities
  SET building_id = keeper_id
  WHERE building_id = ANY(loser_ids);
END;
$$ LANGUAGE plpgsql;
```

- [ ] **Step 7: Commit**

```bash
git add scripts/dedup-buildings.mjs supabase/migrations/20260402050000_dedup_helpers.sql
git commit -m "feat: add parallel building dedup script with per-metro workers"
```

---

## Task 6: NYC Slug Disambiguation

After the dedup script runs, NYC condo lots (same address, different BBLs) still share slugs. This task adds suffixes.

**Files:**
- Modify: `scripts/dedup-buildings.mjs` (add a post-dedup step)

- [ ] **Step 1: Add slug disambiguation function to the dedup script**

Add after the `dedupMetro` function:

```javascript
async function disambiguateSlugs(metro) {
  console.log(`[${metro}] Disambiguating duplicate slugs...`);

  const { data: slugDupes } = await supabase.rpc("get_duplicate_slugs", {
    metro_filter: metro,
  });

  if (!slugDupes || slugDupes.length === 0) {
    console.log(`[${metro}] No duplicate slugs found`);
    return;
  }

  let fixed = 0;
  for (const { slug, borough } of slugDupes) {
    const { data: rows } = await supabase
      .from("buildings")
      .select("id, slug, overall_score, review_count")
      .eq("slug", slug)
      .eq("borough", borough)
      .eq("metro", metro)
      .order("review_count", { ascending: false })
      .order("overall_score", { ascending: false, nullsFirst: false });

    if (!rows || rows.length <= 1) continue;

    // First row keeps the original slug; others get suffixes
    for (let i = 1; i < rows.length; i++) {
      const newSlug = `${slug}-lot-${i + 1}`;
      await supabase
        .from("buildings")
        .update({ slug: newSlug })
        .eq("id", rows[i].id);
      fixed++;
    }
  }

  console.log(`[${metro}] Disambiguated ${fixed} slugs`);
}
```

- [ ] **Step 2: Add the RPC for finding duplicate slugs**

Add to the dedup helpers migration:

```sql
CREATE OR REPLACE FUNCTION get_duplicate_slugs(metro_filter text)
RETURNS TABLE(slug text, borough text, cnt bigint) AS $$
  SELECT b.slug, b.borough, COUNT(*) as cnt
  FROM buildings b
  WHERE b.metro = metro_filter
    AND b.slug IS NOT NULL
  GROUP BY b.slug, b.borough
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC;
$$ LANGUAGE sql STABLE;
```

- [ ] **Step 3: Wire it into main()**

After the `Promise.all(metros.map(...))` call in main():

```javascript
// After dedup, disambiguate slugs for all metros
console.log("\nDisambiguating slugs...");
await Promise.all(metros.map(metro => disambiguateSlugs(metro)));
```

- [ ] **Step 4: Commit**

```bash
git add scripts/dedup-buildings.mjs supabase/migrations/20260402050000_dedup_helpers.sql
git commit -m "feat: add slug disambiguation for NYC condo lots"
```

---

## Task 7: Pre-flight Verification Queries

Before adding constraints, verify the data is clean.

**Files:**
- Modify: `scripts/dedup-buildings.mjs` (add verification step)

- [ ] **Step 1: Add verification function**

```javascript
async function verifyClean() {
  console.log("\n=== PRE-FLIGHT VERIFICATION ===\n");
  let clean = true;

  // Check address-based duplicates per metro
  for (const metro of ["nyc", "chicago", "los-angeles", "houston", "miami"]) {
    const { data } = await supabase.rpc("get_duplicate_groups", { metro_filter: metro });
    if (metro === "nyc") {
      // NYC: only flag groups where rows share a BBL
      // (condo lots with different BBLs are expected)
      console.log(`[${metro}] ${data?.length || 0} address groups remaining (expected: condo lots only)`);
    } else {
      if (data && data.length > 0) {
        console.error(`[${metro}] FAIL: ${data.length} duplicate groups still exist!`);
        clean = false;
      } else {
        console.log(`[${metro}] PASS: no duplicates`);
      }
    }
  }

  // Check natural key duplicates
  const keyChecks = [
    { key: "apn", label: "APN" },
    { key: "pin", label: "PIN" },
    { key: "hcad_account", label: "HCAD" },
    { key: "folio_number", label: "Folio" },
  ];
  for (const { key, label } of keyChecks) {
    const { data } = await supabase.rpc("check_natural_key_dupes", { key_column: key });
    if (data && data.length > 0) {
      console.error(`${label} FAIL: ${data.length} duplicate natural keys found`);
      clean = false;
    } else {
      console.log(`${label} PASS: no duplicates`);
    }
  }

  // Check slug duplicates per metro+borough
  for (const metro of ["nyc", "chicago", "los-angeles", "houston", "miami"]) {
    const { data } = await supabase.rpc("get_duplicate_slugs", { metro_filter: metro });
    if (data && data.length > 0) {
      console.error(`[${metro}] slug FAIL: ${data.length} duplicate slug groups`);
      clean = false;
    } else {
      console.log(`[${metro}] slug PASS`);
    }
  }

  // Check NULL borough rows that could cause issues with the slug unique index
  const { count: nullBoroughCount } = await supabase
    .from("buildings")
    .select("*", { count: "exact", head: true })
    .is("borough", null);
  if (nullBoroughCount > 0) {
    console.warn(`WARNING: ${nullBoroughCount} buildings have NULL borough — backfill before adding constraint`);
    clean = false;
  }

  if (clean) {
    console.log("\n✅ ALL CHECKS PASSED — safe to add unique constraints");
  } else {
    console.error("\n❌ VERIFICATION FAILED — fix issues before adding constraints");
  }
  return clean;
}
```

- [ ] **Step 2: Add the natural key check RPC**

Add to the dedup helpers migration:

```sql
CREATE OR REPLACE FUNCTION check_natural_key_dupes(key_column text)
RETURNS TABLE(key_val text, cnt bigint) AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT %I::text as key_val, COUNT(*) as cnt FROM buildings WHERE %I IS NOT NULL GROUP BY %I HAVING COUNT(*) > 1 LIMIT 20',
    key_column, key_column, key_column
  );
END;
$$ LANGUAGE plpgsql STABLE;
```

- [ ] **Step 3: Wire into main() with a `--verify` flag**

```javascript
const verifyOnly = process.argv.includes("--verify");

async function main() {
  if (verifyOnly) {
    await verifyClean();
    return;
  }
  // ... existing dedup logic ...

  // Run verification after dedup
  const clean = await verifyClean();
  if (!clean) {
    console.error("Manual intervention needed before adding constraints.");
    process.exit(1);
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add scripts/dedup-buildings.mjs supabase/migrations/20260402050000_dedup_helpers.sql
git commit -m "feat: add pre-flight verification for dedup script"
```

---

## Task 8: Add Unique Constraints Migration

**Files:**
- Create: `supabase/migrations/20260402100000_building_unique_constraints.sql`

- [ ] **Step 1: Write the migration**

**IMPORTANT:** These use `CREATE INDEX CONCURRENTLY` which cannot run inside a transaction block. Supabase's migration runner wraps each file in a transaction by default and will fail. **Apply this migration manually via `psql` or the Supabase SQL Editor, NOT through `supabase db push`.**

```sql
-- Building dedup unique constraints
-- Run AFTER dedup-buildings.mjs has cleaned the data and verification passes
-- MUST be run outside a transaction (not through supabase db push)

-- Natural key constraints (partial — only where key is populated)
CREATE UNIQUE INDEX CONCURRENTLY idx_buildings_apn_unique
  ON buildings (apn) WHERE apn IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY idx_buildings_pin_unique
  ON buildings (pin) WHERE pin IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY idx_buildings_hcad_unique
  ON buildings (hcad_account) WHERE hcad_account IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY idx_buildings_folio_unique
  ON buildings (folio_number) WHERE folio_number IS NOT NULL;

-- Slug uniqueness per metro+borough (only where borough is populated)
CREATE UNIQUE INDEX CONCURRENTLY idx_buildings_metro_borough_slug
  ON buildings (metro, borough, slug) WHERE borough IS NOT NULL;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260402100000_building_unique_constraints.sql
git commit -m "feat: add unique constraints on building natural keys and slug"
```

---

## Task 9: Update Cron Sync to Use New Constraints

After constraints are live, switch the cron sync to use proper `.upsert()`.

**Files:**
- Modify: `src/app/api/cron/sync/route.ts`

- [ ] **Step 1: Update the `findOrCreateBuilding` helper to use upsert**

Replace the SELECT-before-INSERT logic with a proper upsert now that the constraint exists:

```typescript
async function findOrCreateBuilding(
  supabase: SupabaseClient,
  slug: string,
  metro: string,
  borough: string,
  buildingData: Record<string, unknown>
): Promise<string | null> {
  const { data, error } = await supabase
    .from("buildings")
    .upsert(
      { ...buildingData, slug, metro, borough },
      { onConflict: "metro,borough,slug" }
    )
    .select("id")
    .single();

  if (error) {
    console.error(`Upsert building error (${metro}):`, error.message);
    return null;
  }
  return data?.id ?? null;
}
```

- [ ] **Step 2: Update all callers to pass `borough`**

Ensure Chicago, Miami, and Houston callers pass the correct borough value.

- [ ] **Step 3: Verify build**

Run: `npx next build 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/sync/route.ts
git commit -m "feat: cron sync uses upsert on (metro, borough, slug) constraint"
```

---

## Task 10: Search Display Dedup for NYC Condo Lots

**Files:**
- Modify: RPC `search_buildings_ranked` (via migration)
- Create: `supabase/migrations/20260402110000_search_dedup.sql`

- [ ] **Step 1: Update the search RPC to deduplicate by address**

```sql
-- Replace search_buildings_ranked to add address-based dedup
CREATE OR REPLACE FUNCTION search_buildings_ranked(
  search_query text,
  search_query_alt text DEFAULT NULL,
  city_filter text DEFAULT NULL,
  borough_filter text DEFAULT NULL,
  zip_filter text DEFAULT NULL,
  sort_by text DEFAULT 'relevance',
  page_offset int DEFAULT 0,
  page_limit int DEFAULT 10
)
RETURNS SETOF json AS $$
  WITH matched AS (
    SELECT b.*,
           ts_rank(b.search_vector, websearch_to_tsquery('english', search_query)) AS rank,
           ROW_NUMBER() OVER (
             PARTITION BY b.full_address, b.city
             ORDER BY b.review_count DESC, b.overall_score DESC NULLS LAST
           ) AS addr_rank
    FROM buildings b
    WHERE b.search_vector @@ websearch_to_tsquery('english', search_query)
      AND (city_filter IS NULL OR b.metro = city_filter)
      AND (borough_filter IS NULL OR b.borough = borough_filter)
      AND (zip_filter IS NULL OR b.zip_code = zip_filter)
  ),
  deduped AS (
    SELECT m.*,
           COUNT(*) OVER() AS total_count
    FROM matched m
    WHERE m.addr_rank = 1
  )
  SELECT row_to_json(t) FROM (
    SELECT d.id, d.metro, d.bbl, d.bin, d.apn, d.pin,
           d.borough, d.house_number, d.street_name, d.city, d.state,
           d.zip_code, d.full_address, d.name, d.slug,
           d.year_built, d.num_floors, d.total_units,
           d.residential_units, d.commercial_units,
           d.building_class, d.land_use, d.owner_name,
           d.overall_score, d.review_count,
           d.violation_count, d.complaint_count, d.litigation_count,
           d.dob_violation_count, d.crime_count,
           d.bedbug_report_count, d.eviction_count, d.permit_count,
           d.energy_star_score, d.is_rent_stabilized,
           d.stabilized_units, d.stabilized_year,
           d.latitude, d.longitude,
           d.is_soft_story, d.soft_story_status, d.is_rso,
           d.fire_risk_zone, d.ward, d.community_area,
           d.is_rlto_protected, d.is_scofflaw,
           d.rlto_violation_count, d.lead_inspection_count,
           d.created_at, d.updated_at,
           d.total_count
    FROM deduped d
    ORDER BY
      CASE WHEN sort_by = 'score-desc' THEN d.overall_score END DESC NULLS LAST,
      CASE WHEN sort_by = 'score-asc' THEN d.overall_score END ASC NULLS LAST,
      CASE WHEN sort_by = 'violations-desc' THEN d.violation_count END DESC,
      CASE WHEN sort_by = 'reviews-desc' THEN d.review_count END DESC,
      CASE WHEN sort_by NOT IN ('score-desc','score-asc','violations-desc','reviews-desc') THEN d.rank END DESC,
      d.review_count DESC
    OFFSET page_offset
    LIMIT page_limit
  ) t;
$$ LANGUAGE sql STABLE;
```

The key change: `ROW_NUMBER() OVER (PARTITION BY full_address, city ...)` picks the "best" building per address, and `WHERE addr_rank = 1` filters out the rest.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260402110000_search_dedup.sql
git commit -m "feat: search RPC deduplicates NYC condo lots by address"
```

---

## Execution Order

1. **Tasks 1-4**: Fix ingestion scripts (can be done in parallel — independent files)
2. **Tasks 5-7**: Create and enhance dedup script (sequential)
3. **Run dedup**: `node scripts/dedup-buildings.mjs` (take Supabase snapshot first!)
4. **Verify**: `node scripts/dedup-buildings.mjs --verify`
5. **Task 8**: Apply unique constraints (only after verification passes)
6. **Task 9**: Update cron sync to use new constraints
7. **Task 10**: Search display dedup
