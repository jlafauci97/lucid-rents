# Dewey + Dwellsy Dual-Dataset 5-City Expansion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 new cities (Atlanta, Denver, Charlotte, Phoenix, Seattle) by layering two Dewey Data datasets — a 12-year national rental history (185 GB, 2014–2026) as the primary data source and Dwellsy (17.8 GB, 2024–2025) as a rich metadata enrichment layer — into a unified rent intelligence platform.

**Architecture:** Two parallel ETL pipelines feed into shared DB tables. Dataset 1 provides 12 years of rent history (address, price, beds, sqft, amenity flags, company names). Dwellsy enriches the most recent 1.5 years with detailed amenity lists, listing photos, deposit amounts, unit numbers, vacancy lifecycle data, and 985+ management company names. Both datasets are matched to buildings by normalized address + ZIP. The existing `etl-dewey-data.mjs` script (1147 lines) already handles Dataset 1 for 5 cities — we extend its `METRO_DEFS` for 5 new metros and build a parallel Dwellsy-specific ETL.

**Tech Stack:** Node.js `.mjs` ETL scripts, Python `pyarrow` for parquet reading, Supabase Postgres, existing `cities.ts` config pattern.

---

## Dataset Inventory

### Dataset 1 — National Rental Listings (Primary)
- **API:** `prj_jz8ryysw__fldr_cggezfmh4zsrfevk8`
- **Size:** 185 GB, 4,181 files, 84 pages
- **Date range:** January 2014 – February 2026 (12 years continuous)
- **Est. rows:** ~250–370M
- **Schema:** 32 columns — ADDRESS, CITY, STATE, ZIP, LAT/LON, RENT_PRICE, BEDS, BATHS, SQFT, COMPANY (100% in recent files), NEIGHBORHOOD, YEAR_BUILT, DATE_POSTED, SCRAPED_TIMESTAMP, boolean amenity flags (POOL, GYM, DOORMAN, LAUNDRY, GARAGE, FURNISHED, CLUBHOUSE, GRANITE, STAINLESS), BUILDING_TYPE, UNIT_ID
- **Partitioned by:** SCRAPED_TIMESTAMP (weekly files)
- **Strengths:** 12-year time series, 100% geocoded, 100% company names in 2024+, national coverage (46 states, 1000+ cities)

### Dataset 2 — Dwellsy (Enrichment Layer)
- **API:** `prj_bnrmqv8r__fldr_i3zgo3788i84oeasj`
- **Size:** 17.8 GB, 89 files, 2 pages
- **Date range:** September 2024 – December 2025
- **Est. rows:** ~5.3M
- **Schema:** 45 columns — all of Dataset 1's fields PLUS: AMENITIES (rich semicolon-delimited lists, 96%), PHOTOS (image URLs, 98%), LISTING_DEPOSIT (48%), COMMUNITY_NAME, COMPANY_NAME (100%, 985+ unique companies vs 85 in Dataset 1), MSA_CODE/MSA_NAME (100%), PROPERTY_LISTING_STATUS (active/inactive), DEACTIVATION_TIME (93%), ADDRESS_TYPE (Apartment/House/Mobile), SS_RAW_SECONDARY_NUMBER (unit numbers, 57%), FULL_BATHS/HALF_BATHS, SmartyStreets-parsed address components
- **Strengths:** Richest metadata, photos, deposit data, vacancy lifecycle, granular company coverage, unit-level data

---

## Data Layering Strategy

```
┌─────────────────────────────────────────────────────┐
│                    BUILDING PAGE                     │
├─────────────────────────────────────────────────────┤
│  12-Year Rent Trend Chart          ← Dataset 1      │
│  Current Rent + Photos             ← Dwellsy        │
│  Amenity List (rich)               ← Dwellsy        │
│  Amenity Premium ("gym adds $150") ← Both           │
│  Landlord/Company Profile          ← Both           │
│  Deposit Benchmark                 ← Dwellsy        │
│  Days on Market / Vacancy Signal   ← Dwellsy        │
│  Price Appreciation Score          ← Dataset 1      │
├─────────────────────────────────────────────────────┤
│                 NEIGHBORHOOD PAGE                    │
├─────────────────────────────────────────────────────┤
│  Rent History (2014–2026)          ← Dataset 1      │
│  Gentrification Index              ← Dataset 1      │
│  Seasonal Rent Patterns            ← Dataset 1      │
│  Current Vacancy Rate              ← Dwellsy        │
│  Avg Deposit by ZIP                ← Dwellsy        │
│  Top Landlords                     ← Both           │
└─────────────────────────────────────────────────────┘
```

---

## DB Schema Changes

### New tables needed for Dwellsy-specific data:

