# Neighborhood Risks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Neighborhood Risks tool for NYC under `/nyc/tenant-tools/neighborhood-risks` that, for any NYC building, surfaces homeless/migrant shelters, methadone clinics, sirens, brownfields, construction, sex-offender counts, rats/bedbugs/311-noise — within 0.75 mi.

**Architecture:** Single PostGIS table (`nearby_concerns`) populated by a weekly edge function (`sync-nearby-concerns`) that dispatches to ~11 source-specific modules. A separate RLS-gated table (`sex_offender_locations_restricted`) returns counts only via RPC. Server components fetch and render category sections; UI is white-on-navy icons inside vertical blocks, 4 colored category sections, sticky quick-jump nav, new hero with concentric pulse SVG.

**Tech Stack:** Next.js 15 App Router · TypeScript · Supabase Postgres + PostGIS · Supabase Edge Functions (Deno) · Tailwind CSS · lucide-react · vitest. Existing patterns to mirror: `supabase/functions/sync-encampments/`, `src/app/[city]/encampments/`, `src/lib/seo.ts`, `_shared/batch-upsert.ts`.

**Spec:** [`docs/superpowers/specs/2026-05-20-neighborhood-risks-design.md`](../specs/2026-05-20-neighborhood-risks-design.md)

---

## File Map

**New (created in this plan):**

```
supabase/migrations/20260520100000_nearby_concerns.sql
supabase/migrations/20260520100100_sex_offender_restricted.sql
supabase/migrations/20260520100200_nearby_concerns_overrides.sql
supabase/migrations/20260520100300_calm_score_baselines.sql

supabase/functions/_shared/nearby-concerns-helpers.ts
supabase/functions/sync-nearby-concerns/index.ts
supabase/functions/sync-nearby-concerns/modules/shelters-nyc-opendata.ts
supabase/functions/sync-nearby-concerns/modules/shelters-coalition.ts
supabase/functions/sync-nearby-concerns/modules/shelters-win-camba-brc.ts
supabase/functions/sync-nearby-concerns/modules/shelters-faithbased.ts
supabase/functions/sync-nearby-concerns/modules/migrant-herrc.ts
supabase/functions/sync-nearby-concerns/modules/methadone-oasas.ts
supabase/functions/sync-nearby-concerns/modules/halfway-houses.ts
supabase/functions/sync-nearby-concerns/modules/sirens.ts
supabase/functions/sync-nearby-concerns/modules/dsny-garages.ts
supabase/functions/sync-nearby-concerns/modules/env-brownfield.ts
supabase/functions/sync-nearby-concerns/modules/rail-highway-points.ts
supabase/functions/sync-nearby-concerns/modules/sex-offender-nys.ts
supabase/functions/sync-nearby-concerns/modules/active-construction.ts

scripts/compute-calm-score-baselines.mjs

src/lib/neighborhood-risks/queries.ts
src/lib/neighborhood-risks/distance.ts
src/lib/neighborhood-risks/calm-score.ts
src/lib/neighborhood-risks/icons.tsx
src/lib/neighborhood-risks/colors.ts
src/lib/neighborhood-risks/types.ts

src/components/neighborhood-risks/NeighborhoodRisksHero.tsx
src/components/neighborhood-risks/NeighborhoodRisksJumpNav.tsx
src/components/neighborhood-risks/NeighborhoodRisksSection.tsx
src/components/neighborhood-risks/NeighborhoodRisksBlock.tsx
src/components/neighborhood-risks/NeighborhoodRisksEmptyBlock.tsx
src/components/neighborhood-risks/NeighborhoodRisksSensitiveBlock.tsx
src/components/neighborhood-risks/NeighborhoodRisksSearch.tsx

src/app/[city]/tenant-tools/neighborhood-risks/page.tsx
src/app/[city]/tenant-tools/neighborhood-risks/[buildingSlug]/page.tsx

tests/lib/neighborhood-risks-distance.test.ts
tests/lib/neighborhood-risks-calm-score.test.ts
tests/lib/neighborhood-risks-queries.test.ts
tests/components/neighborhood-risks-block.test.tsx
tests/components/neighborhood-risks-jumpnav.test.tsx
tests/edge/nearby-concerns-helpers.test.ts
tests/edge/shelters-nyc-opendata.test.ts
tests/edge/sirens.test.ts
tests/edge/rail-highway-points.test.ts
```

**Modified:**

```
src/components/layout/NavDropdown.tsx          (add entry)
src/app/[city]/tenant-tools/page.tsx           (add hub card)
supabase/config.toml                           (cron schedule, IF that's where crons live)
```

---

## Phase 1 — Database Foundations

### Task 1: Create `nearby_concerns` table

**Files:**
- Create: `supabase/migrations/20260520100000_nearby_concerns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260520100000_nearby_concerns.sql

CREATE TABLE IF NOT EXISTS nearby_concerns (
  id BIGSERIAL PRIMARY KEY,
  metro TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('public_safety', 'noise', 'environmental')),
  -- Section D ('block_level') is NOT stored here — derived live from nyc_311, hpd_bedbugs, dohmh_rats.
  sub_category TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  borough TEXT,
  neighborhood TEXT,
  geom geometry(Point, 4326) NOT NULL,
  lat NUMERIC(10, 7),
  lng NUMERIC(10, 7),
  source TEXT NOT NULL,
  source_url TEXT,
  source_record_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT nearby_concerns_unique_source UNIQUE (source, source_record_id)
);

CREATE INDEX IF NOT EXISTS nearby_concerns_geom_gist ON nearby_concerns USING GIST (geom);
CREATE INDEX IF NOT EXISTS nearby_concerns_metro_active_idx ON nearby_concerns (metro, active);
CREATE INDEX IF NOT EXISTS nearby_concerns_cat_idx
  ON nearby_concerns (metro, category, sub_category)
  WHERE active = TRUE;

COMMENT ON TABLE nearby_concerns IS 'Unified POI table for Neighborhood Risks tenant tool';
COMMENT ON COLUMN nearby_concerns.source IS 'Logical source key, e.g. nyc_open_data_dhs_dropin, coalition_for_homeless';
COMMENT ON COLUMN nearby_concerns.source_record_id IS 'Stable upstream ID for upserts';
```

- [ ] **Step 2: Apply migration locally**

```bash
npx supabase db push --linked
```

Expected: `Applied migration 20260520100000_nearby_concerns.sql`

- [ ] **Step 3: Verify schema**

```bash
npx supabase db dump --linked --schema public --data-only=false | grep -A 5 "CREATE TABLE.*nearby_concerns"
```

Expected: shows the table with all columns.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260520100000_nearby_concerns.sql
git commit -m "feat(db): add nearby_concerns table for neighborhood risks tool"
```

---

### Task 2: Create `sex_offender_locations_restricted` + RPC

**Files:**
- Create: `supabase/migrations/20260520100100_sex_offender_restricted.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260520100100_sex_offender_restricted.sql

CREATE TABLE IF NOT EXISTS sex_offender_locations_restricted (
  id BIGSERIAL PRIMARY KEY,
  metro TEXT NOT NULL,
  level INT NOT NULL CHECK (level IN (2, 3)),
  geom geometry(Point, 4326) NOT NULL,
  source TEXT NOT NULL DEFAULT 'nys_dcjs',
  source_record_id TEXT NOT NULL,
  last_synced TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT sex_offender_unique UNIQUE (source, source_record_id)
);

CREATE INDEX IF NOT EXISTS sex_offender_geom_gist
  ON sex_offender_locations_restricted USING GIST (geom);

ALTER TABLE sex_offender_locations_restricted ENABLE ROW LEVEL SECURITY;
-- No SELECT policies — service role only writes, RPC only reads counts.

CREATE OR REPLACE FUNCTION count_sex_offenders_near(
  lat double precision,
  lng double precision,
  radius_meters int DEFAULT 1207
) RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT count(*)::int
  FROM sex_offender_locations_restricted
  WHERE ST_DWithin(
    geom::geography,
    ST_MakePoint(lng, lat)::geography,
    radius_meters
  );
$$;

REVOKE ALL ON FUNCTION count_sex_offenders_near FROM PUBLIC;
GRANT EXECUTE ON FUNCTION count_sex_offenders_near TO anon, authenticated;

