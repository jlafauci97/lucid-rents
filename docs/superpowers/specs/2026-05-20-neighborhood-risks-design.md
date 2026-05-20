# Neighborhood Risks — Design Spec

**Status:** Draft for review
**Date:** 2026-05-20
**Scope:** NYC v1, single-city launch
**Owner:** Jesse

---

## 1. Problem & Goal

Renters touring an apartment can't tell what's actually around the building from a listing photo. Listings hide proximity to homeless shelters, methadone clinics, 24/7 siren sources, construction sites, sanitation garages, brownfields, rat infestations, and similar quality-of-life factors. Renters discover these only after they've signed a lease.

**Goal:** Ship a tenant-tools tool, **Neighborhood Risks**, that takes a building address and surfaces every publicly knowable "negative POI" within a **0.75 mile** radius, organized into four categories. NYC only at launch; the table schema and sync architecture are city-agnostic so we can extend to LA/Chicago/Miami later.

**Anti-goal:** This is not a NIMBY tool, a sex-offender stalking list, or a vehicle for stigmatizing people experiencing homelessness. Design choices throughout favor transparency, count-only treatment for the most sensitive data, and explicit source attribution.

---

## 2. Information Architecture

### 2.1 Routes

| Route | Purpose | Render |
|---|---|---|
| `/[city]/tenant-tools/neighborhood-risks` | Landing + address search | Server component, ISR 1 hr |
| `/[city]/tenant-tools/neighborhood-risks/[buildingSlug]` | Results page for one building | Server component, ISR 6 hr |

NYC only at launch. Other cities receive `notFound()` until they're synced (mirrors the `/encampments` LA-only gate).

### 2.2 Nav integration

Add to `src/components/layout/NavDropdown.tsx`:

```ts
{
  path: "/tenant-tools/neighborhood-risks",
  icon: ShieldAlert,
  label: "Neighborhood Risks",
  description: "What's nearby that listings won't tell you",
  cities: ["nyc"],
}
```

Add a 6th card to the tenant-tools hub grid (`src/app/[city]/tenant-tools/page.tsx`), city-gated to NYC, using the same card pattern as the existing five.

---

## 3. Categories & Sources

### 3.1 Section A — Public-safety facilities (color: red `#DC2626`)

| Sub-category | Data source | Notes |
|---|---|---|
| **Homeless shelters (adult)** | Tier 1: NYC Open Data — DHS Drop-In Centers, DHS Homebase, DYCD RHY, HPD supportive housing. Tier 2: scrape Coalition for the Homeless directory, WIN, CAMBA, BRC, Bowery Mission, Father's Heart. | **Family shelters excluded.** Single-adult shelters and youth/supportive housing only. |
| **Migrant / asylum-seeker reception centers** | Tier 1: NYC Open Data on city contracts. Tier 2: NYC Mayor press releases, THE CITY's HERRC tracker, NY Times reporting. | HERRCs (Roosevelt Hotel, Floyd Bennett, Randall's, etc.) + designated asylum hotels. UI carries "Locations may shift as humanitarian response evolves" caveat. |
| **Methadone / OASAS treatment** | NYS OASAS Treatment Provider Directory | Public, no scraping needed. |
| **Halfway houses / re-entry** | Federal BOP RRC directory + NYS DOCCS | Public. |
| **Sex offender registry (Level 2/3)** | NYS DCJS Sex Offender Registry | **Count-only** treatment. See §6. |

### 3.2 Section B — 24/7 noise sources (color: amber `#F59E0B`)

| Sub-category | Data source |
|---|---|
| **Sirens (FDNY · NYPD · ER)** | NYC FDNY firehouse list + NYPD precinct list + DOHMH hospital list, filtered to active ER bays. **One unified `sub_category = 'sirens'`** — each facility is one row, with the originating institution in `metadata.facility_type` (`'firehouse'` / `'precinct'` / `'hospital_er'`). UI collapses them into a single "Sirens" block but the item list distinguishes per-row. |
| **Active construction** | Existing DOB job filings we already sync. Filter: status = "in progress", filed within last 90 days, job description matches construction-noise keywords. `sub_category = 'active_construction'`. |
| **Elevated train / highway proximity** | NYC LION shapefile for above-ground subway segments + FHWA NHS for highway segments. **Line-to-point derivation**: at sync time, sample one point every ~150 ft along each segment, store as separate `nearby_concerns` rows with `sub_category = 'elevated_rail'` or `'highway'`. `metadata` carries `segment_id` and `direction` so we can de-duplicate the same line at render time. This keeps the schema point-only and lets us use the same `ST_DWithin` query everywhere. |

