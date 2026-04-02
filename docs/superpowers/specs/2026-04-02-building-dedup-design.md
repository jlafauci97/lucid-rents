# Building Deduplication Design

**Date:** 2026-04-02
**Status:** Draft

## Problem

The buildings table contains **637,744 excess duplicate rows** across 436,458 duplicate groups. Root causes:

1. **Non-NYC backfill scripts** use plain `.insert()` with no conflict handling — every re-run creates new rows
2. **No unique constraints** on city-specific natural keys (apn, pin, hcad_account, folio_number)
3. **Slug unique index was dropped** during multi-city expansion, removing the last safety net
4. **NYC condo lots** — different BBLs sharing the same address appear as duplicates but are legitimate distinct parcels

### Scope by Metro

| Metro | Duplicate Groups | Excess Rows | Nature |
|-------|----------------:|------------:|--------|
| Chicago | 217,147 | 255,463 | True duplicates from `.insert()` re-runs |
| NYC | 55,699 | 141,782 | Mix: condo lots (legit) + 311 address-based dupes |
| Miami | 73,040 | 99,401 | True duplicates |
| Los Angeles | 51,225 | 87,378 | True duplicates |
| Houston | 39,347 | 53,720 | True duplicates |

### Current Unique Constraints

- `buildings_pkey` — `UNIQUE(id)` (primary key)
- `buildings_bbl_key` — `UNIQUE(bbl)` (NYC only)
- **No other unique constraints exist**

## Decisions

1. **NYC condo lots** (same address, different BBLs) are kept as separate rows. Dedup happens in the search/display layer only.
2. **Keeper selection** for true duplicates: prefer the row with a populated natural key (apn/pin/etc.), merge non-null columns from losers into keeper, re-point all FK children, delete losers.
3. **Slug disambiguation**: enforce `UNIQUE(metro, borough, slug)`. NYC condo lots get `-lot-N` suffixes.
4. **Rollout**: phased — fix scripts, parallel dedup per metro, then add constraints.

## Design

### Phase 1: Fix Ingestion Scripts

Prevent new duplicates by fixing all backfill and sync scripts. Since the `(metro, borough, slug)` unique constraint does not exist yet (added in Phase 3), `.upsert()` on `slug` alone would silently fall back to INSERT. **Phase 1 scripts must use SELECT-before-INSERT as the primary dedup mechanism.**

#### Scripts to fix:

| Script | Current | Fix |
|--------|---------|-----|
| `scripts/backfill-la-buildings.mjs` | `.insert()` | SELECT by slug first; INSERT only if not found, UPDATE if found |
| `scripts/backfill-chicago-buildings.mjs` | `.insert()` | SELECT by slug first; INSERT only if not found, UPDATE if found |
| `scripts/backfill-miami-311.mjs` | `.insert()` | SELECT by slug first; INSERT only if not found, UPDATE if found |
| Houston backfill scripts | `.insert()` | SELECT by slug first; INSERT only if not found, UPDATE if found |
| `src/app/api/cron/sync/route.ts` | `onConflict: 'slug'` | SELECT by `(metro, borough, slug)` first; after Phase 3 constraint, switch to `.upsert(..., { onConflict: 'metro,borough,slug' })` |

After Phase 3 constraints are in place, these scripts can be simplified to use `.upsert()` directly.

### Phase 2: Parallel Metro Dedup Script

A single script `scripts/dedup-buildings.mjs` that spawns one async worker per metro, all running concurrently via `Promise.all()`.

#### Worker Logic (per metro)

```
1. Query duplicate groups:
   SELECT full_address, city, array_agg(id) as ids
   FROM buildings
   WHERE metro = $metro AND full_address IS NOT NULL
   GROUP BY full_address, city
   HAVING COUNT(*) > 1

2. For each group, pick keeper:
   - Prefer row with populated natural key (apn/pin/hcad_account/folio_number)
   - Tiebreak: most non-null columns
   - Tiebreak: earliest created_at

3. Merge losers into keeper:
   - UPDATE keeper SET col = loser.col for each NULL column in keeper where loser has data

4. Re-point FK children (all 41 referencing tables):
   - UPDATE <table> SET building_id = keeper_id WHERE building_id = ANY(loser_ids)

5. Delete losers:
   - DELETE FROM buildings WHERE id = ANY(loser_ids)

6. Process in batches of 500 groups
7. Track progress to scripts/.dedup-progress-<metro>.json (resumable)
```