```sql
-- Dwellsy enrichment: company profiles aggregated from listings
CREATE TABLE IF NOT EXISTS dwellsy_company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  metro text NOT NULL,
  total_listings integer DEFAULT 0,
  active_listings integer DEFAULT 0,
  median_rent numeric(10,2),
  avg_deposit numeric(10,2),
  avg_days_on_market numeric(8,2),
  property_types text[],         -- ['Apartment','House']
  top_amenities text[],          -- most common amenities
  last_updated timestamptz DEFAULT now(),
  UNIQUE(company_name, metro)
);

-- Dwellsy enrichment: building-level metadata not in Dataset 1
CREATE TABLE IF NOT EXISTS dwellsy_building_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  photos text[],                 -- array of image URLs
  amenities text[],              -- rich amenity list from Dwellsy
  avg_deposit numeric(10,2),
  avg_days_on_market numeric(8,2),
  active_listing_count integer DEFAULT 0,
  last_company_name text,
  last_updated timestamptz DEFAULT now(),
  UNIQUE(building_id)
);

-- Neighborhood-level deposit and vacancy stats
CREATE TABLE IF NOT EXISTS dwellsy_neighborhood_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metro text NOT NULL,
  zip text NOT NULL,
  month date NOT NULL,
  avg_deposit numeric(10,2),
  median_days_on_market numeric(8,2),
  active_listings integer DEFAULT 0,
  inactive_listings integer DEFAULT 0,
  vacancy_rate numeric(6,4),      -- active / (active + inactive)
  UNIQUE(metro, zip, month)
);
```

### Existing tables that get more data:
- `buildings` — new rows for 5 new city buildings (created by Dataset 1 ETL unmatched-address flow)
- `dewey_building_rents` — 12 years of rent data per building
- `dewey_neighborhood_rents` — 12 years of rent data per ZIP
- `dewey_amenity_premiums` — enriched with Dwellsy's detailed amenity lists
- `dewey_seasonal_index` — 12 years of data = much stronger seasonal signal

---

## Estimated DB Impact

| Source | New Rows | Estimated Size |
|--------|----------|----------------|
| Dataset 1: buildings (5 new metros) | ~100–200K | ~200–400 MB |
| Dataset 1: dewey_building_rents (12 years × 10 metros) | ~5–10M new | ~2–4 GB |
| Dataset 1: dewey_neighborhood_rents | ~500K new | ~100 MB |
| Dwellsy: dwellsy_building_meta | ~200K | ~100 MB |
| Dwellsy: dwellsy_company_profiles | ~5K | ~5 MB |
| Dwellsy: dwellsy_neighborhood_stats | ~50K | ~20 MB |
| **Total new** | | **~2.5–4.5 GB** |
| **DB total** | | **~17.5–19.5 GB** |

Supabase Pro handles this easily. Not even close to a concern.

---

## File Structure

### New files to create:
- `supabase/migrations/20260402000000_expansion_and_dwellsy.sql` — New cities unique constraint, parcel_id column, Dwellsy tables, fix trailing commas in existing Dewey migration
- `scripts/etl-dwellsy.mjs` — Dwellsy-specific ETL pipeline (photos, amenities, deposits, vacancy, company profiles)
- `public/{atlanta,denver,charlotte,phoenix,seattle}-skyline.webp` — Hero images (placeholder initially)

### Files to modify:
- `src/lib/cities.ts` — Add 5 new cities to `City` type, `VALID_CITIES`, `CITY_META`, `STATE_CITY_MAP`
- `scripts/etl-dewey-data.mjs:79-151` — Add 5 new entries to `METRO_DEFS`, add target states to Python filter
- `scripts/etl-dewey-fast.mjs:26,33-38,101` — Fix API URL (currently points to Dwellsy folder but reads Dataset 1 columns), add 5 new metros
- `scripts/generate-sitemaps.mjs:25-32,91-97` — Add new cities to inlined config, fix `metroToCity()`
- `supabase/migrations/20260401000000_dewey_rent_tables.sql:73,117` — Fix trailing commas

### Files that auto-adapt (no changes needed):
- `src/app/[city]/...` — All dynamic routes use `[city]` param
- `src/components/layout/CitySwitcher.tsx` — Iterates `VALID_CITIES`
- `src/lib/city-context.tsx` — Dynamic city resolution
- `src/middleware.ts` — Dynamic via `STATE_CITY_MAP`

---

## Task 1: Database Migration

**Files:**
- Modify: `supabase/migrations/20260401000000_dewey_rent_tables.sql:73,117`
- Create: `supabase/migrations/20260402000000_expansion_and_dwellsy.sql`

- [ ] **Step 1: Fix trailing commas in existing Dewey migration**

In `supabase/migrations/20260401000000_dewey_rent_tables.sql`, remove the trailing comma before `)` on line 73 (`dewey_amenity_premiums`) and line 117 (`dewey_seasonal_index`).

Line 73: `created_at timestamptz NOT NULL DEFAULT now(),` → `created_at timestamptz NOT NULL DEFAULT now()`
Line 117: same fix.

- [ ] **Step 2: Write the expansion migration**

Create `supabase/migrations/20260402000000_expansion_and_dwellsy.sql`:

```sql
-- ============================================================================
-- 5-City Expansion + Dwellsy Enrichment Tables
-- ============================================================================

-- 1. Generic parcel_id for cities without specific parcel systems
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS parcel_id text;
CREATE INDEX IF NOT EXISTS idx_buildings_parcel_id
  ON buildings(parcel_id) WHERE parcel_id IS NOT NULL;

-- 2. Deduplicate any existing (full_address, metro) duplicates before adding constraint
DELETE FROM buildings a
USING buildings b
WHERE a.id > b.id
  AND a.full_address = b.full_address
  AND a.metro = b.metro;

-- Unique constraint for address-based dedup across metros
CREATE UNIQUE INDEX IF NOT EXISTS idx_buildings_full_address_metro
  ON buildings(full_address, metro);

-- 3. Dwellsy building-level metadata
CREATE TABLE IF NOT EXISTS dwellsy_building_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  photos text[],
  amenities text[],
  avg_deposit numeric(10,2),
  avg_days_on_market numeric(8,2),
  active_listing_count integer DEFAULT 0,
  last_company_name text,
  last_updated timestamptz DEFAULT now(),
  UNIQUE(building_id)
);

CREATE INDEX IF NOT EXISTS idx_dwellsy_building_meta_building
  ON dwellsy_building_meta(building_id);

ALTER TABLE dwellsy_building_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read dwellsy_building_meta"
  ON dwellsy_building_meta FOR SELECT USING (true);

-- 4. Dwellsy company profiles
CREATE TABLE IF NOT EXISTS dwellsy_company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  metro text NOT NULL,
  total_listings integer DEFAULT 0,
  active_listings integer DEFAULT 0,
  median_rent numeric(10,2),
  avg_deposit numeric(10,2),
  avg_days_on_market numeric(8,2),
  property_types text[],
  top_amenities text[],
  last_updated timestamptz DEFAULT now(),
  UNIQUE(company_name, metro)
);

CREATE INDEX IF NOT EXISTS idx_dwellsy_company_profiles_metro
  ON dwellsy_company_profiles(metro);

ALTER TABLE dwellsy_company_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read dwellsy_company_profiles"
  ON dwellsy_company_profiles FOR SELECT USING (true);

-- 5. Dwellsy neighborhood-level vacancy and deposit stats
CREATE TABLE IF NOT EXISTS dwellsy_neighborhood_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metro text NOT NULL,
  zip text NOT NULL,
  month date NOT NULL,
  avg_deposit numeric(10,2),
  median_days_on_market numeric(8,2),
  active_listings integer DEFAULT 0,
  inactive_listings integer DEFAULT 0,
  vacancy_rate numeric(6,4),
  UNIQUE(metro, zip, month)
);

CREATE INDEX IF NOT EXISTS idx_dwellsy_neighborhood_stats_metro_zip
  ON dwellsy_neighborhood_stats(metro, zip);

ALTER TABLE dwellsy_neighborhood_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read dwellsy_neighborhood_stats"
  ON dwellsy_neighborhood_stats FOR SELECT USING (true);
```

- [ ] **Step 3: Apply both migrations**

```bash
supabase db push
```

Verify:
```sql
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dwellsy_building_meta');
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dwellsy_company_profiles');
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dwellsy_neighborhood_stats');
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260401000000_dewey_rent_tables.sql supabase/migrations/20260402000000_expansion_and_dwellsy.sql
git commit -m "feat: add Dwellsy enrichment tables and address uniqueness constraint for 5-city expansion"
```

---

## Task 2: Add 5 Cities to Config

**Files:**
- Modify: `src/lib/cities.ts`

- [ ] **Step 1: Extend City type union**

```typescript
export type City = "nyc" | "los-angeles" | "chicago" | "miami" | "houston" | "atlanta" | "denver" | "charlotte" | "phoenix" | "seattle";
```

- [ ] **Step 2: Update VALID_CITIES**

```typescript
export const VALID_CITIES: City[] = ["nyc", "los-angeles", "chicago", "miami", "houston", "atlanta", "denver", "charlotte", "phoenix", "seattle"];
```

- [ ] **Step 3: Add parcel_id to parcelIdField union**

```typescript
parcelIdField: "bbl" | "apn" | "pin" | "folio" | "hcad_account" | "parcel_id";
```

- [ ] **Step 4: Add all 5 CITY_META entries**

Add after the `houston` entry:

```typescript
atlanta: {
  name: "Atlanta",
  fullName: "Atlanta",
  state: "Georgia",
  stateCode: "GA",
  urlPrefix: "GA/Atlanta",
  regions: [
    "Midtown", "Buckhead", "Downtown", "Old Fourth Ward", "Virginia-Highland",
    "Inman Park", "Little Five Points", "East Atlanta", "Grant Park", "Reynoldstown",
    "Cabbagetown", "Kirkwood", "Decatur", "Druid Hills", "Morningside",
    "Ansley Park", "Brookhaven", "Sandy Springs", "Dunwoody", "Roswell",
    "Marietta", "Smyrna", "Chamblee", "Doraville", "Tucker",
    "West End", "Vine City", "Westview", "Collier Hills", "West Midtown",
  ],
  parcelIdField: "parcel_id",
  regionLabel: "Neighborhood",
  heroImage: "/atlanta-skyline.webp",
  center: { lat: 33.749, lng: -84.388 },
  zoom: 11,
  crimeSource: "APD",
  crimeAreas: [],
},
denver: {
  name: "Denver",
  fullName: "Denver",
  state: "Colorado",
  stateCode: "CO",
  urlPrefix: "CO/Denver",
  regions: [
    "LoDo", "RiNo", "Capitol Hill", "Cheesman Park", "City Park",
    "Highlands", "Sloan Lake", "Berkeley", "Uptown", "Five Points",
    "Baker", "Washington Park", "Cherry Creek", "Congress Park", "Park Hill",
    "Stapleton", "Green Valley Ranch", "Montbello", "Globeville", "Elyria-Swansea",
    "Sun Valley", "Lincoln Park", "Athmar Park", "Ruby Hill", "Harvey Park",
    "Lakewood", "Aurora", "Englewood", "Littleton", "Westminster",
  ],
  parcelIdField: "parcel_id",
  regionLabel: "Neighborhood",
  heroImage: "/denver-skyline.webp",
  center: { lat: 39.7392, lng: -104.9903 },
  zoom: 11,
  crimeSource: "DPD",
  crimeAreas: [],
},
charlotte: {
  name: "Charlotte",
  fullName: "Charlotte",
  state: "North Carolina",
  stateCode: "NC",
  urlPrefix: "NC/Charlotte",
  regions: [
    "Uptown", "South End", "NoDa", "Plaza Midwood", "Dilworth",
    "Myers Park", "Eastover", "Elizabeth", "Cherry", "Fourth Ward",
    "Third Ward", "Optimist Park", "Belmont", "Villa Heights", "Sedgefield",
    "Montford", "Wesley Heights", "Seversville", "Enderly Park", "Steele Creek",
    "Ballantyne", "University City", "Huntersville", "Matthews", "Mint Hill",
    "Pineville", "Indian Trail", "Mooresville", "Concord", "Gastonia",
  ],
  parcelIdField: "parcel_id",
  regionLabel: "Neighborhood",
  heroImage: "/charlotte-skyline.webp",
  center: { lat: 35.2271, lng: -80.8431 },
  zoom: 11,
  crimeSource: "CMPD",
  crimeAreas: [],
},
phoenix: {
  name: "Phoenix",
  fullName: "Phoenix",
  state: "Arizona",
  stateCode: "AZ",
  urlPrefix: "AZ/Phoenix",
  regions: [
    "Downtown", "Midtown", "Arcadia", "Biltmore", "Camelback East",
    "Central City", "Encanto", "Maryvale", "South Mountain", "Ahwatukee",
    "Desert Ridge", "North Gateway", "Deer Valley", "Paradise Valley",
    "Scottsdale", "Tempe", "Mesa", "Chandler", "Gilbert",
    "Glendale", "Peoria", "Surprise", "Goodyear", "Avondale",
    "Laveen", "Estrella", "North Mountain", "Alhambra", "Camelback Corridor",
  ],
  parcelIdField: "parcel_id",
  regionLabel: "Neighborhood",
  heroImage: "/phoenix-skyline.webp",
  center: { lat: 33.4484, lng: -112.074 },
  zoom: 11,
  crimeSource: "PPD",
  crimeAreas: [],
},
seattle: {
  name: "Seattle",
  fullName: "Seattle",
  state: "Washington",
  stateCode: "WA",
  urlPrefix: "WA/Seattle",
  regions: [
    "Capitol Hill", "Ballard", "Fremont", "Wallingford", "University District",
    "Green Lake", "Ravenna", "Roosevelt", "Northgate", "Lake City",
    "Columbia City", "Beacon Hill", "Georgetown", "SoDo", "Pioneer Square",
    "International District", "First Hill", "Central District", "Madison Park", "Madrona",
    "Queen Anne", "Magnolia", "Interbay", "West Seattle", "White Center",
    "Bellevue", "Kirkland", "Redmond", "Renton", "Burien",
  ],
  parcelIdField: "parcel_id",
  regionLabel: "Neighborhood",
  heroImage: "/seattle-skyline.webp",
  center: { lat: 47.6062, lng: -122.3321 },
  zoom: 11,
  crimeSource: "SPD",
  crimeAreas: [],
},
```

- [ ] **Step 5: Add STATE_CITY_MAP entries**

```typescript
export const STATE_CITY_MAP: Record<string, Record<string, City>> = {
  CA: { "Los-Angeles": "los-angeles" },
  IL: { Chicago: "chicago" },
  FL: { Miami: "miami" },
  TX: { Houston: "houston" },
  GA: { Atlanta: "atlanta" },
  CO: { Denver: "denver" },
  NC: { Charlotte: "charlotte" },
  AZ: { Phoenix: "phoenix" },
  WA: { Seattle: "seattle" },
};
```

- [ ] **Step 6: Verify the app compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 7: Commit**

```bash
git add src/lib/cities.ts
git commit -m "feat: add Atlanta, Denver, Charlotte, Phoenix, Seattle to city config"
```

---

## Task 3: Extend Dataset 1 ETL for 10 Metros