### 3.3 Section C — Environmental / air quality (color: green `#10B981`)

| Sub-category | Data source |
|---|---|
| **Industrial / brownfield** | EPA Superfund + NYS DEC Brownfields + NYC EDC Industrial Business Zones |
| **DSNY garages / transfer stations** | NYC Open Data — DSNY facilities |

### 3.4 Section D — Block-level reputation (color: purple `#8B5CF6`)

All three derive from data we **already sync**. No new sync work.

| Sub-category | Source we already have |
|---|---|
| **Rat inspection failures (last 12 mo)** | DOHMH rat data |
| **311 noise complaints (last 90 d)** | NYC 311 (already synced) |
| **Bedbug history (last 3 yr)** | HPD bedbug filings |

---

## 4. Data Model

### 4.1 New table: `nearby_concerns`

A single unified POI table. All Tier-1 and Tier-2 syncs write here. Block-level (Section D) data is **not** written here — it's queried directly from existing tables when rendering.

```sql
CREATE TABLE nearby_concerns (
  id BIGSERIAL PRIMARY KEY,
  metro TEXT NOT NULL,                 -- 'nyc' (later: 'los-angeles', 'chicago', 'miami')
  category TEXT NOT NULL CHECK (category IN ('public_safety', 'noise', 'environmental')),
  -- Note: Section D ('block_level') is NOT stored here — it's queried live from
  -- existing tables (nyc_311, hpd_bedbugs, dohmh_rats) at render time.
  sub_category TEXT NOT NULL,          -- 'homeless_shelter_adult' | 'migrant_reception' | etc.
  name TEXT NOT NULL,
  address TEXT,
  borough TEXT,
  neighborhood TEXT,
  geom geometry(Point, 4326) NOT NULL,
  lat NUMERIC(10, 7),
  lng NUMERIC(10, 7),
  source TEXT NOT NULL,                -- 'nyc_open_data' | 'coalition_for_homeless' | 'dob_filings' | 'thecity_tracker'
  source_url TEXT,
  source_record_id TEXT,               -- upstream stable ID for upserts
  metadata JSONB DEFAULT '{}'::jsonb,  -- type-specific extras: bed_count, license_no, etc.
  active BOOLEAN DEFAULT TRUE,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_synced TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT nearby_concerns_unique_source UNIQUE (source, source_record_id)
);

CREATE INDEX nearby_concerns_geom_gist ON nearby_concerns USING GIST (geom);
CREATE INDEX nearby_concerns_metro_idx ON nearby_concerns(metro, active);
CREATE INDEX nearby_concerns_cat_idx ON nearby_concerns(metro, category, sub_category) WHERE active = TRUE;
```

### 4.2 New table: `sex_offender_locations_restricted`

Separate table. No `name`, no `address` columns. RLS denies all SELECT; only an RPC returns counts. This is the **only** way the count makes it to the client.

```sql
CREATE TABLE sex_offender_locations_restricted (
  id BIGSERIAL PRIMARY KEY,
  metro TEXT NOT NULL,
  level INT NOT NULL CHECK (level IN (2, 3)),
  geom geometry(Point, 4326) NOT NULL,
  source TEXT NOT NULL DEFAULT 'nys_dcjs',
  source_record_id TEXT,
  last_synced TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sex_offender_unique UNIQUE (source, source_record_id)
);

CREATE INDEX sex_offender_geom_gist ON sex_offender_locations_restricted USING GIST (geom);
ALTER TABLE sex_offender_locations_restricted ENABLE ROW LEVEL SECURITY;
-- No SELECT policies; service role only writes.

CREATE OR REPLACE FUNCTION count_sex_offenders_near(
  lat double precision,
  lng double precision,
  radius_meters int DEFAULT 1207  -- 0.75 mi
) RETURNS int LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT count(*)::int
  FROM sex_offender_locations_restricted
  WHERE ST_DWithin(
    geom::geography,
    ST_MakePoint(lng, lat)::geography,
    radius_meters
  );
$$;

GRANT EXECUTE ON FUNCTION count_sex_offenders_near TO anon, authenticated;
```

### 4.3 New table: `nearby_concerns_overrides`

Admin escape hatch. If a complaint comes in or a row is wrong, we flag here without rewriting the sync.