#### NYC-Specific Logic

NYC worker has additional rules:
- **Within each address group, sub-group by BBL.** If a BBL appears more than once, those rows are true duplicates — dedup them. Rows with unique BBLs within the group are legitimate condo lots — leave them.
- Example: group has BBLs [A, A, B, C] → dedup the two A rows, keep B and C untouched
- **Skip the entire group** only if every BBL in the group is distinct (no duplicates at all)
- **After dedup, disambiguate slugs** for condo lots: append `-lot-2`, `-lot-3`, etc. to rows sharing a slug within the same `(metro, borough)`

#### FK Tables to Re-point

All tables with `building_id` foreign keys (grouped by delete rule):

**CASCADE (will auto-delete if we delete building — must re-point BEFORE delete):**
- `building_amenities` — **has unique constraint on `(building_id, source, amenity)`; re-point must use `ON CONFLICT DO NOTHING` to skip duplicates**
- `building_listings`, `building_rents`, `building_scores`
- `dewey_building_rents`, `dwellsy_building_meta`
- `monitored_buildings`, `reviews`, `saved_buildings`
- `unit_listings`, `unit_rent_history`, `units`

Note: `building_scores` and `saved_buildings` are confirmed active in production (used in profile/saved page, building detail page, etc.) — not legacy.

**SET NULL (will null out if we delete — must re-point BEFORE delete):**
- `bedbug_reports`, `complaints_311`, `dob_permits`, `dob_violations`
- `energy_benchmarks`, `evictions`, `hpd_lead_violations`, `hpd_litigations`
- `hpd_violations`, `lahd_ccris_cases`, `lahd_evictions`
- `lahd_tenant_buyouts`, `lahd_violation_summary`
- `rent_stabilization`, `sidewalk_sheds`

**NO ACTION (will fail if we delete without re-pointing):**
- `chicago_affordable_units`, `chicago_demolitions`, `chicago_lead_inspections`
- `chicago_rlto_violations`, `chicago_scofflaws`
- `houston_affordable_housing`, `houston_dangerous_buildings`
- `houston_flood_risk`, `houston_land_use_conflicts`
- `miami_flood_claims`, `miami_forty_year_recerts`, `miami_unsafe_structures`
- `nypd_complaints`
- `review_amenities` — **cross-metro table; re-point must use global `building_id = ANY(loser_ids)` without any metro filter, since users can submit reviews for buildings in any metro**

**All FK children must be re-pointed before deleting loser rows.** The NO ACTION tables will hard-fail the delete if missed. The dedup script should verify each FK table exists before attempting re-point (query `information_schema.tables` at startup).

#### Parallelism

Each metro's data is independent (no cross-metro FK references), so all 5 workers run concurrently:

```javascript
await Promise.all([
  dedupMetro('nyc'),
  dedupMetro('chicago'),
  dedupMetro('los-angeles'),
  dedupMetro('houston'),
  dedupMetro('miami'),
]);
```

**Connection pool safety:** Supabase's pgBouncer has a limited connection pool. Each worker processes its 500-group batches **sequentially** (not parallelized within the worker). With 5 workers each holding ~1 connection at a time, this stays well within pool limits.

**Transaction safety:** Each duplicate group's merge-repoint-delete triplet is wrapped in a database transaction (via Supabase RPC or raw SQL `BEGIN`/`COMMIT`). If any step fails, the entire group rolls back cleanly. The progress file records group completion only after the transaction commits.

Each worker logs progress and can be resumed independently if interrupted. Chicago worker additionally logs how many groups had no natural key populated (for data quality tracking).

