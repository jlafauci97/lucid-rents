# Crime Sync Rollout (Chicago, Miami, Houston) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Chicago, Miami, and Houston to feature parity with the LA crime page (`/[city]/crime`) by ensuring crime ingestion is running, backfilled, and powering the existing dashboard RPCs for all three cities.

**Current State (April 2026):**
- **LA** — `lapd-crime-backfill.mjs` + ongoing cron sync; page live; uses `nypd_complaints` table with `metro='los-angeles'`.
- **Chicago** — `syncChicagoCrimes()` exists at `src/app/api/cron/sync/route.ts:~3275` but the page is not wired and no historical backfill has been run.
- **Miami** — `syncMiamiCrimes()` is **stubbed** at lines 3783–3792 ("MDPD crime data not yet available via ArcGIS API"). Needs a real source.
- **Houston** — `syncHoustonCrimes()` exists at `~4227` (Houston PD ArcGIS NIBRS layers). Status of historical backfill unknown.

**Architecture:** Per-city, identical 4-step pattern: (1) confirm/build the ingestion source, (2) run a historical backfill script, (3) wire the existing `crime_by_zip` / `crime_city_stats` / `crime_zip_yoy` / `crime_all_zip_trends` RPCs to accept the new `metro`, (4) verify the existing `/[city]/crime` route renders.

**Tech Stack:** Node.js (mjs scripts), TypeScript (Next.js API route), Supabase JS client, PostgreSQL.

**Related migration:** `supabase/migrations/20260322000000_crime_rpcs_multi_city.sql`

---

## File Structure

### Code (modify)
- `src/app/api/cron/sync/route.ts:~3275` — `syncChicagoCrimes()`: confirm running daily, raise page budget if needed
- `src/app/api/cron/sync/route.ts:3783-3792` — `syncMiamiCrimes()`: replace stub with Miami-Dade Open Data implementation
- `src/app/api/cron/sync/route.ts:~4227` — `syncHoustonCrimes()`: confirm running daily

### Scripts (new)
- `scripts/chicago-crime-backfill.mjs` — Historical NIBRS backfill (Chicago goes back to 2001 via `ijzp-q8t2`)
- `scripts/miami-crime-backfill.mjs` — Historical Miami-Dade backfill
- `scripts/houston-crime-backfill.mjs` — Historical Houston NIBRS backfill from ArcGIS layers

### Database (new)
- `supabase/migrations/20260410200000_crime_rpcs_metro_index.sql` — Composite index `(metro, occurred_at, zip_code)` on `nypd_complaints` if not already present (the LA dashboard will be slow without this once Chicago lands).

### Pages (verify, not modify)
- `src/app/[city]/crime/page.tsx` — Already uses `[city]` dynamic segment; should "just work" once data lands.

---

## Task 1: Chicago Crime — Backfill + Verify

**Files:**
- New: `scripts/chicago-crime-backfill.mjs`
- Verify: `src/app/api/cron/sync/route.ts:~3275`

- [ ] **Step 1: Audit current Chicago crime data**

Run a sanity query:

```sql
select date_trunc('month', occurred_at) as m, count(*)
from nypd_complaints
where metro='chicago'
group by 1 order by 1 desc limit 12;
```

If only the last few weeks exist (or nothing), continue. If full history is present, skip to Step 4.

- [ ] **Step 2: Build the backfill script**

Model on `scripts/lapd-crime-backfill.mjs`. Source: `https://data.cityofchicago.org/resource/ijzp-q8t2.json` (Crimes – 2001 to Present). Use SODA pagination with `$limit=50000&$offset=N`. Reuse `categorizeChicagoCrime()` from `route.ts`.