COMMENT ON FUNCTION count_sex_offenders_near IS 'Returns count of registered offenders within radius. Never exposes individual records.';
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push --linked
```

- [ ] **Step 3: Verify RLS blocks reads**

```bash
psql "$DATABASE_URL" -c "SET ROLE anon; SELECT count(*) FROM sex_offender_locations_restricted;"
```

Expected: `ERROR: permission denied for table sex_offender_locations_restricted` (or returns 0 with RLS denying rows).

- [ ] **Step 4: Verify RPC works**

```bash
psql "$DATABASE_URL" -c "SET ROLE anon; SELECT count_sex_offenders_near(40.7679, -73.9819, 1207);"
```

Expected: returns `0` (empty table) without error.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260520100100_sex_offender_restricted.sql
git commit -m "feat(db): add sex_offender_locations_restricted with RLS + count RPC"
```

---

### Task 3: Create `nearby_concerns_overrides`

**Files:**
- Create: `supabase/migrations/20260520100200_nearby_concerns_overrides.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260520100200_nearby_concerns_overrides.sql

CREATE TABLE IF NOT EXISTS nearby_concerns_overrides (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('hide', 'rename', 'reclassify')),
  new_name TEXT,
  new_category TEXT,
  new_sub_category TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT nearby_concerns_overrides_unique UNIQUE (source, source_record_id)
);

COMMENT ON TABLE nearby_concerns_overrides IS 'Admin escape hatch for hiding or fixing nearby_concerns rows without rewriting the sync.';
```

- [ ] **Step 2: Apply migration, verify, commit**

```bash
npx supabase db push --linked
git add supabase/migrations/20260520100200_nearby_concerns_overrides.sql
git commit -m "feat(db): add nearby_concerns_overrides admin escape hatch"
```

---

### Task 4: Create `calm_score_baselines`

**Files:**
- Create: `supabase/migrations/20260520100300_calm_score_baselines.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260520100300_calm_score_baselines.sql

CREATE TABLE IF NOT EXISTS calm_score_baselines (
  metric TEXT PRIMARY KEY,
  median_value NUMERIC NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE calm_score_baselines IS 'Pre-computed NYC medians (per 0.25 mi circle) for block-level penalties in calm-score.';
```

- [ ] **Step 2: Apply, commit**

```bash
npx supabase db push --linked
git add supabase/migrations/20260520100300_calm_score_baselines.sql
git commit -m "feat(db): add calm_score_baselines table"
```

---

## Phase 2 — Shared Sync Helper

### Task 5: Build `_shared/nearby-concerns-helpers.ts`

A wrapper around the existing `batchUpsert` that also handles the **soft-delete-stale-rows** pattern (mark rows from this source not seen this run as `active = FALSE`).

**Files:**
- Create: `supabase/functions/_shared/nearby-concerns-helpers.ts`
- Create: `tests/edge/nearby-concerns-helpers.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/edge/nearby-concerns-helpers.test.ts
import { describe, expect, it, vi } from "vitest";
import { buildConcernRow, normalizeSubCategory } from "../../supabase/functions/_shared/nearby-concerns-helpers";

describe("buildConcernRow", () => {
  it("builds a valid row with computed geom", () => {
    const row = buildConcernRow({
      metro: "nyc",
      category: "public_safety",
      sub_category: "homeless_shelter_adult",
      name: "Test Shelter",
      lat: 40.7679,
      lng: -73.9819,
      source: "nyc_open_data_dhs_dropin",
      source_record_id: "dropin-001",
    });
    expect(row.geom).toBe("SRID=4326;POINT(-73.9819 40.7679)");
    expect(row.active).toBe(true);
    expect(row.metro).toBe("nyc");
  });

  it("throws on invalid category", () => {
    expect(() => buildConcernRow({
      metro: "nyc",
      // @ts-expect-error testing invalid input
      category: "invalid",
      sub_category: "x",
      name: "x",
      lat: 0,
      lng: 0,
      source: "x",
      source_record_id: "x",
    })).toThrow(/category/);
  });
});

describe("normalizeSubCategory", () => {
  it("snake_cases mixed input", () => {
    expect(normalizeSubCategory("Homeless Shelter Adult")).toBe("homeless_shelter_adult");
    expect(normalizeSubCategory("dropin-center")).toBe("dropin_center");
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npx vitest run tests/edge/nearby-concerns-helpers.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

```ts
// supabase/functions/_shared/nearby-concerns-helpers.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type ConcernCategory = "public_safety" | "noise" | "environmental";

export interface ConcernInput {
  metro: string;
  category: ConcernCategory;
  sub_category: string;
  name: string;
  address?: string | null;
  borough?: string | null;
  neighborhood?: string | null;
  lat: number;
  lng: number;
  source: string;
  source_url?: string | null;
  source_record_id: string;
  metadata?: Record<string, unknown>;
}

const VALID_CATEGORIES: ConcernCategory[] = ["public_safety", "noise", "environmental"];

export function buildConcernRow(input: ConcernInput): Record<string, unknown> {
  if (!VALID_CATEGORIES.includes(input.category)) {
    throw new Error(`Invalid category: ${input.category}`);
  }
  if (!input.name?.trim()) {
    throw new Error("name is required");
  }
  if (!input.source_record_id?.trim()) {
    throw new Error("source_record_id is required");
  }
  if (typeof input.lat !== "number" || typeof input.lng !== "number") {
    throw new Error("lat/lng must be numbers");
  }
  return {
    metro: input.metro,
    category: input.category,
    sub_category: input.sub_category,
    name: input.name.trim(),
    address: input.address ?? null,
    borough: input.borough ?? null,
    neighborhood: input.neighborhood ?? null,
    geom: `SRID=4326;POINT(${input.lng} ${input.lat})`,
    lat: input.lat,
    lng: input.lng,
    source: input.source,
    source_url: input.source_url ?? null,
    source_record_id: input.source_record_id,
    metadata: input.metadata ?? {},
    active: true,
    last_synced: new Date().toISOString(),
  };
}

