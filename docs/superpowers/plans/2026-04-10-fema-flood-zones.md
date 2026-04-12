# FEMA Flood Zones (Miami + Houston) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add FEMA National Flood Hazard Layer (NFHL) overlays and per-building flood-zone classification to Miami and Houston, the two cities where flood risk is the dominant safety concern renters care about. Reuse the existing `HazardMap` (Leaflet) infrastructure already in place for LA seismic hazards.

**Why these two cities first:** Miami (sea-level rise, hurricane surge) and Houston (post-Harvey floodplain anxiety) are the two cities where every renter checks flood risk before signing. Adding this layer creates a *unique* differentiator vs StreetEasy/Zillow, which don't show flood data inline.

**Architecture:** Three pieces — (1) ingest FEMA NFHL polygons into Supabase, (2) compute each Miami/Houston building's flood zone via point-in-polygon at ingest time and store the result on `buildings`, (3) extend `HazardMap` with a `floodZone` layer + add a `FloodRiskCard` to building pages.

**Tech Stack:** Node.js (mjs scripts), TypeScript (Next.js), Supabase JS client, PostgreSQL (with PostGIS — must be enabled), Leaflet/react-leaflet, FEMA NFHL REST API.

---

## File Structure

### Database (new)
- `supabase/migrations/20260410300000_enable_postgis.sql` — Enable PostGIS extension (PostGIS is **not** currently enabled per Mission Control audit).
- `supabase/migrations/20260410300100_flood_zones.sql` — `flood_zones` table with `geom geometry(MultiPolygon, 4326)`, `zone_code text`, `zone_subtype text`, `metro text`, `effective_date date`, GIST index on `geom`.
- `supabase/migrations/20260410300200_buildings_flood_zone.sql` — Add `flood_zone text`, `flood_zone_subtype text`, `flood_zone_assessed_at timestamptz` columns on `buildings`.
- `supabase/migrations/20260410300300_flood_zone_rpcs.sql` — `flood_zone_for_point(lat numeric, lng numeric)` and `flood_zone_geojson_for_bbox(...)` RPCs.

### Scripts (new)
- `scripts/ingest-fema-nfhl.mjs` — Downloads NFHL data for Miami-Dade + Harris County FIPS codes from the FEMA Map Service Center, simplifies polygons to ~10m tolerance, inserts into `flood_zones`. Idempotent — keyed on `(metro, zone_id, effective_date)`.
- `scripts/backfill-building-flood-zones.mjs` — Pages buildings in Miami/Houston, calls `flood_zone_for_point()` for each, writes back. Idempotent.

### API (new)
- `src/app/api/hazards/flood-zones/route.ts` — GeoJSON endpoint matching the existing `/api/hazards/zones` pattern. Accepts `bbox` query param to keep payloads small.

### Components (new)
- `src/components/building/FloodRiskCard.tsx` — Displays flood zone label, plain-language risk, FEMA insurance implication, and a small map thumbnail.

### Components (modify)
- `src/components/hazards/HazardMap.tsx` — Add `floodZone` to the layer set; render with FEMA's standard color ramp (AE = light blue, VE = dark blue, X = none, etc.).
- `src/app/[city]/building/[borough]/[slug]/page.tsx` — Render `<FloodRiskCard>` on Miami/Houston building pages only.
- `src/lib/cities.ts` — Add `flood: true` flag to Miami + Houston city configs.

---

## Task 1: Enable PostGIS

**Files:**
- New: `supabase/migrations/20260410300000_enable_postgis.sql`

- [ ] **Step 1: Apply the migration**

```sql
create extension if not exists postgis;
```

- [ ] **Step 2: Verify**

`select postgis_version();` from a SQL editor or via `mcp__supabase__execute_sql`.

---

## Task 2: Create Flood Zone Schema

**Files:**
- New: `supabase/migrations/20260410300100_flood_zones.sql`

- [ ] **Step 1: Define the table**

```sql
create table flood_zones (
  id bigserial primary key,
  metro text not null,
  zone_id text not null,         -- FEMA FLD_AR_ID
  zone_code text not null,       -- AE, VE, X, A, AO, AH, etc.
  zone_subtype text,             -- COASTAL, RIVERINE, etc.
  bfe numeric,                   -- base flood elevation, ft
  effective_date date,
  source_agency text default 'FEMA NFHL',
  geom geometry(MultiPolygon, 4326) not null,
  created_at timestamptz default now(),
  unique(metro, zone_id, effective_date)
);

create index flood_zones_geom_idx on flood_zones using gist (geom);
create index flood_zones_metro_idx on flood_zones (metro);
```

- [ ] **Step 2: Document zone codes in a comment block**

Add the FEMA semantic dictionary as a SQL comment so we don't have to look it up later (AE = 1% annual chance, VE = coastal high-hazard with wave action, X = minimal hazard, A = approximate 1% with no BFE, etc.).

---

## Task 3: Ingest FEMA NFHL for Miami-Dade + Harris

**Files:**
- New: `scripts/ingest-fema-nfhl.mjs`

- [ ] **Step 1: Identify the NFHL endpoint**

Use the FEMA Map Service Center REST API:
`https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query`
Layer 28 is the FLD_HAZ_AR (Flood Hazard Areas) feature class.