Fields to map:
- `id` → `external_id`
- `date` → `occurred_at`
- `primary_type` + `description` → `category` via `categorizeChicagoCrime()`
- `latitude`, `longitude` → coords
- `community_area`, `district`, `ward` → keep as JSONB metadata
- ZIP code: derive via reverse geocode (Chicago SODA doesn't include ZIP) — use a static `community_area_id → zip[]` lookup table, or fall back to PostGIS-free haversine against a small ZIP centroid file.

- [ ] **Step 3: Run the backfill**

Stage: pull last 5 years to start (2021–present). Confirm `crime_by_zip` returns sane numbers. Then optionally extend back to 2001.

- [ ] **Step 4: Verify the dashboard**

Visit `/chicago/crime` and confirm: chips render, top zips populate, YoY chart populates, `crime_all_zip_trends` doesn't time out. If it times out, lower the `num_months` parameter Chicago passes (the LA page already has a try-catch fallback).

---

## Task 2: Houston Crime — Backfill + Verify

**Files:**
- New: `scripts/houston-crime-backfill.mjs`
- Verify: `src/app/api/cron/sync/route.ts:~4227`

- [ ] **Step 1: Audit Houston data depth**

Same query as Task 1 with `metro='houston'`.

- [ ] **Step 2: Build the backfill script**

Houston NIBRS data lives in ArcGIS FeatureServer layers (the existing `syncHoustonCrimes()` already calls layers 0–3). Backfill differs from cron sync only in pagination — cron uses recent-window; backfill needs full date range.

Use `where=OccurredDate >= TIMESTAMP 'YYYY-MM-DD'` filters and page via `resultOffset` + `resultRecordCount=2000` until ArcGIS returns `exceededTransferLimit=false`.

- [ ] **Step 3: Run the backfill (last 3 years)**

Houston NIBRS only goes back to mid-2023 (HPD migration). Anything before requires legacy CSVs from data.houstontx.gov — defer that.

- [ ] **Step 4: Verify the dashboard**

Visit `/houston/crime`.

---

## Task 3: Miami Crime — Replace the Stub

**Files:**
- Modify: `src/app/api/cron/sync/route.ts:3783-3792`
- New: `scripts/miami-crime-backfill.mjs`

- [ ] **Step 1: Pick a source**

The existing stub claims "MDPD not yet available via ArcGIS." Re-evaluate options:

1. **Miami-Dade Open Data** — `https://gis-mdc.opendata.arcgis.com/` hosts MDPD calls-for-service feature layers. Verify a viable layer exists by browsing the catalog. If yes, use it.
2. **City of Miami Police Open Data** — Smaller jurisdiction (city only, not the county) but published on Socrata. Acceptable as a starting point.
3. **FBI NIBRS via OpenJustice / Florida FDLE bulk dumps** — Annual only, not useful for live dashboard.

Pick option 1 if available, otherwise option 2 with a banner noting "City of Miami only."

- [ ] **Step 2: Implement `syncMiamiCrimes()`**

Replace the stub. Mirror `syncChicagoCrimes()` structure: paginate, categorize, upsert into `nypd_complaints` with `metro='miami'`.

- [ ] **Step 3: Build + run `miami-crime-backfill.mjs`**

3-year window minimum.

- [ ] **Step 4: Verify the dashboard**

Visit `/miami/crime`. If the source is city-only, add a `<DataSourceBanner>` to the page header so users understand the scope.

---

## Task 4: Performance Hardening

**Files:**
- New: `supabase/migrations/20260410200000_crime_rpcs_metro_index.sql`

- [ ] **Step 1: Add metro composite index**

```sql
create index if not exists nypd_complaints_metro_occurred_zip_idx
  on nypd_complaints (metro, occurred_at desc, zip_code);
```

- [ ] **Step 2: Re-test `crime_all_zip_trends` for each new metro**

Confirm it returns within 8 seconds for `num_months=24`. If not, pre-aggregate into a `crime_zip_monthly` materialized view refreshed nightly.

---

## Task 5: Cron Schedule Audit

**Files:**
- Modify: `vercel.json` or `.github/workflows/*` (whichever drives cron)

- [ ] **Step 1: Confirm Chicago/Miami/Houston crime sync is in the cron rotation**

The sync route reads `?metros=` and `?source=crimes` query params. Verify daily cron hits each new metro with `source=crimes`. Add missing entries.

---

## Done When

- `select metro, count(*) from nypd_complaints group by 1` shows 5 metros, all with ≥3 years of data
- `/chicago/crime`, `/houston/crime`, `/miami/crime` all render without errors
- A spot-check zip on each page shows non-zero violent + property counts
- `crime_all_zip_trends` returns ≤8s for each metro
- Daily cron job is logged for each metro the morning after deploy