```sql
CREATE TABLE nearby_concerns_overrides (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('hide', 'rename', 'reclassify')),
  new_name TEXT,
  new_category TEXT,
  new_sub_category TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source, source_record_id)
);
```

Query layer joins overrides into the result before returning.

---

## 5. Sync Architecture

### 5.1 Single edge function, modular sub-syncs

`supabase/functions/sync-nearby-concerns/index.ts` orchestrates:

```
sync-nearby-concerns/
├── index.ts                       -- entry point, dispatches by ?source= param
├── _shared/upsert.ts              -- common upsert with source+source_record_id key
└── modules/
    ├── shelters-nyc-opendata.ts
    ├── shelters-coalition.ts      -- scrapes Coalition for the Homeless
    ├── shelters-win-camba-brc.ts  -- scrapes 3 contractor sites
    ├── shelters-faithbased.ts     -- Bowery Mission, Father's Heart, etc.
    ├── migrant-herrc.ts           -- city press releases + THE CITY tracker
    ├── methadone-oasas.ts         -- NYS OASAS API
    ├── halfway-houses.ts          -- BOP + DOCCS
    ├── sex-offender-nys.ts        -- writes to restricted table only
    ├── sirens.ts                  -- FDNY + NYPD + DOHMH consolidation
    ├── dsny-garages.ts
    └── env-brownfield.ts          -- EPA + DEC + IBZ
```

Each module:
1. Fetches its source
2. Normalizes to `nearby_concerns` row shape (or `sex_offender_locations_restricted` for that one)
3. Upserts by `(source, source_record_id)`
4. Marks rows it didn't see as `active = FALSE` (soft-delete, never hard-delete)
5. Logs row counts to the existing `sync_log` table (already used by `sync-energy`, `sync` orchestrator, etc.). Each module inserts a row per run with `source = 'nearby-concerns-shelters-coalition'` (etc.), `records_synced`, `completed_at`, and `status`

**No robots.txt / TOS gating** per Tier 2 sources. (Per user direction.)

### 5.2 Schedule

Supabase cron — once weekly, Sunday 03:00 ET:

```
0 7 * * 0  sync-nearby-concerns?source=all
```

Granular `?source=shelters-coalition` etc. is supported for manual triggers when a single source needs re-sync.

### 5.3 Backfill scripts (machine-local, not edge functions)

For initial historical/curated loads or sources that aren't well-suited to edge functions:

```
scripts/sync-nearby-concerns-nyc.mjs   # mirrors edge function for one-shot loads
scripts/scrape-nyc-shelter-directories.mjs   # heavier scrape with retries
```

### 5.4 Item-record metadata examples

```jsonc
// homeless shelter
{ "operator": "Coalition for the Homeless", "population": "adult_male", "capacity": 200 }

// migrant reception center
{ "facility_type": "HERRC", "opened": "2023-07", "capacity_estimate": 850, "status": "active" }

// methadone clinic
{ "license": "OASAS-12345", "services": ["methadone", "buprenorphine"] }

// sex offender (restricted table)
// no metadata — intentionally minimal
```

---

## 6. Sex Offender — Sensitive Treatment

### 6.1 Data flow

- Sync writes points to `sex_offender_locations_restricted` (RLS-denied)
- Client calls RPC `count_sex_offenders_near(lat, lng, 1207)` which returns an integer
- UI displays `{count} registered offenders within 0.75 mi` only
- No names, no exact addresses, no photos ever leave the database

### 6.2 UI treatment

The sex-offender block in Section A has a distinct visual style (gradient red→amber top stripe instead of solid red) and includes:

- `Privacy first:` callout strip — "Counts only — no names, photos, or addresses."
- "View official registry →" link to `https://www.criminaljustice.ny.gov/SomsSUBDirectory/search_index.jsp`
- Source attribution: "NYS DCJS · Level 2/3"

### 6.3 Defense in depth

- RLS on the table itself
- RPC is the only access path
- RPC returns integers only (no row data)
- Database service role keys are server-only; client never has them
- A bad actor with the client anon key still cannot exfiltrate addresses

---

## 7. Calm Score

A single 0–10 number to anchor the hero. Heuristic, not statistical. Easy to tune; document the formula publicly so users understand what they're looking at.