export function normalizeSubCategory(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * Soft-delete: mark rows from `source` not seen in this run as inactive.
 * Call after the upsert phase, passing the set of source_record_ids that WERE seen.
 */
export async function softDeleteUnseen(
  supabase: SupabaseClient,
  source: string,
  seenSourceRecordIds: Set<string>
): Promise<number> {
  if (seenSourceRecordIds.size === 0) return 0;
  const seen = Array.from(seenSourceRecordIds);
  const { error, count } = await supabase
    .from("nearby_concerns")
    .update({ active: false, last_synced: new Date().toISOString() }, { count: "exact" })
    .eq("source", source)
    .eq("active", true)
    .not("source_record_id", "in", `(${seen.map((s) => `"${s}"`).join(",")})`);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Logs to the existing `sync_log` table.
 */
export async function recordSyncRun(
  supabase: SupabaseClient,
  source: string,
  records_synced: number,
  status: "completed" | "failed",
  error_message?: string
): Promise<void> {
  await supabase.from("sync_log").insert({
    source,
    records_synced,
    completed_at: new Date().toISOString(),
    status,
    error: error_message ?? null,
  });
}
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
npx vitest run tests/edge/nearby-concerns-helpers.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/nearby-concerns-helpers.ts tests/edge/nearby-concerns-helpers.test.ts
git commit -m "feat(sync): add nearby-concerns-helpers with row builder and soft-delete"
```

---

## Phase 3 — Tier 1 Sync Modules (NYC Open Data + government feeds)

### Task 6: Shelters from NYC Open Data

This module pulls **public** shelter-adjacent datasets: DHS Drop-In Centers, Homebase, RHY youth shelters, HPD supportive housing. Each becomes a row with the same `sub_category = 'homeless_shelter_adult'` (or `'youth_shelter'` for RHY, `'supportive_housing'` for HPD).

**Files:**
- Create: `supabase/functions/sync-nearby-concerns/modules/shelters-nyc-opendata.ts`
- Create: `tests/edge/shelters-nyc-opendata.test.ts`

- [ ] **Step 1: Look up the actual Socrata dataset IDs**

Open these in a browser, copy the 4-character + 4-character resource IDs from the URL:
- https://data.cityofnewyork.us/Social-Services/DHS-Drop-In-Center-Locations
- https://data.cityofnewyork.us/Social-Services/Homebase-Locations
- https://data.cityofnewyork.us/Social-Services/Runaway-and-Homeless-Youth-Services
- https://data.cityofnewyork.us/Housing-Development/Supportive-Housing-Buildings

Note them as constants at the top of the module file.

- [ ] **Step 2: Write failing test (normalization of one Socrata record)**

```ts
// tests/edge/shelters-nyc-opendata.test.ts
import { describe, expect, it } from "vitest";
import { normalizeDropInRecord } from "../../supabase/functions/sync-nearby-concerns/modules/shelters-nyc-opendata";

describe("normalizeDropInRecord", () => {
  it("converts a Socrata DHS row to a ConcernInput", () => {
    const result = normalizeDropInRecord({
      facility_id: "DIC-001",
      facility_name: "Bowery Drop-In Center",
      address_line_1: "190 Bowery",
      borough: "MANHATTAN",
      latitude: "40.7235",
      longitude: "-73.9939",
    });
    expect(result).toEqual({
      metro: "nyc",
      category: "public_safety",
      sub_category: "homeless_shelter_adult",
      name: "Bowery Drop-In Center",
      address: "190 Bowery",
      borough: "Manhattan",
      lat: 40.7235,
      lng: -73.9939,
      source: "nyc_open_data_dhs_dropin",
      source_record_id: "DIC-001",
      source_url: expect.stringMatching(/^https:\/\/data\.cityofnewyork\.us/),
      metadata: { facility_type: "drop_in" },
    });
  });

  it("returns null when lat/lng missing", () => {
    expect(normalizeDropInRecord({ facility_id: "x", facility_name: "x" })).toBeNull();
  });
});
```

- [ ] **Step 3: Run, fail**

```bash
npx vitest run tests/edge/shelters-nyc-opendata.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement the module**

```ts
// supabase/functions/sync-nearby-concerns/modules/shelters-nyc-opendata.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { batchUpsert } from "../../_shared/batch-upsert.ts";
import {
  buildConcernRow,
  recordSyncRun,
  softDeleteUnseen,
  type ConcernInput,
} from "../../_shared/nearby-concerns-helpers.ts";

// TODO: replace XXXX-XXXX with actual resource IDs looked up in Step 1
const DROP_IN_DATASET = "XXXX-XXXX";
const HOMEBASE_DATASET = "XXXX-XXXX";
const RHY_DATASET = "XXXX-XXXX";
const SUPPORTIVE_HOUSING_DATASET = "XXXX-XXXX";

const SOURCE_DROPIN = "nyc_open_data_dhs_dropin";
const SOURCE_HOMEBASE = "nyc_open_data_dhs_homebase";
const SOURCE_RHY = "nyc_open_data_dycd_rhy";
const SOURCE_SUPPORTIVE = "nyc_open_data_supportive_housing";

function toTitleCase(s: string | undefined): string | null {
  if (!s) return null;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function normalizeDropInRecord(r: Record<string, unknown>): ConcernInput | null {
  const lat = r.latitude ? Number(r.latitude) : null;
  const lng = r.longitude ? Number(r.longitude) : null;
  if (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return {
    metro: "nyc",
    category: "public_safety",
    sub_category: "homeless_shelter_adult",
    name: String(r.facility_name ?? "Unnamed shelter"),
    address: r.address_line_1 ? String(r.address_line_1) : null,
    borough: toTitleCase(r.borough as string | undefined),
    lat,
    lng,
    source: SOURCE_DROPIN,
    source_record_id: String(r.facility_id ?? r.unique_id ?? ""),
    source_url: `https://data.cityofnewyork.us/resource/${DROP_IN_DATASET}.json`,
    metadata: { facility_type: "drop_in" },
  };
}

// Implement normalize*Record for the other 3 datasets following the same pattern.
// All write to nearby_concerns with appropriate sub_category and source.