**Files:**
- Modify: `scripts/etl-dewey-data.mjs:79-151,318-326`
- Modify: `scripts/etl-dewey-fast.mjs:26,33-38,101-102`

- [ ] **Step 1: Add 5 new metros to `METRO_DEFS` in `etl-dewey-data.mjs`**

Add after the `houston` entry (~line 150):

```javascript
atlanta: {
  state: "GA",
  cities: new Set([
    "ATLANTA", "DECATUR", "SANDY SPRINGS", "BROOKHAVEN", "DUNWOODY",
    "ROSWELL", "MARIETTA", "SMYRNA", "CHAMBLEE", "DORAVILLE",
    "TUCKER", "DULUTH", "LAWRENCEVILLE", "NORCROSS", "KENNESAW",
    "ALPHARETTA", "JOHNS CREEK", "PEACHTREE CITY", "EAST POINT",
    "COLLEGE PARK", "HAPEVILLE", "AVONDALE ESTATES", "CLARKSTON",
    "STONE MOUNTAIN", "LITHONIA", "SNELLVILLE", "LILBURN",
  ]),
  metro: "atlanta",
},
denver: {
  state: "CO",
  cities: new Set([
    "DENVER", "AURORA", "LAKEWOOD", "ENGLEWOOD", "LITTLETON",
    "WESTMINSTER", "THORNTON", "ARVADA", "BROOMFIELD", "WHEAT RIDGE",
    "GOLDEN", "CENTENNIAL", "HIGHLANDS RANCH", "PARKER", "CASTLE ROCK",
    "LONE TREE", "GREENWOOD VILLAGE", "CHERRY HILLS VILLAGE",
    "COMMERCE CITY", "NORTHGLENN", "FEDERAL HEIGHTS", "SHERIDAN",
  ]),
  metro: "denver",
},
charlotte: {
  state: "NC",
  cities: new Set([
    "CHARLOTTE", "HUNTERSVILLE", "MATTHEWS", "MINT HILL", "PINEVILLE",
    "INDIAN TRAIL", "MOORESVILLE", "CONCORD", "GASTONIA", "CORNELIUS",
    "DAVIDSON", "HARRISBURG", "KANNAPOLIS", "MONROE", "WAXHAW",
    "FORT MILL", "ROCK HILL", "TEGA CAY", "BELMONT", "MOUNT HOLLY",
    "STALLINGS", "WEDDINGTON",
  ]),
  metro: "charlotte",
},
phoenix: {
  state: "AZ",
  cities: new Set([
    "PHOENIX", "SCOTTSDALE", "TEMPE", "MESA", "CHANDLER",
    "GILBERT", "GLENDALE", "PEORIA", "SURPRISE", "GOODYEAR",
    "AVONDALE", "BUCKEYE", "QUEEN CREEK", "MARICOPA", "CAVE CREEK",
    "FOUNTAIN HILLS", "PARADISE VALLEY", "LITCHFIELD PARK",
    "EL MIRAGE", "TOLLESON", "LAVEEN", "ANTHEM",
  ]),
  metro: "phoenix",
},
seattle: {
  state: "WA",
  cities: new Set([
    "SEATTLE", "BELLEVUE", "KIRKLAND", "REDMOND", "RENTON",
    "BURIEN", "KENT", "FEDERAL WAY", "TUKWILA", "SEATAC",
    "SHORELINE", "LYNNWOOD", "EDMONDS", "MOUNTLAKE TERRACE",
    "BOTHELL", "WOODINVILLE", "ISSAQUAH", "SAMMAMISH", "MERCER ISLAND",
    "BAINBRIDGE ISLAND", "TACOMA", "LAKEWOOD", "DES MOINES",
  ]),
  metro: "seattle",
},
```

- [ ] **Step 2: Update Python TARGET_STATES filter**

In `etl-dewey-data.mjs` around line 323, change:
```python
TARGET_STATES = {'NY', 'CA', 'IL', 'FL', 'TX'}
```
to:
```python
TARGET_STATES = {'NY', 'CA', 'IL', 'FL', 'TX', 'GA', 'CO', 'NC', 'AZ', 'WA'}
```

- [ ] **Step 3: Fix slug generation to include metro prefix**

The `generateSlug()` function at line 224 produces slugs like `123-main-st`. With 10 metros, addresses in different cities can collide on the global `buildings(slug)` unique index. Update the slug generation in the new-building-creation section (~line 1050) to prefix the metro:

Where the code calls `generateSlug(info.normalizedAddr)`, change to:
```javascript
generateSlug(info.metro + "-" + info.normalizedAddr)
```

This produces slugs like `atlanta-123-main-st`, `denver-456-oak-ave`, avoiding cross-metro collisions. Existing slugs for the original 5 metros don't need updating — they were inserted before multi-city and won't collide with the new metro-prefixed format.

- [ ] **Step 4: Add `getBoroughForRow` cases for new metros**

Around line 472, add:
```javascript
if (metro === "atlanta") return city || "Atlanta";
if (metro === "denver") return city || "Denver";
if (metro === "charlotte") return city || "Charlotte";
if (metro === "phoenix") return city || "Phoenix";
if (metro === "seattle") return city || "Seattle";
```