```
base = 10.0
penalties:
  for each public-safety POI within 0.25 mi:  -0.5
  for each public-safety POI within 0.75 mi:  -0.2
  for each noise POI within 0.25 mi:          -0.4
  for each noise POI within 0.75 mi:          -0.15
  for each environmental POI within 0.25 mi:  -0.6
  for each environmental POI within 0.75 mi:  -0.2

block-level (relative to NYC median within a 0.25 mi circle):
  311 noise ≥ 1.5× median:   -0.5
  311 noise ≥ 3.0× median:   additional -0.5
  rat failures ≥ 1.5× median: -0.5
  bedbugs ≥ 1.5× median:      -0.5

clamp to [0.0, 10.0], round to 1 decimal
```

**Baseline definition:** "NYC median" = the median count returned by the same
`ST_DWithin(..., 0.25 mi)` query when run against the centroid of every NYC
building in our `buildings` table. Pre-computed offline once per quarter
(or when 311/rat/bedbug volumes meaningfully shift) and stored as constants in
a new `calm_score_baselines` table:

```sql
CREATE TABLE calm_score_baselines (
  metric TEXT PRIMARY KEY,             -- 'nyc_noise_311_90d' | 'nyc_rats_12mo' | 'nyc_bedbugs_3y'
  median_value NUMERIC NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);
```

The first compute runs as a one-shot script (`scripts/compute-calm-score-baselines.mjs`).

Stored as a computed column in the results page query — not cached at sync time, because it depends on the building's lat/lng. Cheap to compute live (PostGIS index + a count) and re-runs on each ISR revalidation.

A "Why this score?" link below the score expands a breakdown showing each penalty applied.

---

## 8. UI Design

### 8.1 Landing page (`/[city]/tenant-tools/neighborhood-risks`)

- Hero (same navy palette as results page, simpler — no concentric pulse)
- Big address search input
- Autocomplete: queries `buildings` table by name + address, NYC only
- "Use my current location" geolocation fallback (queries by lat/lng → nearest building)
- Below: 3-bullet explainer "What we check / Where the data comes from / What we don't show"
- Example links: 3 popular NYC addresses

**Free-text address (non-Lucid building) is v1.1.** Launch is buildings-table-only, matching the existing `/tenant-tools/checklist` pattern.

### 8.2 Results page (`/[city]/tenant-tools/neighborhood-risks/[buildingSlug]`)

Per the locked v7 mockup at `.superpowers/brainstorm/34445-1779279812/results-v7.html`:

**Hero (`<NeighborhoodRisksHero/>`):**
- Layered background: radial blue glow right, faint warm radial left, navy linear gradient
- Subtle dot-grid overlay
- Decorative concentric "radius pulse" SVG anchored right
- Breadcrumbs (Home › NYC › Tenant Tools › Neighborhood Risks)
- Red-toned eyebrow chip: "Neighborhood Risks Report"
- 40px display address title
- Location chips below: borough · neighborhood · `⊙ 0.75 mi radius` (blue-accented)
- 3 stat tiles (backdrop-blur): Nearby concerns (red) · Within 1 block · Calm score (gold gradient text)

**Sticky quick-jump nav (`<NeighborhoodRisksJumpNav/>`):**
- Sticks to top on scroll
- "Jump to:" label + 4 pills with category-color dot + name + count badge
- Smooth-scrolls to corresponding `<section id>`

**Body — 4 sections:**
- Section header: 4px colored vertical bar + title + right-aligned meta line ("7 within 0.75 mi · 4 sub-categories")
- 3-column grid of vertical blocks below
- Each block:
  - 4px category-color top stripe
  - 40px navy rounded square with white-stroke lucide icon
  - Title row: `<h4>` + colored pill badge ("2 nearby" / "High" / "All clear")
  - Source line
  - Big numeric count (30px)
  - Item list pinned to bottom: name + distance + walk-time
- Mobile: grid collapses to 1 column
- "All clear" blocks (count = 0) have `opacity: 0.7` so they don't visually compete

**Sex-offender block** uses the same shape but red→amber gradient stripe, privacy-note strip, and registry link instead of an items list.

### 8.3 Component file map

```
src/components/neighborhood-risks/
├── NeighborhoodRisksHero.tsx
├── NeighborhoodRisksJumpNav.tsx
├── NeighborhoodRisksSection.tsx       -- wraps a category section
├── NeighborhoodRisksBlock.tsx         -- one POI sub-category block
├── NeighborhoodRisksSensitiveBlock.tsx -- sex offender variant
├── NeighborhoodRisksEmptyBlock.tsx    -- "All clear" variant
├── NeighborhoodRisksSearch.tsx        -- landing page search input
└── calm-score.ts                      -- score formula + breakdown helpers

src/lib/neighborhood-risks/
├── queries.ts          -- server-side data fetching from nearby_concerns
├── distance.ts         -- walk-time formatting, distance bucketing
├── icons.ts            -- maps sub_category → lucide icon component
└── colors.ts           -- category → color constants
```

