# NYC 311 relink — handoff

Pick up the relink work on a different machine. Everything you need is on this branch.

## Context (one paragraph)

The 7-year NYC 311 backfill finished: **15,651,764 inserted, 5,923,404 linked (37.8%)**. A sample of 45,000 unlinked-with-address rows showed the dominant cause is whitespace padding in NYC 311's numbered cross-streets — `"635 EAST  229 STREET"` (double space) vs. the buildings table's `"EAST 229 STREET"` (single space). The exact-match join silently misses every one. ~93% of unlinked-with-address rows parse cleanly with the linker regex, so a normalized re-link should recover a large chunk (rough estimate: 2–4M rows). Real gaps (street-level reports, parks, vacant lots, NYCHA) account for the remaining floor.

Full diagnosis: see `scripts/analyze-311-link-gap.mjs` and the analysis output saved during the diagnosis run.

## What's on this branch

| File | Role |
|---|---|
| `supabase/migrations/20260423015917_link_311_nyc_bulk_rpc.sql` | original bulk linker (already applied) |
| `supabase/migrations/20260423020156_link_311_nyc_by_keys_rpc.sql` | per-key linker used by the backfill (already applied) |
| `supabase/migrations/20260426010000_relink_311_nyc_normalized_rpc.sql` | **new** whitespace-tolerant relink RPC |
| `scripts/backfill-nyc-311-historical.mjs` | the 7-year backfill driver (already done) |
| `scripts/analyze-311-link-gap.mjs` | diagnosis tool (rerun any time) |
| `scripts/relink-311-nyc-normalized.mjs` | **new** relink driver — what to run on the other machine |
| `src/app/api/cron/sync/route.ts` | case-insensitive complaint_type filter + 36 widened types |

The relink RPC differs from the original linker in three small but critical ways:
1. Looser regex: `^(\d[\d\-]*[A-Za-z]?)\s+(.+)$` (allows `616A`, `455B`, etc.)
2. House# normalized: strips trailing alpha — `"616A"` → `"616"`
3. Street name normalized: `regexp_replace(upper(trim(street)), '\s+', ' ', 'g')` so `"EAST  229 STREET"` collapses to `"EAST 229 STREET"`

The buildings side stays untouched, so the existing `(street_name, house_number)` btree continues to drive the join.

## Run it on the other machine

```bash
# 1. Get the branch
git fetch origin
git checkout claude/mystifying-swanson-26119a
git pull origin claude/mystifying-swanson-26119a

# 2. Install deps
pnpm install   # or npm install

# 3. Make sure .env.local has these (same values as your dev box)
#    NEXT_PUBLIC_SUPABASE_URL=...
#    SUPABASE_SERVICE_ROLE_KEY=...

# 4. Apply the new migration to the linked Supabase project
supabase db push --linked
# (or, if you prefer, via Supabase MCP / dashboard SQL editor:
#  paste the contents of supabase/migrations/20260426010000_relink_311_nyc_normalized_rpc.sql)

# 5. Sanity check on a single day before the full sweep
node scripts/relink-311-nyc-normalized.mjs --dryday=2025-06-01

# 6. Full run (resumable — Ctrl-C and rerun is safe)
node scripts/relink-311-nyc-normalized.mjs

# Optional: tail a logfile in another terminal
node scripts/relink-311-nyc-normalized.mjs 2>&1 | tee /tmp/relink-nyc-311.log
```

Resume after Ctrl-C: just run step 6 again. Progress is in `scripts/.relink-311-nyc-normalized.progress.json`.

## What good output looks like

```
[start] cursor=2019-04-22  end=2026-04-26  totalProcessed=0  totalLinked=0
[2019-04-22] processed= 1247  linked=  389  (31.2%)  | 1.4s | total processed=1,247  linked=389  (276 linked/s)
[2019-04-23] processed= 1192  linked=  371  (31.1%)  | 1.3s | total processed=2,439  linked=760  (281 linked/s)
...
```

Per-day windows should be < 5s each. If they balloon past 30s you'll see `statement_timeout` errors — narrow the window or bump the timeout in the migration.

## Sizing expectations (observed via dryday)

Three single-day dryruns:

| Day | candidates | linked | recovery |
|---|---:|---:|---:|
| 2022-06-01 | 2,848 | 949 | **33.3%** |
| 2024-06-01 | 3,445 | 690 | **20.0%** |
| 2025-06-01 | 3,352 | 616 | **18.4%** |

- **Days to process:** ~2,560 (2019-04-22 → 2026-04-26)
- **Candidates per day:** ~3,000–4,000 unlinked-with-address NYC rows on average
- **Expected link rate:** ~20–33% per day (varies — older periods recover more)
- **Wall time:** at ~1s/window on a healthy connection, the full sweep takes ~45 min. With backoff/retries factor 1.5–2×.
- **Net new linked:** rough estimate **1.5–2.5M rows** (recovers ~16–26% of the 9.5M unlinked-with-address subset). Confirm by diff'ing `totalLinked` before/after.

Note: the three dryday runs above already wrote their results to the DB (the RPC runs the UPDATE — `--dryday` only skips the *progress file* write). So those three days are already partially relinked. The full sweep will simply skip rows whose `building_id` got set.

## Verifying after it finishes

The original counts are baked into `scripts/analyze-311-link-gap.mjs` (`TOTAL`, `LINKED`, `UNLINKED`). After the relink, rerun that script to get a fresh breakdown. Or one-shot via the Supabase MCP (small enough query if scoped to a date window):

```sql
-- one window — fast
SELECT count(*) FILTER (WHERE building_id IS NOT NULL) AS linked,
       count(*) FILTER (WHERE building_id IS NULL)     AS unlinked
FROM complaints_311_nyc
WHERE created_date >= '2025-06-01'
  AND created_date <  '2025-06-08';
```

A pre/post comparison on that same window is the cleanest read on how much the normalization actually helped.

## Open follow-ups (not done yet)

- Numbered avenues in Brooklyn: `"5602 11 AVENUE"` may need `"11" → "11TH"` (or vice versa) — separate issue, ignored by this relink.
- Real-gap floor: street-level complaint types (Illegal Parking, Noise - Street/Sidewalk, Blocked Driveway, Water System) make up 40–50% of unlinked. Those will never link to a single building no matter how clever the matcher gets — that's a semantic gap, not a normalization bug.
- The four-file change from earlier (sync route + 2 migrations + backfill script) is committed on this same branch but no PR has been opened yet. Worth opening one once the relink lands.