async function fetchSocrata(datasetId: string): Promise<Record<string, unknown>[]> {
  const url = `https://data.cityofnewyork.us/resource/${datasetId}.json?$limit=50000`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Socrata fetch failed: ${res.status} for ${datasetId}`);
  return await res.json();
}

export async function syncSheltersNycOpenData(supabase: SupabaseClient): Promise<{ synced: number }> {
  const errors: string[] = [];
  let totalSynced = 0;

  // Drop-In Centers
  try {
    const raw = await fetchSocrata(DROP_IN_DATASET);
    const rows = raw.map(normalizeDropInRecord).filter((x): x is ConcernInput => x !== null).map(buildConcernRow);
    const seen = new Set(raw.map((r) => String(r.facility_id ?? r.unique_id ?? "")));
    const count = await batchUpsert(supabase, "nearby_concerns", rows, "source,source_record_id", errors, "shelters-dropin");
    await softDeleteUnseen(supabase, SOURCE_DROPIN, seen);
    await recordSyncRun(supabase, SOURCE_DROPIN, count, "completed");
    totalSynced += count;
  } catch (e) {
    await recordSyncRun(supabase, SOURCE_DROPIN, 0, "failed", (e as Error).message);
    errors.push(`dropin: ${(e as Error).message}`);
  }

  // Repeat for Homebase, RHY, Supportive Housing — same shape with their respective normalize fns.

  if (errors.length > 0) console.error("shelters-nyc-opendata errors:", errors);
  return { synced: totalSynced };
}
```

- [ ] **Step 5: Run tests, pass**

```bash
npx vitest run tests/edge/shelters-nyc-opendata.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/sync-nearby-concerns/modules/shelters-nyc-opendata.ts tests/edge/shelters-nyc-opendata.test.ts
git commit -m "feat(sync): add shelters-nyc-opendata module"
```

---

### Tasks 7–9: Tier 1 modules (same pattern)

Repeat the structure from Task 6 for each of:

| Task | Module | Source | sub_category | Tests |
|---|---|---|---|---|
| 7 | `methadone-oasas.ts` | https://oasas.ny.gov/treatment/find-treatment | `methadone_clinic` | Test normalization of one OASAS record |
| 8 | `halfway-houses.ts` | Federal BOP RRC directory + NYS DOCCS list | `halfway_house` | Test BOP + DOCCS merge |
| 9 | `sirens.ts` | FDNY firehouse list + NYPD precinct list + DOHMH hospital ER list | `sirens` (one sub-cat, `metadata.facility_type` differentiates) | Test all three feed into one sub_category |

For each:
- Look up the actual data source URL
- Write a `normalize*Record(raw): ConcernInput | null` function with a vitest test
- Implement a `sync*(supabase)` orchestrator that fetches → normalizes → upserts → soft-deletes
- Commit per task

---

### Task 10: DSNY garages module

**Files:** `modules/dsny-garages.ts` + test
**Source:** NYC Open Data — DSNY District Garages (Socrata dataset; look up the ID in Step 1 of Task 6 style)
**sub_category:** `dsny_garage`
**Category:** `environmental`
**metadata:** `{ district: "MN07" }`

Same TDD shape as Task 6. Commit per task.

---

### Task 11: Environmental / brownfield module

**Files:** `modules/env-brownfield.ts` + test
**Sources:**
- EPA Superfund National Priorities List (NY state subset) — https://www.epa.gov/superfund/search-superfund-sites-where-you-live
- NYS DEC Brownfield Cleanup Program — https://data.ny.gov/Energy-Environment (look up dataset ID)
- NYC EDC Industrial Business Zones (IBZ) — NYC Open Data shapefile, derive centroid per zone

**sub_category:** `brownfield` (EPA + DEC) or `industrial_zone` (IBZ)
**Category:** `environmental`

Same TDD shape. Commit per task.

---

### Task 12: Rail / highway line-to-point sampling

This is the trickiest module — converts linestrings to points (one row per ~150 ft segment).

**Files:** `modules/rail-highway-points.ts` + `tests/edge/rail-highway-points.test.ts`

- [ ] **Step 1: Write failing test for `sampleLine`**

```ts
// tests/edge/rail-highway-points.test.ts
import { describe, expect, it } from "vitest";
import { sampleLineString } from "../../supabase/functions/sync-nearby-concerns/modules/rail-highway-points";

describe("sampleLineString", () => {
  it("produces a point every ~150 ft along a line", () => {
    // A 1500 ft straight line should yield ~10 points
    const line: Array<[number, number]> = [
      [-73.9940, 40.7480], // start
      [-73.9900, 40.7480], // ~1100 ft east at this latitude
    ];
    const points = sampleLineString(line, 45 /* meters ≈ 150 ft */);
    expect(points.length).toBeGreaterThan(5);
    expect(points.length).toBeLessThan(12);
    // each point is [lng, lat]
    expect(points[0]).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Implement `sampleLineString`**

Use Haversine for distance, linearly interpolate along each segment. Detailed code in the module file.

```ts
// supabase/functions/sync-nearby-concerns/modules/rail-highway-points.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { batchUpsert } from "../../_shared/batch-upsert.ts";
import { buildConcernRow, softDeleteUnseen, recordSyncRun } from "../../_shared/nearby-concerns-helpers.ts";

const SOURCE_RAIL = "nyc_lion_elevated_rail";
const SOURCE_HIGHWAY = "fhwa_nhs_highway";
const SAMPLE_INTERVAL_M = 45; // ~150 ft

export function sampleLineString(
  coords: Array<[number, number]>,
  intervalMeters: number
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let carry = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[i + 1];
    const segLen = haversine(lat1, lng1, lat2, lng2);
    let cursor = -carry;
    while (cursor + intervalMeters < segLen) {
      cursor += intervalMeters;
      const t = cursor / segLen;
      out.push([lng1 + (lng2 - lng1) * t, lat1 + (lat2 - lat1) * t]);
    }
    carry = segLen - cursor;
  }
  return out;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Implementation of fetchElevatedRailSegments() and fetchHighwaySegments() to follow.
// Each returns Array<{ segment_id: string, name: string, coords: [lng, lat][] }>.

export async function syncRailHighwayPoints(supabase: SupabaseClient): Promise<{ synced: number }> {
  // For each line:
  //   const points = sampleLineString(line.coords, SAMPLE_INTERVAL_M);
  //   points.forEach((p, idx) => rows.push(buildConcernRow({
  //     metro: "nyc",
  //     category: "noise",
  //     sub_category: "elevated_rail" or "highway",
  //     name: line.name,
  //     lat: p[1], lng: p[0],
  //     source: SOURCE_RAIL or SOURCE_HIGHWAY,
  //     source_record_id: `${line.segment_id}-${idx}`,
  //     metadata: { segment_id: line.segment_id }
  //   })));
  // Then batchUpsert + softDeleteUnseen + recordSyncRun.
  // Full implementation omitted for brevity — follow Task 6 pattern.
  return { synced: 0 };
}
```

- [ ] **Step 3: Run test, pass**

```bash
npx vitest run tests/edge/rail-highway-points.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/sync-nearby-concerns/modules/rail-highway-points.ts tests/edge/rail-highway-points.test.ts
git commit -m "feat(sync): add rail-highway line-to-point sampler"
```

---

### Task 13: Active construction module

**Files:** `modules/active-construction.ts` + test
**Source:** Query the existing `dob_jobs` table (or whatever NYC DOB filings table we use — check `src/lib/dob.ts` or grep for `dob_jobs`) directly via SQL, no external fetch:

```sql
SELECT job_filing_number, building_address, latitude, longitude, job_description, status, filing_date
FROM dob_jobs
WHERE metro = 'nyc'
  AND status IN ('IN PROGRESS', 'APPROVED', 'PERMIT ISSUED')
  AND filing_date > NOW() - INTERVAL '90 days'
  AND (job_description ILIKE '%demo%' OR job_description ILIKE '%new%' OR job_description ILIKE '%foundation%');
```

**sub_category:** `active_construction`
**Category:** `noise`
**source:** `nyc_dob_filings_derived`

Same TDD shape. Commit per task.

---

### Task 14: Sex-offender restricted-table sync

**Files:** `modules/sex-offender-nys.ts` + test

**Source:** NYS DCJS Sex Offender Registry. There is no public bulk API; the workflow is:
1. Run a daily/weekly scrape against https://www.criminaljustice.ny.gov/SomsSUBDirectory/ filtered to Level 2 and 3 offenders in NYC ZIPs (10001-11697)
2. Geocode each address to lat/lng using our existing geocoder (`scripts/_geocode-helper.mjs`)
3. **Insert ONLY (level, geom, source_record_id) into `sex_offender_locations_restricted`** — never the name, photo, or address

The module writes to a **different table** than the others. Confirm the row shape excludes name/address fields entirely.

Same TDD shape — unit-test the normalization (input scraped record → restricted row) to confirm name/address are dropped. Commit per task.

---

## Phase 4 — Tier 2 Scraping Modules

Each of these is a scraper. Per the spec, no robots.txt / TOS gate; cache to DB; weekly cron only. Each module pattern:

1. Fetch source HTML/JSON
2. Parse → normalize to `ConcernInput[]`
3. `batchUpsert` into `nearby_concerns`
4. `softDeleteUnseen` to retire stale rows
5. `recordSyncRun` to `sync_log`

### Task 15: Coalition for the Homeless directory

**Files:** `modules/shelters-coalition.ts` + test
**Source:** https://www.coalitionforthehomeless.org/our-programs/our-emergency-resources/
**sub_category:** `homeless_shelter_adult`
**source:** `coalition_for_homeless`

Test normalization of one parsed record. Commit per task.

### Task 16: WIN / CAMBA / BRC directories

**Files:** `modules/shelters-win-camba-brc.ts` + test
**Sources:** WIN https://www.winnyc.org/programs, CAMBA https://camba.org/our-programs/housing/, BRC https://www.brc.org/our-programs

One module, three sub-scrapers. Each maps to `sub_category = 'homeless_shelter_adult'` but `metadata.operator` differs.

**Important:** WIN runs family shelters too. **Filter those out**: only ingest rows where `metadata.population != 'family_with_children'`. Test this filter explicitly.

Commit per task.

### Task 17: Faith-based shelter directories

**Files:** `modules/shelters-faithbased.ts` + test
**Sources:**
- Bowery Mission: https://www.bowery.org/locations
- The Father's Heart: https://thefathersheart.org/programs
- The Living Room: https://www.realhousenyc.org/our-programs

Commit per task.

### Task 18: Migrant / HERRC tracker

**Files:** `modules/migrant-herrc.ts` + test
**Sources:**
- NYC Mayor's Office press releases (search for "HERRC" or "asylum-seeker shelter")
- THE CITY's HERRC tracker (https://www.thecity.nyc/2024/01/05/asylum-seekers-shelter-map-list/ — verify current URL)
- NYC Open Data on city contracts (filter for asylum-seeker shelter contracts)

**sub_category:** `migrant_reception`
**Category:** `public_safety`
**metadata:** `{ facility_type: "HERRC" | "asylum_hotel", opened: "YYYY-MM", capacity_estimate: 850, status: "active" }`

Commit per task.

---

## Phase 5 — Sync Orchestrator + Cron

### Task 19: `sync-nearby-concerns/index.ts`

**Files:** `supabase/functions/sync-nearby-concerns/index.ts`

- [ ] **Step 1: Write the orchestrator**

```ts
// supabase/functions/sync-nearby-concerns/index.ts
import { getSupabaseAdmin } from "shared/supabase-admin.ts";
import { syncSheltersNycOpenData } from "./modules/shelters-nyc-opendata.ts";
import { syncSheltersCoalition } from "./modules/shelters-coalition.ts";
import { syncSheltersWinCambaBrc } from "./modules/shelters-win-camba-brc.ts";
import { syncSheltersFaithbased } from "./modules/shelters-faithbased.ts";
import { syncMigrantHerrc } from "./modules/migrant-herrc.ts";
import { syncMethadoneOasas } from "./modules/methadone-oasas.ts";
import { syncHalfwayHouses } from "./modules/halfway-houses.ts";
import { syncSirens } from "./modules/sirens.ts";
import { syncDsnyGarages } from "./modules/dsny-garages.ts";
import { syncEnvBrownfield } from "./modules/env-brownfield.ts";
import { syncRailHighwayPoints } from "./modules/rail-highway-points.ts";
import { syncActiveConstruction } from "./modules/active-construction.ts";
import { syncSexOffenderNys } from "./modules/sex-offender-nys.ts";

const MODULES = {
  "shelters-nyc-opendata": syncSheltersNycOpenData,
  "shelters-coalition": syncSheltersCoalition,
  "shelters-win-camba-brc": syncSheltersWinCambaBrc,
  "shelters-faithbased": syncSheltersFaithbased,
  "migrant-herrc": syncMigrantHerrc,
  "methadone-oasas": syncMethadoneOasas,
  "halfway-houses": syncHalfwayHouses,
  "sirens": syncSirens,
  "dsny-garages": syncDsnyGarages,
  "env-brownfield": syncEnvBrownfield,
  "rail-highway": syncRailHighwayPoints,
  "active-construction": syncActiveConstruction,
  "sex-offender-nys": syncSexOffenderNys,
} as const;

type ModuleName = keyof typeof MODULES;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const source = (url.searchParams.get("source") ?? "all") as ModuleName | "all";
  const supabase = getSupabaseAdmin();

  const results: Record<string, { synced: number; error?: string }> = {};
  const moduleNames: ModuleName[] = source === "all" ? Object.keys(MODULES) as ModuleName[] : [source];

  for (const name of moduleNames) {
    if (!(name in MODULES)) {
      results[name] = { synced: 0, error: "unknown module" };
      continue;
    }
    try {
      results[name] = await MODULES[name](supabase);
    } catch (e) {
      results[name] = { synced: 0, error: (e as Error).message };
    }
  }

  return new Response(JSON.stringify({ ok: true, results }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Deploy the function**

```bash
npx supabase functions deploy sync-nearby-concerns --no-verify-jwt
```

- [ ] **Step 3: Smoke test one module**

```bash
curl -X POST "$(npx supabase status --output json | jq -r '.api.url')/functions/v1/sync-nearby-concerns?source=shelters-nyc-opendata" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

Expected: JSON response with `synced` count.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/sync-nearby-concerns/index.ts
git commit -m "feat(sync): orchestrator for sync-nearby-concerns with per-module dispatch"
```

---

### Task 20: Cron schedule

**Files:** `supabase/config.toml` (or wherever crons live — check `scripts/cron-setup-*` or `supabase/cron.sql`)

- [ ] **Step 1: Look up existing cron config**

```bash
grep -rl "pg_cron\|cron.schedule" supabase/migrations/ supabase/config.toml 2>/dev/null
```

- [ ] **Step 2: Add cron entry** (likely a new SQL migration if pg_cron is the pattern)

```sql
-- supabase/migrations/20260520200000_nearby_concerns_cron.sql
SELECT cron.schedule(
  'sync-nearby-concerns-weekly',
  '0 7 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/sync-nearby-concerns?source=all',
    headers := jsonb_build_object('Authorization', 'Bearer <service-role-key-or-secret>')
  );
  $$
);
```

- [ ] **Step 3: Apply, verify, commit**

---

## Phase 6 — Calm Score Baselines

### Task 21: `scripts/compute-calm-score-baselines.mjs`

**Files:** `scripts/compute-calm-score-baselines.mjs`

- [ ] **Step 1: Write the script**

```js
// scripts/compute-calm-score-baselines.mjs
// Run: node scripts/compute-calm-score-baselines.mjs
// Reads every NYC building centroid, computes 311 noise / rats / bedbugs counts
// within 0.25 mi, stores median in calm_score_baselines.

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const METRICS = [
  {
    metric: "nyc_noise_311_90d",
    query: (lat, lng) => supabase.rpc("count_311_noise_near", { lat, lng, radius_m: 402 }),
  },
  // Add rats + bedbugs RPCs similarly. If the RPCs don't exist, create them
  // as SQL functions in a new migration first.
];

async function main() {
  const { data: buildings } = await supabase
    .from("buildings")
    .select("id, lat, lng")
    .eq("metro", "nyc")
    .not("lat", "is", null)
    .limit(100000);

  for (const metric of METRICS) {
    const counts = [];
    for (const b of buildings) {
      const { data } = await metric.query(b.lat, b.lng);
      counts.push(data ?? 0);
    }
    counts.sort((a, b) => a - b);
    const median = counts[Math.floor(counts.length / 2)];
    await supabase.from("calm_score_baselines").upsert({
      metric: metric.metric,
      median_value: median,
      computed_at: new Date().toISOString(),
    });
    console.log(`${metric.metric} → median ${median} (n=${counts.length})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: If counting RPCs don't exist, add them as a migration first**

```sql
-- supabase/migrations/20260520300000_block_level_count_rpcs.sql
CREATE OR REPLACE FUNCTION count_311_noise_near(lat double precision, lng double precision, radius_m int DEFAULT 402)
RETURNS int LANGUAGE sql STABLE AS $$
  SELECT count(*)::int FROM nyc_311
  WHERE complaint_type ILIKE '%noise%'
    AND created_date > NOW() - INTERVAL '90 days'
    AND ST_DWithin(geom::geography, ST_MakePoint(lng, lat)::geography, radius_m);
$$;

-- Similar for rats + bedbugs.
```

- [ ] **Step 3: Run the script**

```bash
node scripts/compute-calm-score-baselines.mjs
```

Expected: prints median for each metric and writes to `calm_score_baselines`.

- [ ] **Step 4: Commit**

```bash
git add scripts/compute-calm-score-baselines.mjs supabase/migrations/20260520300000_block_level_count_rpcs.sql
git commit -m "feat(scoring): compute calm-score baselines + count RPCs"
```

---

## Phase 7 — Query + Helper Layer

### Task 22: `src/lib/neighborhood-risks/types.ts`

**Files:** `src/lib/neighborhood-risks/types.ts`

- [ ] **Step 1: Define shared types**

```ts
// src/lib/neighborhood-risks/types.ts
export type ConcernCategory = "public_safety" | "noise" | "environmental" | "block_level";

export type ConcernSubCategory =
  | "homeless_shelter_adult"
  | "youth_shelter"
  | "supportive_housing"
  | "migrant_reception"
  | "methadone_clinic"
  | "halfway_house"
  | "sirens"
  | "active_construction"
  | "elevated_rail"
  | "highway"
  | "dsny_garage"
  | "brownfield"
  | "industrial_zone"
  // Block-level (live from existing tables):
  | "rat_failures"
  | "noise_311"
  | "bedbug_history"
  // Special-case:
  | "sex_offender";

export interface ConcernRow {
  id: number;
  category: ConcernCategory;
  sub_category: ConcernSubCategory;
  name: string;
  address: string | null;
  source: string;
  source_url: string | null;
  distance_mi: number;
}

export interface ConcernSubCategoryGroup {
  sub_category: ConcernSubCategory;
  category: ConcernCategory;
  total_count: number;
  items: ConcernRow[];
}

export interface NeighborhoodRisksResult {
  building: { id: string; name: string; address: string; borough: string; neighborhood: string; lat: number; lng: number; slug: string };
  groups: ConcernSubCategoryGroup[];
  sex_offender_count: number;
  block_level: {
    rat_failures: number;
    noise_311: number;
    noise_311_on_block: number;
    bedbug_history: number;
  };
  calm_score: number;
  calm_score_breakdown: Array<{ reason: string; penalty: number }>;
  total_concerns: number;
  within_block_count: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/neighborhood-risks/types.ts
git commit -m "feat(types): neighborhood-risks shared types"
```

---

### Task 23: `src/lib/neighborhood-risks/distance.ts` + tests

**Files:** `src/lib/neighborhood-risks/distance.ts`, `tests/lib/neighborhood-risks-distance.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/lib/neighborhood-risks-distance.test.ts
import { describe, expect, it } from "vitest";
import { formatDistance, walkMinutes, isOnBlock } from "@/lib/neighborhood-risks/distance";

describe("formatDistance", () => {
  it("formats < 0.1 mi as 'on block'", () => {
    expect(formatDistance(0.05)).toBe("on block");
  });
  it("formats with 2 decimals", () => {
    expect(formatDistance(0.31)).toBe("0.31 mi");
  });
});

describe("walkMinutes", () => {
  it("uses 3 mph (~20 min/mi)", () => {
    expect(walkMinutes(0.5)).toBe(10);
    expect(walkMinutes(0.05)).toBe(1);
  });
});

describe("isOnBlock", () => {
  it("returns true under 0.1 mi", () => {
    expect(isOnBlock(0.09)).toBe(true);
    expect(isOnBlock(0.11)).toBe(false);
  });
});
```

- [ ] **Step 2: Run, fail, then implement**

```ts
// src/lib/neighborhood-risks/distance.ts
export function formatDistance(mi: number): string {
  if (mi < 0.1) return "on block";
  return `${mi.toFixed(2)} mi`;
}

export function walkMinutes(mi: number): number {
  // 3 mph = 20 min/mi; round to nearest minute, min 1
  return Math.max(1, Math.round(mi * 20));
}

export function isOnBlock(mi: number): boolean {
  return mi < 0.1;
}

export function distanceLabel(mi: number): string {
  if (isOnBlock(mi)) return "on block";
  return `${formatDistance(mi)} · ${walkMinutes(mi)} min walk`;
}
```

- [ ] **Step 3: Run, pass, commit**

```bash
npx vitest run tests/lib/neighborhood-risks-distance.test.ts
git add src/lib/neighborhood-risks/distance.ts tests/lib/neighborhood-risks-distance.test.ts
git commit -m "feat(neighborhood-risks): distance + walk-time helpers"
```

---

### Task 24: `colors.ts`

**Files:** `src/lib/neighborhood-risks/colors.ts`

- [ ] **Step 1: Write**

```ts
// src/lib/neighborhood-risks/colors.ts
import type { ConcernCategory } from "./types";

export const CATEGORY_COLORS: Record<Exclude<ConcernCategory, "block_level"> | "block_level", { hex: string; bg: string; border: string; label: string }> = {
  public_safety: { hex: "#DC2626", bg: "#FEF2F2", border: "#FECACA", label: "Public-safety facilities" },
  noise:         { hex: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A", label: "24/7 noise sources" },
  environmental: { hex: "#10B981", bg: "#F0FDF4", border: "#BBF7D0", label: "Environmental / air quality" },
  block_level:   { hex: "#8B5CF6", bg: "#FAF5FF", border: "#DDD6FE", label: "Block-level reputation" },
} as const;

export const CATEGORY_ORDER: Array<keyof typeof CATEGORY_COLORS> = [
  "public_safety", "noise", "environmental", "block_level",
];
```

- [ ] **Step 2: Commit**

---

### Task 25: `icons.tsx`

**Files:** `src/lib/neighborhood-risks/icons.tsx`

Maps each `ConcernSubCategory` to a `lucide-react` icon component.

- [ ] **Step 1: Write**

```tsx
// src/lib/neighborhood-risks/icons.tsx
import { Home, Pill, ShieldAlert, Building2, Siren, HardHat, Train, Factory, Trash2, Rat, Megaphone, Bug, Users, Heart, Construction } from "lucide-react";
import type { ConcernSubCategory } from "./types";
import type { ComponentType } from "react";

const ICON_MAP: Record<ConcernSubCategory, ComponentType<{ className?: string }>> = {
  homeless_shelter_adult: Home,
  youth_shelter: Users,
  supportive_housing: Heart,
  migrant_reception: Users,
  methadone_clinic: Pill,
  halfway_house: Building2,
  sirens: Siren,
  active_construction: Construction,
  elevated_rail: Train,
  highway: HardHat, // placeholder — pick a better one
  dsny_garage: Trash2,
  brownfield: Factory,
  industrial_zone: Factory,
  rat_failures: Rat,
  noise_311: Megaphone,
  bedbug_history: Bug,
  sex_offender: ShieldAlert,
};

export function iconForSubCategory(sub: ConcernSubCategory) {
  return ICON_MAP[sub];
}
```

- [ ] **Step 2: Commit**

---

### Task 26: `calm-score.ts` + tests

**Files:** `src/lib/neighborhood-risks/calm-score.ts`, `tests/lib/neighborhood-risks-calm-score.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/lib/neighborhood-risks-calm-score.test.ts
import { describe, expect, it } from "vitest";
import { computeCalmScore } from "@/lib/neighborhood-risks/calm-score";

describe("computeCalmScore", () => {
  it("returns 10.0 for a building with zero concerns", () => {
    const r = computeCalmScore({
      poiPenalties: { public_safety: { close: 0, far: 0 }, noise: { close: 0, far: 0 }, environmental: { close: 0, far: 0 } },
      blockLevel: { noise_311: 0, rats: 0, bedbugs: 0 },
      baselines: { noise_311: 30, rats: 5, bedbugs: 2 },
    });
    expect(r.score).toBe(10.0);
    expect(r.breakdown).toEqual([]);
  });

  it("applies public-safety close penalty", () => {
    const r = computeCalmScore({
      poiPenalties: { public_safety: { close: 2, far: 0 }, noise: { close: 0, far: 0 }, environmental: { close: 0, far: 0 } },
      blockLevel: { noise_311: 0, rats: 0, bedbugs: 0 },
      baselines: { noise_311: 30, rats: 5, bedbugs: 2 },
    });
    expect(r.score).toBe(9.0); // 10 - (2 * 0.5)
    expect(r.breakdown).toContainEqual({ reason: "2 public-safety POIs within 0.25 mi", penalty: -1.0 });
  });

  it("clamps to 0", () => {
    const r = computeCalmScore({
      poiPenalties: { public_safety: { close: 100, far: 0 }, noise: { close: 0, far: 0 }, environmental: { close: 0, far: 0 } },
      blockLevel: { noise_311: 999, rats: 999, bedbugs: 999 },
      baselines: { noise_311: 30, rats: 5, bedbugs: 2 },
    });
    expect(r.score).toBe(0.0);
  });
});
```

- [ ] **Step 2: Implement**

```ts
// src/lib/neighborhood-risks/calm-score.ts
export interface CalmScoreInput {
  poiPenalties: Record<"public_safety" | "noise" | "environmental", { close: number; far: number }>;
  blockLevel: { noise_311: number; rats: number; bedbugs: number };
  baselines: { noise_311: number; rats: number; bedbugs: number };
}

const W = {
  public_safety: { close: -0.5, far: -0.2 },
  noise:         { close: -0.4, far: -0.15 },
  environmental: { close: -0.6, far: -0.2 },
} as const;

export function computeCalmScore(input: CalmScoreInput): { score: number; breakdown: Array<{ reason: string; penalty: number }> } {
  let score = 10.0;
  const breakdown: Array<{ reason: string; penalty: number }> = [];

  for (const cat of ["public_safety", "noise", "environmental"] as const) {
    const { close, far } = input.poiPenalties[cat];
    if (close > 0) {
      const p = close * W[cat].close;
      score += p;
      breakdown.push({ reason: `${close} ${labelFor(cat)} POIs within 0.25 mi`, penalty: p });
    }
    if (far > 0) {
      const p = far * W[cat].far;
      score += p;
      breakdown.push({ reason: `${far} ${labelFor(cat)} POIs within 0.75 mi`, penalty: p });
    }
  }

  const blockPenalties: Array<[keyof typeof input.blockLevel, string]> = [
    ["noise_311", "311 noise complaints"],
    ["rats", "rat failures"],
    ["bedbugs", "bedbug filings"],
  ];
  for (const [key, label] of blockPenalties) {
    const ratio = input.blockLevel[key] / Math.max(1, input.baselines[key]);
    if (ratio >= 3.0) {
      score -= 1.0;
      breakdown.push({ reason: `${label} ≥ 3× NYC median`, penalty: -1.0 });
    } else if (ratio >= 1.5) {
      score -= 0.5;
      breakdown.push({ reason: `${label} ≥ 1.5× NYC median`, penalty: -0.5 });
    }
  }

  return { score: Math.round(Math.max(0, Math.min(10, score)) * 10) / 10, breakdown };
}

function labelFor(cat: string): string {
  return { public_safety: "public-safety", noise: "noise", environmental: "environmental" }[cat] ?? cat;
}
```

- [ ] **Step 3: Run, pass, commit**

---

### Task 27: `queries.ts` + tests

**Files:** `src/lib/neighborhood-risks/queries.ts`, `tests/lib/neighborhood-risks-queries.test.ts`

- [ ] **Step 1: Write failing test (mock supabase)**

Test `groupBySubCategory(rows)` and `fetchAllForBuilding(supabase, lat, lng)`. Mock the supabase client.

- [ ] **Step 2: Implement**

```ts
// src/lib/neighborhood-risks/queries.ts
import { createClient } from "@supabase/supabase-js";
import type { ConcernRow, NeighborhoodRisksResult, ConcernSubCategoryGroup } from "./types";
import { computeCalmScore } from "./calm-score";

const RADIUS_M = 1207; // 0.75 mi

export async function fetchNeighborhoodRisks(
  building: { id: string; name: string; address: string; borough: string; neighborhood: string; lat: number; lng: number; slug: string }
): Promise<NeighborhoodRisksResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { lat, lng } = building;

  // 1. nearby_concerns within 0.75 mi
  const { data: concernRows } = await supabase.rpc("nearby_concerns_within_radius", {
    p_lat: lat, p_lng: lng, p_radius_m: RADIUS_M,
  });

  // 2. sex offender count (RPC)
  const { data: offenderCount } = await supabase.rpc("count_sex_offenders_near", {
    lat, lng, radius_meters: RADIUS_M,
  });

  // 3. block-level live queries
  const [noise311, noise311Block, rats, bedbugs] = await Promise.all([
    supabase.rpc("count_311_noise_near", { lat, lng, radius_m: RADIUS_M }).then((r) => r.data ?? 0),
    supabase.rpc("count_311_noise_near", { lat, lng, radius_m: 121 }).then((r) => r.data ?? 0), // ~ on block
    supabase.rpc("count_rat_failures_near", { lat, lng, radius_m: RADIUS_M }).then((r) => r.data ?? 0),
    supabase.rpc("count_bedbugs_near", { lat, lng, radius_m: RADIUS_M }).then((r) => r.data ?? 0),
  ]);

  // 4. baselines
  const { data: baselines } = await supabase.from("calm_score_baselines").select("metric, median_value");
  const baselineMap = Object.fromEntries((baselines ?? []).map((b) => [b.metric, Number(b.median_value)]));

  // 5. compute calm score
  const poiPenalties = aggregatePenalties(concernRows ?? []);
  const { score, breakdown } = computeCalmScore({
    poiPenalties,
    blockLevel: { noise_311: noise311, rats, bedbugs },
    baselines: {
      noise_311: baselineMap["nyc_noise_311_90d"] ?? 30,
      rats: baselineMap["nyc_rats_12mo"] ?? 5,
      bedbugs: baselineMap["nyc_bedbugs_3y"] ?? 2,
    },
  });

  return {
    building,
    groups: groupBySubCategory(concernRows ?? []),
    sex_offender_count: offenderCount ?? 0,
    block_level: {
      rat_failures: rats,
      noise_311: noise311,
      noise_311_on_block: noise311Block,
      bedbug_history: bedbugs,
    },
    calm_score: score,
    calm_score_breakdown: breakdown,
    total_concerns: (concernRows ?? []).length + (offenderCount ?? 0),
    within_block_count: (concernRows ?? []).filter((r: ConcernRow) => r.distance_mi < 0.1).length,
  };
}

export function groupBySubCategory(rows: ConcernRow[]): ConcernSubCategoryGroup[] {
  const groups = new Map<string, ConcernSubCategoryGroup>();
  for (const r of rows) {
    if (!groups.has(r.sub_category)) {
      groups.set(r.sub_category, { sub_category: r.sub_category, category: r.category, total_count: 0, items: [] });
    }
    const g = groups.get(r.sub_category)!;
    g.total_count += 1;
    g.items.push(r);
  }
  return Array.from(groups.values());
}

function aggregatePenalties(rows: ConcernRow[]) {
  const init = { close: 0, far: 0 };
  const acc = { public_safety: { ...init }, noise: { ...init }, environmental: { ...init } } as const;
  for (const r of rows) {
    if (r.category === "block_level") continue;
    const bucket = r.distance_mi < 0.25 ? "close" : "far";
    (acc as any)[r.category][bucket]++;
  }
  return acc;
}
```

- [ ] **Step 3: Add the missing RPC `nearby_concerns_within_radius` migration**

```sql
-- supabase/migrations/20260520400000_nearby_concerns_within_radius_rpc.sql
CREATE OR REPLACE FUNCTION nearby_concerns_within_radius(
  p_lat double precision,
  p_lng double precision,
  p_radius_m int DEFAULT 1207
) RETURNS TABLE (
  id BIGINT,
  category TEXT,
  sub_category TEXT,
  name TEXT,
  address TEXT,
  source TEXT,
  source_url TEXT,
  distance_mi DOUBLE PRECISION
) LANGUAGE sql STABLE AS $$
  SELECT
    nc.id,
    nc.category,
    nc.sub_category,
    COALESCE(ov.new_name, nc.name) AS name,
    nc.address,
    nc.source,
    nc.source_url,
    ST_Distance(nc.geom::geography, ST_MakePoint(p_lng, p_lat)::geography) / 1609.344 AS distance_mi
  FROM nearby_concerns nc
  LEFT JOIN nearby_concerns_overrides ov
    ON ov.source = nc.source AND ov.source_record_id = nc.source_record_id
  WHERE nc.active = TRUE
    AND nc.metro = 'nyc'
    AND (ov.action IS NULL OR ov.action != 'hide')
    AND ST_DWithin(nc.geom::geography, ST_MakePoint(p_lng, p_lat)::geography, p_radius_m)
  ORDER BY distance_mi ASC;
$$;
```

- [ ] **Step 4: Run tests, commit**

---

## Phase 8 — UI Components

For each component below: write a test that renders it with sample props and asserts visible content; implement; run; commit.

### Task 28: `NeighborhoodRisksBlock.tsx` + test

**Files:** `src/components/neighborhood-risks/NeighborhoodRisksBlock.tsx`, `tests/components/neighborhood-risks-block.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// tests/components/neighborhood-risks-block.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NeighborhoodRisksBlock } from "@/components/neighborhood-risks/NeighborhoodRisksBlock";

describe("NeighborhoodRisksBlock", () => {
  it("renders title, count, and items", () => {
    render(
      <NeighborhoodRisksBlock
        sub_category="homeless_shelter_adult"
        category="public_safety"
        title="Homeless shelters"
        source="NYC DHS"
        count={2}
        unit="sites"
        items={[
          { name: "Catherine St Family", distance_mi: 0.31 },
          { name: "W 58th Adult", distance_mi: 0.62 },
        ]}
      />
    );
    expect(screen.getByText("Homeless shelters")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("sites")).toBeDefined();
    expect(screen.getByText("Catherine St Family")).toBeDefined();
    expect(screen.getByText(/0\.31 mi/)).toBeDefined();
  });

  it("renders 'All clear' state when count is 0", () => {
    render(
      <NeighborhoodRisksBlock
        sub_category="halfway_house"
        category="public_safety"
        title="Halfway houses"
        source="Federal BOP"
        count={0}
        items={[]}
      />
    );
    expect(screen.getByText(/all clear/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Implement** (matching the v7 mockup at `.superpowers/brainstorm/34445-1779279812/results-v7.html`)

Full code: see mockup. Render: stripe + navy icon + title + pill + source + big count + items list (with `distanceLabel`).

- [ ] **Step 3: Run, pass, commit**

---

### Tasks 29–34: remaining components

Each follows the same TDD shape. One commit per component.

| Task | Component | Key responsibility |
|---|---|---|
| 29 | `NeighborhoodRisksEmptyBlock.tsx` | Muted "All clear" state — usually inlined into Block but separated for clarity |
| 30 | `NeighborhoodRisksSensitiveBlock.tsx` | Sex offender variant — gradient stripe, privacy note, registry link, no item list |
| 31 | `NeighborhoodRisksSection.tsx` | Section header (bar + title + meta) + grid wrapper |
| 32 | `NeighborhoodRisksJumpNav.tsx` | Sticky nav with 4 category pills + smooth scroll |
| 33 | `NeighborhoodRisksHero.tsx` | New layered hero: gradient + dot grid + concentric pulse SVG + breadcrumb + chips + stat tiles |
| 34 | `NeighborhoodRisksSearch.tsx` | Address autocomplete (mirror `SearchBar.tsx` but scoped to buildings only) |

Reference the v7 mockup for exact styling. Use Tailwind classes that match: `bg-[#0F1D2E]`, `text-white`, `rounded-xl`, `border-[#e2e8f0]` etc.

---

## Phase 9 — Pages

### Task 35: Landing page

**Files:** `src/app/[city]/tenant-tools/neighborhood-risks/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/app/[city]/tenant-tools/neighborhood-risks/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidCity, CITY_META } from "@/lib/cities";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { NeighborhoodRisksSearch } from "@/components/neighborhood-risks/NeighborhoodRisksSearch";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city) || city !== "nyc") return {};
  const meta = CITY_META.nyc;
  return {
    title: `${meta.fullName} Neighborhood Risks — What's Near Your Apartment?`,
    description: `Free NYC tool. Search any building address to see homeless shelters, methadone clinics, sirens, brownfields, and other nearby concerns within 0.75 mi.`,
    alternates: { canonical: canonicalUrl(cityPath("/tenant-tools/neighborhood-risks", "nyc")) },
  };
}

export default async function NeighborhoodRisksLandingPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  if (city !== "nyc") notFound();

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: "NYC", href: cityPath("", "nyc") },
    { label: "Tenant Tools", href: cityPath("/tenant-tools", "nyc") },
    { label: "Neighborhood Risks", href: cityPath("/tenant-tools/neighborhood-risks", "nyc") },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#0F1D2E] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
          <Breadcrumbs items={breadcrumbs} />
          <h1 className="text-3xl sm:text-5xl font-bold mt-6 mb-4">Neighborhood Risks</h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-8">
            Search any NYC building and see what's nearby that listings won't tell you — shelters, methadone clinics, sirens, brownfields, rat hotspots — within 0.75 mi.
          </p>
          <NeighborhoodRisksSearch />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-bold mb-6">What we check</h2>
        {/* 3-column explainer grid: Public-safety / 24/7 noise / Environmental + block-level */}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

---

### Task 36: Results page

**Files:** `src/app/[city]/tenant-tools/neighborhood-risks/[buildingSlug]/page.tsx`

- [ ] **Step 1: Implement** (server component using `fetchNeighborhoodRisks`)

```tsx
// src/app/[city]/tenant-tools/neighborhood-risks/[buildingSlug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidCity, CITY_META } from "@/lib/cities";
import { canonicalUrl, cityPath, buildingUrl } from "@/lib/seo";
import { fetchNeighborhoodRisks } from "@/lib/neighborhood-risks/queries";
import { NeighborhoodRisksHero } from "@/components/neighborhood-risks/NeighborhoodRisksHero";
import { NeighborhoodRisksJumpNav } from "@/components/neighborhood-risks/NeighborhoodRisksJumpNav";
import { NeighborhoodRisksSection } from "@/components/neighborhood-risks/NeighborhoodRisksSection";
import { createClient } from "@supabase/supabase-js";
import { CATEGORY_ORDER } from "@/lib/neighborhood-risks/colors";

export const revalidate = 21600; // 6 hours

async function getBuilding(slug: string) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data } = await supabase
    .from("buildings")
    .select("id, name, full_address, borough, neighborhood, lat, lng, slug")
    .eq("metro", "nyc")
    .eq("slug", slug)
    .single();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ city: string; buildingSlug: string }> }): Promise<Metadata> {
  const { city, buildingSlug } = await params;
  if (city !== "nyc") return {};
  const b = await getBuilding(buildingSlug);
  if (!b) return {};
  return {
    title: `Neighborhood Risks for ${b.name ?? b.full_address} | NYC`,
    description: `What's nearby at ${b.full_address} — shelters, sirens, brownfields, rats, and more within 0.75 mi.`,
    alternates: { canonical: canonicalUrl(cityPath(`/tenant-tools/neighborhood-risks/${buildingSlug}`, "nyc")) },
  };
}