### 8.4 Color system

```ts
export const CATEGORY_COLORS = {
  public_safety: { hex: "#DC2626", bg: "#FEF2F2", border: "#FECACA", label: "Public-safety" },
  noise:         { hex: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A", label: "24/7 Noise" },
  environmental: { hex: "#10B981", bg: "#F0FDF4", border: "#BBF7D0", label: "Environmental" },
  block_level:   { hex: "#8B5CF6", bg: "#FAF5FF", border: "#DDD6FE", label: "Block-level" },
} as const;
```

Icons stay **white-on-navy `#0F1D2E`** across all blocks (matches existing tenant-tools card pattern). Category color is conveyed via stripe + pill, not icon background.

---

## 9. Query Patterns

### 9.1 Result page server-side load

For a given building `{lat, lng, slug}`:

```sql
-- All non-sex-offender, non-block-level POIs within 0.75 mi:
SELECT
  id, category, sub_category, name, address, source, source_url,
  ST_Distance(geom::geography, ST_MakePoint($1, $2)::geography) / 1609.344 AS distance_mi
FROM nearby_concerns nc
LEFT JOIN nearby_concerns_overrides ov USING (source, source_record_id)
WHERE
  nc.metro = 'nyc'
  AND nc.active = TRUE
  AND (ov.action IS NULL OR ov.action != 'hide')
  AND ST_DWithin(geom::geography, ST_MakePoint($1, $2)::geography, 1207)
ORDER BY distance_mi ASC;
```

Server-side then groups by `(category, sub_category)` and computes per-block counts.

Sex-offender count is a separate RPC call:
```ts
const { data: offenderCount } = await supabase.rpc("count_sex_offenders_near", {
  lat, lng, radius_meters: 1207
});
```

Block-level (Section D) counts query existing tables:
```ts
const [rats, noise, bedbugs] = await Promise.all([
  countNearbyRats(lat, lng, 1207),       // existing DOHMH table
  countNearbyNoise311(lat, lng, 1207),   // existing 311 table
  countNearbyBedbugs(lat, lng, 1207),    // existing HPD bedbug table
]);
```

### 9.2 Caching

- Page is a Next.js server component with `revalidate = 21600` (6 hr ISR)
- Subsequent hits hit the CDN-cached HTML
- Sync runs weekly, so 6 hr cache is generous

---

## 10. Out of Scope / v1.1+

- Free-text address geocoding (launch is building-autocomplete only)
- Shareable result URLs with state in the path
- Other cities (LA, Chicago, Miami) — schema is city-agnostic, but sync modules don't exist yet
- "What changed since last sync?" diff view
- Embeddable widget for partner sites
- Per-user concern-weighting (e.g., "I don't care about sirens")
- Aggregated **block-stat** sub-category for migrant centers showing trend ("+3 since Q1 2025")

---

## 11. Open Questions

Things I want to surface for the user before implementation:

1. **Family shelters confirmed excluded?** Spec excludes them per direction. Worth one last sanity check.
2. **Migrant reception center caveat copy** — proposed: *"Locations may shift as the city's humanitarian response evolves — data current as of [last sync]."* Want different wording?
3. **Calm score weights** — I picked starting numbers. Want to tune them post-launch based on what feels right on real NYC addresses, or get more rigorous now?
4. **Disclaimer modal on first visit?** — many real-estate sites pop a one-time "this is informational, not legal advice" modal. Open to either path.
5. **Admin UI for `nearby_concerns_overrides`** — manage via SQL initially, or build a small admin page in v1?

---

## 12. Success Criteria

- [ ] Tool ships behind NYC city gate; renders correctly for any NYC building in our `buildings` table
- [ ] `nearby_concerns` table populated with > 500 NYC rows across all Tier-1 and Tier-2 sub-categories
- [ ] Sex-offender count RPC returns within 50 ms for any NYC point
- [ ] Results page TTFB < 800 ms on cold ISR cache, < 100 ms on warm
- [ ] No exact sex-offender addresses are exposed to the client under any access path
- [ ] UI matches v7 mockup (hero + sticky jump nav + sectioned vertical grids)
- [ ] Dropdown entry added to `NavDropdown.tsx`, gated to NYC
- [ ] Hub card added to `/[city]/tenant-tools` page for NYC