Query params:
```
where=DFIRM_ID like '12086C%'   -- Miami-Dade
where=DFIRM_ID like '48201C%'   -- Harris
outFields=FLD_AR_ID,FLD_ZONE,ZONE_SUBTY,STATIC_BFE,DFIRM_ID
returnGeometry=true
outSR=4326
f=geojson
```

NFHL is paginated — use `resultOffset` + `resultRecordCount=1000` until `exceededTransferLimit=false`.

- [ ] **Step 2: Simplify and insert**

For each feature:
1. Use `@turf/simplify` with `tolerance=0.0001` to drop polygon resolution to ~10m (the dashboard map doesn't need sub-meter precision and the payload size matters)
2. Convert to PostGIS `MultiPolygon` via `ST_GeomFromGeoJSON()` + `ST_Multi()`
3. Insert with `on conflict (metro, zone_id, effective_date) do nothing`

- [ ] **Step 3: Run for both metros**

Expect ~5–15K polygons per county. Verify with `select metro, count(*) from flood_zones group by 1`.

---

## Task 4: Point-in-Polygon RPCs

**Files:**
- New: `supabase/migrations/20260410300300_flood_zone_rpcs.sql`

- [ ] **Step 1: Build `flood_zone_for_point`**

```sql
create or replace function flood_zone_for_point(p_lat numeric, p_lng numeric)
returns table(zone_code text, zone_subtype text, bfe numeric)
language sql stable as $$
  select zone_code, zone_subtype, bfe
  from flood_zones
  where ST_Contains(geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326))
  order by case zone_code
    when 'VE' then 1 when 'V' then 2
    when 'AE' then 3 when 'A' then 4 when 'AO' then 5 when 'AH' then 6
    else 99 end
  limit 1;
$$;
```

The `order by` ensures the most severe overlapping zone wins.

- [ ] **Step 2: Build `flood_zone_geojson_for_bbox`**

Returns simplified GeoJSON for a viewport bounding box, used by the map endpoint to avoid shipping the whole county on every render.

---

## Task 5: Backfill Building Flood Zones

**Files:**
- New: `supabase/migrations/20260410300200_buildings_flood_zone.sql`
- New: `scripts/backfill-building-flood-zones.mjs`

- [ ] **Step 1: Add the columns**

```sql
alter table buildings
  add column flood_zone text,
  add column flood_zone_subtype text,
  add column flood_zone_assessed_at timestamptz;
```

- [ ] **Step 2: Run the backfill script**

Pages all `metro IN ('miami','houston')` buildings with `latitude IS NOT NULL`, calls `flood_zone_for_point()` per row, writes results back. Reasonable batch size = 500. Log running totals.

- [ ] **Step 3: Add to ingest pipelines**

Wherever new Miami/Houston buildings are created (per the dedup plan), call `flood_zone_for_point()` at insert time so backfill is one-shot.

---

## Task 6: Map Layer

**Files:**
- New: `src/app/api/hazards/flood-zones/route.ts`
- Modify: `src/components/hazards/HazardMap.tsx`

- [ ] **Step 1: Build the API endpoint**

Mirror `/api/hazards/zones?layer=...` shape. Accepts `bbox=west,south,east,north&metro=miami` query params, calls `flood_zone_geojson_for_bbox`, returns FeatureCollection.

- [ ] **Step 2: Add `floodZone` to `HazardMap`**

Add to the layer set with FEMA's standard color ramp:
- VE / V → `#0066CC`
- AE / A / AO / AH → `#66B2FF`
- X (shaded, 0.2% chance) → `#CCE5FF`
- X (unshaded) → no fill

Add a legend item with plain-language tooltip ("AE = 1% annual flood risk, insurance required if mortgaged").

---

## Task 7: Building Page Card

**Files:**
- New: `src/components/building/FloodRiskCard.tsx`
- Modify: `src/app/[city]/building/[borough]/[slug]/page.tsx`
- Modify: `src/lib/cities.ts`

- [ ] **Step 1: Build `FloodRiskCard`**

Reads `flood_zone` from the building row. Renders:
- Big colored badge with zone code (VE / AE / X / Unmapped)
- One-sentence plain-language risk explanation
- FEMA insurance implication ("Lenders require flood insurance" / "Flood insurance optional but recommended" / "Outside the 1% annual floodplain")
- Small embedded map thumbnail centered on the building, showing the surrounding flood polygons (reuses HazardMap in compact mode)
- Link out to msc.fema.gov for the official map

- [ ] **Step 2: Conditionally render**

Only on Miami + Houston building pages. Gate via `cities.ts` flag rather than hardcoding metro strings.

---

## Done When

- `select metro, count(*) from flood_zones group by 1` returns rows for `miami` and `houston`
- `select count(*) from buildings where metro in ('miami','houston') and flood_zone is not null` covers ≥95% of buildings with coordinates
- `/miami/building/.../[slug]` and `/houston/building/.../[slug]` render the `FloodRiskCard`
- `HazardMap` shows the flood layer toggle for both cities
- Spot-check: a known Miami Beach building shows `VE`; a known Houston Heights building shows `X` or `AE` depending on FEMA's actual map