export default async function NeighborhoodRisksResultsPage({ params }: { params: Promise<{ city: string; buildingSlug: string }> }) {
  const { city, buildingSlug } = await params;
  if (city !== "nyc") notFound();
  const b = await getBuilding(buildingSlug);
  if (!b) notFound();

  const result = await fetchNeighborhoodRisks({
    id: b.id, name: b.name ?? b.full_address, address: b.full_address,
    borough: b.borough, neighborhood: b.neighborhood,
    lat: b.lat, lng: b.lng, slug: b.slug,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <NeighborhoodRisksHero result={result} />
      <NeighborhoodRisksJumpNav result={result} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {CATEGORY_ORDER.map((cat) => (
          <NeighborhoodRisksSection key={cat} category={cat} result={result} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

---

## Phase 10 — Nav + Hub Integration

### Task 37: Add to `NavDropdown.tsx`

**Files:** `src/components/layout/NavDropdown.tsx` (modify)

- [ ] **Step 1: Locate the tools array and add entry near other tenant-tools entries**

Add the import for `ShieldAlert` if not present, then add:

```ts
{
  path: "/tenant-tools/neighborhood-risks",
  icon: ShieldAlert,
  label: "Neighborhood Risks",
  description: "What's nearby that listings won't tell you",
  cities: ["nyc"],
},
```

- [ ] **Step 2: Commit**

---

### Task 38: Add card to tenant-tools hub

**Files:** `src/app/[city]/tenant-tools/page.tsx` (modify)

- [ ] **Step 1: Add to TOOL_CARDS array, nycOnly flag**

```ts
{
  href: "/tenant-tools/neighborhood-risks",
  icon: ShieldAlert,
  label: "Neighborhood Risks",
  description: "Search any NYC building to see shelters, sirens, brownfields, and more within 0.75 mi.",
  badge: "NYC Only",
  badgeColor: "bg-red-50 text-red-700 border-red-200",
  cta: "Check an Address",
  nycOnly: true,
},
```

The existing `.filter((tool) => !("nycOnly" in tool && tool.nycOnly) || city === "nyc")` line on the grid will gate it correctly.

- [ ] **Step 2: Commit**

---

## Phase 11 — End-to-end Verification

### Task 39: Run all syncs at least once + smoke-test the page

- [ ] **Step 1: Trigger each module manually**

```bash
for module in shelters-nyc-opendata methadone-oasas halfway-houses sirens dsny-garages env-brownfield rail-highway active-construction shelters-coalition shelters-win-camba-brc shelters-faithbased migrant-herrc sex-offender-nys; do
  echo "=== $module ==="
  curl -s -X POST "https://<project-ref>.supabase.co/functions/v1/sync-nearby-concerns?source=$module" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
done
```

Expected: each returns `{"ok":true,"results":{...}}` with non-zero `synced` (except possibly halfway houses which may be 0 in Manhattan).

- [ ] **Step 2: Verify row counts**

```sql
SELECT source, count(*) FROM nearby_concerns WHERE active = TRUE GROUP BY source ORDER BY 2 DESC;
```

Expected: > 500 rows across all sources.

- [ ] **Step 3: Run baseline computation**

```bash
node scripts/compute-calm-score-baselines.mjs
```

- [ ] **Step 4: `npm run dev` and visit a known NYC building**

```
http://localhost:3000/nyc/tenant-tools/neighborhood-risks
```

Search for "220 Central Park South" (or any NYC building). Click → results page loads with hero, jump nav, 4 category sections, sex-offender count, and a non-zero calm score.

- [ ] **Step 5: Verify sex-offender data not leaked**

```bash
# Should fail with permission denied or return 0 rows
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/sex_offender_locations_restricted?select=*" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

Expected: `{"code":"42501","message":"permission denied for table sex_offender_locations_restricted"}` or empty array.

- [ ] **Step 6: Run full test suite**

```bash
npm test
npm run typecheck
npm run lint
```

Expected: all green.

- [ ] **Step 7: Commit any final fixes**

```bash
git add .
git commit -m "feat(neighborhood-risks): final integration tweaks after smoke test"
```

---

### Task 40: Open PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin claude/mystifying-shaw-342d4e
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat: Neighborhood Risks NYC tenant tool" --body "$(cat <<'EOF'
## Summary
- New tenant tool at `/nyc/tenant-tools/neighborhood-risks` that surfaces homeless/migrant shelters, methadone clinics, sirens, brownfields, construction, sex-offender counts, rats/bedbugs/311-noise within 0.75 mi of any NYC building
- Single PostGIS table `nearby_concerns` + weekly edge function `sync-nearby-concerns` with 13 source-specific modules (Tier 1 city/state data + Tier 2 advocacy scrapers)
- Sex-offender data is RLS-gated, count-only via `count_sex_offenders_near` RPC — names/addresses never leave the database
- Family shelters intentionally excluded; migrant reception centers as distinct sub-category

## Test plan
- [ ] All sync modules return non-zero counts when triggered manually
- [ ] `npm test` green
- [ ] `npm run typecheck` green
- [ ] Manually visit results page for 5 NYC addresses across boroughs
- [ ] Confirm sex-offender table is unreadable via anon key
- [ ] Confirm `npm run lint` green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Verify CI green, request review**

---

## Done

When all tasks are checked, the feature is shipped behind the NYC gate.

**Post-launch follow-ups (not in this plan):**
- Tune calm-score weights based on real-user feedback
- Add v1.1 free-text address geocode fallback
- Extend to LA/Chicago/Miami by adding their respective sync modules
- Build admin UI for `nearby_concerns_overrides`
- Pop a one-time "informational, not legal advice" modal on first visit (spec §11 open question)