- [ ] **Step 5: Fix `etl-dewey-fast.mjs` API URL**

Line 26 currently points to the Dwellsy folder. Change to Dataset 1:
```javascript
const API_URL = "https://api.deweydata.io/api/v1/external/data/prj_jz8ryysw__fldr_cggezfmh4zsrfevk8";
```

- [ ] **Step 6: Add new metros to `etl-dewey-fast.mjs` METROS object**

Add all 5 new metros to the `METROS` object at line 33, and update the Python TARGET_STATES on line 101 to include `'GA','CO','NC','AZ','WA'`.

- [ ] **Step 7: Commit**

```bash
git add scripts/etl-dewey-data.mjs scripts/etl-dewey-fast.mjs
git commit -m "feat: extend Dataset 1 ETL to support 10 metros (add Atlanta, Denver, Charlotte, Phoenix, Seattle)"
```

---

## Task 4: Build Dwellsy ETL Pipeline

**Files:**
- Create: `scripts/etl-dwellsy.mjs`

This script handles Dwellsy-specific fields that Dataset 1 doesn't have: rich amenities, photos, deposits, vacancy lifecycle, and company profiles.

- [ ] **Step 1: Write the Dwellsy ETL script**

The script should:
1. Page through the Dwellsy API (`prj_bnrmqv8r__fldr_i3zgo3788i84oeasj`, 2 pages)
2. Download each parquet file, read with pyarrow
3. Filter to 10 target metros using MSA_CODE or STATE+CITY matching
4. Match listings to existing buildings by normalized address + ZIP (reuse matching logic from `etl-dewey-data.mjs`)
5. For matched buildings: aggregate photos, amenities, deposit, days-on-market into `dwellsy_building_meta`
6. Aggregate company-level stats into `dwellsy_company_profiles`
7. Aggregate ZIP-level vacancy/deposit stats into `dwellsy_neighborhood_stats`
8. Also feed rent data into `dewey_building_rents` and `dewey_neighborhood_rents` (same tables as Dataset 1 — they share the schema)

Key differences from Dataset 1 ETL and specific aggregation rules:

**Field parsing:**
- `AMENITIES`: split on `"; "` → text array. Deduplicate across listings for same building.
- `PHOTOS`: split on `"; "` → text array. Keep first 10 unique URLs per building. Prefer photos from the most recent listing (`CREATION_TS`).
- `LISTING_DEPOSIT`: numeric, use as-is. Average per building and per ZIP.
- `COMPANY_NAME`: richer than Dataset 1's `COMPANY` (985 vs 85 companies). Use as canonical company name.
- `SS_RAW_SECONDARY_NUMBER`: unit identifier (e.g., "3B"). Store for unit-level tracking (future work).

**Aggregation strategy for `dwellsy_building_meta`:**
- Process ALL pages into memory first, then upsert once per building. Do not process page-by-page with overwrites.
- For each matched building_id, collect all listings across both pages, then:
  - `photos`: take URLs from the most recent listing (highest `CREATION_TS`)
  - `amenities`: union of all amenities seen across all listings for the building
  - `avg_deposit`: mean of all non-null `LISTING_DEPOSIT` values
  - `avg_days_on_market`: mean of `(DEACTIVATION_TIME - CREATION_TS)` in days for inactive listings only. Active listings are excluded from this average (their DOM is unknown/ongoing).
  - `active_listing_count`: count of listings where `PROPERTY_LISTING_STATUS = 'active'`
  - `last_company_name`: `COMPANY_NAME` from the listing with the most recent `CREATION_TS`

**Vacancy rate calculation for `dwellsy_neighborhood_stats`:**
- Group by `(metro, zip, month)` where month = truncated `CREATION_TS`
- `active_listings`: count where `PROPERTY_LISTING_STATUS = 'active'`
- `inactive_listings`: count where `PROPERTY_LISTING_STATUS = 'inactive'`
- `vacancy_rate = active_listings / (active_listings + inactive_listings)` — this is a "listing churn rate" proxy, not true vacancy
- `avg_deposit`: mean of all `LISTING_DEPOSIT` values in that ZIP/month
- `median_days_on_market`: median of `(DEACTIVATION_TIME - CREATION_TS)` for inactive listings

Python filter should include all 10 target states:
```python
TARGET_STATES = {'NY', 'CA', 'IL', 'FL', 'TX', 'GA', 'CO', 'NC', 'AZ', 'WA'}
```

The script follows the same patterns as `etl-dewey-fast.mjs`: single-page processing, download-process-delete, progress tracking. However, unlike the fast script, it loads both pages into memory before writing to DB to avoid cross-page upsert overwrites on `dwellsy_building_meta`.

Usage:
```bash
DEWEY_API_KEY=akv1_... node scripts/etl-dwellsy.mjs --page=1
DEWEY_API_KEY=akv1_... node scripts/etl-dwellsy.mjs --page=2
```

- [ ] **Step 2: Verify script syntax**