### Phase 2.5: Pre-flight Verification

Before proceeding to Phase 3, run verification queries to catch edge cases Phase 2 may have missed:

```sql
-- Check for natural key duplicates that weren't caught by address-based grouping
-- (e.g., same APN but different addresses due to data entry inconsistency)
SELECT 'apn' as key_type, apn as key_val, COUNT(*) FROM buildings WHERE apn IS NOT NULL GROUP BY apn HAVING COUNT(*) > 1;
SELECT 'pin' as key_type, pin as key_val, COUNT(*) FROM buildings WHERE pin IS NOT NULL GROUP BY pin HAVING COUNT(*) > 1;
SELECT 'hcad_account' as key_type, hcad_account as key_val, COUNT(*) FROM buildings WHERE hcad_account IS NOT NULL GROUP BY hcad_account HAVING COUNT(*) > 1;
SELECT 'folio_number' as key_type, folio_number as key_val, COUNT(*) FROM buildings WHERE folio_number IS NOT NULL GROUP BY folio_number HAVING COUNT(*) > 1;
SELECT 'metro_borough_slug' as key_type, metro || '/' || borough || '/' || slug as key_val, COUNT(*) FROM buildings WHERE borough IS NOT NULL GROUP BY metro, borough, slug HAVING COUNT(*) > 1;

-- Also check for NULL boroughs that could cause issues with the unique index
SELECT 'null_borough_slug_dupes' as key_type, metro || '/' || slug as key_val, COUNT(*) FROM buildings WHERE borough IS NULL GROUP BY metro, slug HAVING COUNT(*) > 1;
```

If any results are returned, resolve them before Phase 3. For NULL borough rows, either backfill the borough value or decide whether the Phase 3 index should include a `WHERE borough IS NOT NULL` guard. These would be buildings with the same natural key but different addresses — likely data entry errors that need manual review or a secondary dedup pass.

### Phase 3: Add Unique Constraints (Migration)

After Phase 2.5 verification passes:

```sql
-- Natural key constraints (partial — only where key is populated)
CREATE UNIQUE INDEX idx_buildings_apn_unique
  ON buildings (apn) WHERE apn IS NOT NULL;

CREATE UNIQUE INDEX idx_buildings_pin_unique
  ON buildings (pin) WHERE pin IS NOT NULL;

CREATE UNIQUE INDEX idx_buildings_hcad_unique
  ON buildings (hcad_account) WHERE hcad_account IS NOT NULL;

CREATE UNIQUE INDEX idx_buildings_folio_unique
  ON buildings (folio_number) WHERE folio_number IS NOT NULL;

-- Slug uniqueness per metro+borough
CREATE UNIQUE INDEX idx_buildings_metro_borough_slug
  ON buildings (metro, borough, slug);
```

After these are in place, update the cron sync upsert to use `onConflict: 'metro,borough,slug'`.

### Phase 4: Search Display Dedup

For NYC condo lots (same address, different BBLs):
- Group search results by `full_address` to avoid showing "34-03 34 STREET" five times
- Show the "best" result (highest score, most reviews) with a note like "X units across Y lots"
- Individual lot pages remain accessible via their unique slugs

## Rollback Plan

- **Before Phase 2**: take a Supabase point-in-time snapshot (or `pg_dump` of the buildings table and all FK-referencing tables). This is the only way to undo 637K row deletions.
- Phase 1 (script fixes): revert script changes
- Phase 2 (dedup script): restore from snapshot if needed; progress files track per-group completion for partial recovery
- Phase 3 (constraints): `DROP INDEX` to remove constraints
- Phase 4 (display): revert search component changes

## Success Criteria

- 0 duplicate groups by `(full_address, city)` for non-NYC metros
- NYC duplicates reduced to only legitimate condo lot groups (different BBLs)
- All unique constraints pass without errors
- No orphaned FK references
- Search results show deduplicated addresses
- All backfill scripts are re-run-safe (idempotent)