Run: `node --check scripts/etl-dwellsy.mjs`

- [ ] **Step 3: Commit**

```bash
git add scripts/etl-dwellsy.mjs
git commit -m "feat: add Dwellsy ETL pipeline for enrichment data (photos, amenities, deposits, vacancy)"
```

---

## Task 5: Update Sitemap Generator

**Files:**
- Modify: `scripts/generate-sitemaps.mjs:25-32,91-97`

- [ ] **Step 1: Update inlined VALID_CITIES and CITY_META**

Add all 5 new cities to `VALID_CITIES` array at line 25 and add their `CITY_META` entries at line 27 (urlPrefix + regions for each).

- [ ] **Step 2: Replace metroToCity() with dynamic lookup**

Around line 91, replace the function with:
```javascript
function metroToCity(metro) {
  return metro in CITY_META ? metro : "nyc";
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-sitemaps.mjs
git commit -m "feat: add 5 new cities to sitemap generator"
```

---

## Task 6: Hero Images

**Files:**
- Create: `public/{atlanta,denver,charlotte,phoenix,seattle}-skyline.webp`

- [ ] **Step 1: Create placeholder skyline images**

```bash
for city in atlanta denver charlotte phoenix seattle; do
  cp public/nyc-skyline.webp "public/${city}-skyline.webp"
done
```

Replace with real images later (Unsplash or AI-generated).

- [ ] **Step 2: Commit**

```bash
git add public/*-skyline.webp
git commit -m "feat: add placeholder skyline images for 5 new cities"
```

---

## Task 7: Run Dataset 1 ETL (5 New Metros)

This is the big data load — 185 GB across 84 pages. Run page-by-page.

**IMPORTANT:** Must use `etl-dewey-data.mjs` (not `etl-dewey-fast.mjs`) for the initial run because only `etl-dewey-data.mjs` creates new building records for unmatched addresses. For new cities, almost all addresses will be unmatched on first pass. `etl-dewey-fast.mjs` only upserts rent rows for already-existing buildings — it would skip nearly everything for new metros.

- [ ] **Step 1: Run pages 1-10 to create initial building inventory**

```bash
DEWEY_API_KEY=akv1_GCSQeBOrokkAiOkkJqGh81TGCIqkif2P9hi \
  node scripts/etl-dewey-data.mjs --page-start=1 --page-end=10
```

Monitor match rates. Early pages (2014) create the building records. Later pages match against them.

- [ ] **Step 2: Continue across all 84 pages with `etl-dewey-data.mjs`**

Run in batches of 10 pages. Each batch downloads, processes, creates new buildings, and upserts rents:

```bash
for start in $(seq 11 10 84); do
  end=$((start + 9))
  if [ $end -gt 84 ]; then end=84; fi
  echo "=== Pages $start-$end ==="
  DEWEY_API_KEY=akv1_GCSQeBOrokkAiOkkJqGh81TGCIqkif2P9hi \
    node scripts/etl-dewey-data.mjs --page-start=$start --page-end=$end
done
```

After all 84 pages complete, `etl-dewey-fast.mjs` can be used for incremental re-runs (new weekly data drops) since all buildings will already exist.

- [ ] **Step 3: Verify row counts after completion**

```sql
SELECT b.metro, COUNT(DISTINCT br.building_id) as buildings_with_rents, COUNT(*) as rent_rows
FROM dewey_building_rents br
JOIN buildings b ON br.building_id = b.id
GROUP BY b.metro ORDER BY rent_rows DESC;
```

---

## Task 8: Run Dwellsy ETL

- [ ] **Step 1: Run Dwellsy page 1**

```bash
DEWEY_API_KEY=akv1_GCSQeBOrokkAiOkkJqGh81TGCIqkif2P9hi \
  node scripts/etl-dwellsy.mjs --page=1
```

- [ ] **Step 2: Run Dwellsy page 2**

```bash
DEWEY_API_KEY=akv1_GCSQeBOrokkAiOkkJqGh81TGCIqkif2P9hi \
  node scripts/etl-dwellsy.mjs --page=2
```

- [ ] **Step 3: Verify Dwellsy-specific tables**

```sql
SELECT metro, COUNT(*) FROM dwellsy_building_meta GROUP BY metro;
SELECT metro, COUNT(*) FROM dwellsy_company_profiles GROUP BY metro;
SELECT metro, COUNT(*) FROM dwellsy_neighborhood_stats GROUP BY metro;
```

---

## Task 9: Smoke Test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify each new city's landing page loads**

Visit:
- `http://localhost:3000/GA/Atlanta`
- `http://localhost:3000/CO/Denver`
- `http://localhost:3000/NC/Charlotte`
- `http://localhost:3000/AZ/Phoenix`
- `http://localhost:3000/WA/Seattle`

- [ ] **Step 3: Verify city switcher shows all 10 cities**

- [ ] **Step 4: Verify a building page in a new city has rent data**

Click into any building and check that 12-year rent trend data appears.

- [ ] **Step 5: Verify build succeeds**

```bash
npx next build 2>&1 | tail -20
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete 5-city expansion with dual-dataset ingestion"
```

---

## Execution Order & Dependencies

```
Task 1 (Migration) ──→ Task 3 (Dataset 1 ETL mods) ──→ Task 7 (Run Dataset 1)
                   └──→ Task 4 (Dwellsy ETL)        ──→ Task 8 (Run Dwellsy)
Task 2 (City config) ──→ Task 5 (Sitemaps)
                     └──→ Task 6 (Hero images)
                     └──→ Task 9 (Smoke test) [depends on all above]
```

Tasks 1-6 can mostly run in parallel. Tasks 7 and 8 are the long-running data loads. Task 9 is the final validation.

---

## What This Enables (Product Features)

| Feature | Primary Source | Status After This Plan |
|---------|---------------|----------------------|
| 12-year rent trend per building | Dataset 1 | Ready for all 10 cities |
| Current rent with photos | Dwellsy | Ready for all 10 cities |
| Landlord/company grading | Both (Dataset 1: 85 companies, Dwellsy: 985) | Ready |
| Rich amenity search | Dwellsy (96% coverage) | Ready |
| Deposit benchmarks | Dwellsy (48% coverage) | Ready |
| Days on market / vacancy | Dwellsy (93% deactivation timestamps) | Ready |
| Seasonal rent calculator | Dataset 1 (12 years of signal) | Massively improved |
| Gentrification index | Dataset 1 (2014 vs 2026 rents) | Ready |
| Amenity price premiums | Both (boolean flags + rich lists) | Improved |
| "Rent Then vs Now" | Dataset 1 | Ready |
| Neighborhood appreciation map | Dataset 1 | Ready |
| Best Value Score | Dataset 1 (growth rate vs neighborhood avg) | Ready |

## Addendum: Dwellsy Rent Merge + Entity Distinction (2026-04-01)

### Decision: Merge Dwellsy Rents Into Existing Tables

Dwellsy rent data (`RENT_PRICE`, `BEDS`, `SQFT`) is merged directly into `dewey_building_rents` and `dewey_neighborhood_rents` via upsert. Rationale:
- No need to show data provenance to users — renters care about the number, not the source
- Increases sample sizes for Sep 2024–Dec 2025 period
- 985+ companies vs 85 = far more buildings with rent data
- Unit-level rents (57% have `SS_RAW_SECONDARY_NUMBER`) increase per-building listing counts
- The ETL script `scripts/etl-dwellsy.mjs` handles both rent merge AND enrichment extraction in a single pass

### Decision: Owner vs Management Company vs Landlord Distinction

Three distinct entity types exist across data sources:

| Field | Source | Meaning |
|-------|--------|---------|
| `buildings.owner_name` | HPD/public records/assessor | **Property owner** (entity on the deed, often an LLC) |
| `buildings.management_company` | Dwellsy `COMPANY_NAME`, StreetEasy/Zillow scrapes | **Management company** (who lists/manages the units) |
| `reviews.landlord_name` | User-submitted reviews | **Landlord** (who the tenant interacts with) |

**Implementation (completed):**
- Migration `20260402000000_dwellsy_enrichment.sql` adds `management_company` column to `buildings`
- `BuildingHeader.tsx` shows both badges: "Managed by: X" and "Property Owner: Y" when available
- `SameLandlordBuildings.tsx` groups by `management_company` when available (more useful for tenants), falls back to `owner_name`
- Section title adapts: "More Managed by Greystar" vs "More by This Owner"
- ETL sets `management_company` only when null (doesn't overwrite existing data)

### Dwellsy ETL Script (`scripts/etl-dwellsy.mjs`)

Key features:
- **20 concurrent file workers** for throughput (configurable via `--workers=N`)
- **MSA code matching** (100% coverage in Dwellsy) + state/city fallback
- **Single-pass processing**: rent merge + enrichment extraction
- **6 upsert targets**: dewey_building_rents, dewey_neighborhood_rents, dwellsy_building_meta, dwellsy_company_profiles, dwellsy_neighborhood_stats, buildings.management_company

Run:
```bash
DEWEY_API_KEY=akv1_... node scripts/etl-dwellsy.mjs --page=1 --workers=20
DEWEY_API_KEY=akv1_... node scripts/etl-dwellsy.mjs --page=2 --workers=20
```

## Future Work (Not in This Plan)

- UI components for new Dwellsy data (photo carousel, deposit display, vacancy badge, company profile page)
- Landlord comparison pages (`/[city]/landlord/[slug]`) with portfolio stats from Dwellsy company data
- Deposit benchmark tool ("Is this deposit reasonable?") using dwellsy_neighborhood_stats
- Days-on-market / negotiation leverage score on building pages
- Vacancy rate tracker on neighborhood pages
- Amenity-aware search/filtering using rich Dwellsy amenity strings
- Violations / 311 / crime data for new cities (city-specific open data APIs)
- Rent stabilization / tenant protection research for new cities
- Building the "Gentrification Index" and "Best Value Score" computed tables
- Unit-level rent tracking using Dwellsy's SS_RAW_SECONDARY_NUMBER
