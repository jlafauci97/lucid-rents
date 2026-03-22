# LA Crime Page Design

## Overview

Make the existing `[city]/crime` pages city-aware so they work for Los Angeles using LAPD Crime Data (`2nrs-mtv8`) from data.lacity.org. The NYC crime page stays unchanged in behavior; LA gets the same layout with LA-specific labels, areas, and data.

## Data Source

- **API**: `https://data.lacity.org/resource/2nrs-mtv8.json` (SODA API)
- **Dataset**: LAPD Crime Data
- **Table**: Shared `nypd_complaints` table with `metro='los-angeles'`
- **Current state**: 79,261 records (Mar-Dec 2024 only). Needs re-run to get 2025+ data.

## What Changes

### 1. Data Refresh (backfill script)

Re-run `scripts/lapd-crime-backfill.mjs` to load current 2025 data. The script already:
- Fetches from the LAPD SODA API with 2-year lookback
- Maps LAPD fields to `nypd_complaints` schema (`metro='los-angeles'`)
- Categorizes crimes (violent/property/quality_of_life)
- Backfills zip codes from lat/lon via `backfill_crime_zip_codes` RPC
- Upserts on `cmplnt_num` so re-runs are safe

No script changes needed — just re-run it.

### 2. Crime list page (`src/app/[city]/crime/page.tsx`)

**Problem**: Page has hardcoded NYC references and no metro filtering.

| Line | Current | Fix |
|------|---------|-----|
| 32-48 | `getCrimeByZip()` passes `{}` (no metro filter) | Pass `{ metro: city }` where `city` is the route param (e.g. `"nyc"` or `"los-angeles"`) — the city slug IS the metro value |
| 103 | `boroughs = ["Manhattan", "Brooklyn", ...]` | Use `CITY_META[city].crimeAreas` (new field, see section 7) |
| 125 | `"NYPD crime data..."` | `"{CITY_META[city].crimeSource} crime data..."` |
| 140 | `"All Boroughs"` | `"All {CITY_META[city].regionLabel}s"` |
| 217 | Column header "Borough" | `CITY_META[city].regionLabel` |
| 281 | `getNeighborhoodName(zipCode)` | City-aware: use existing for NYC, return `null` for LA (no LA neighborhood mapping yet) |
| 273-282 | Neighborhood Report Card link column rendered for every row | Conditionally render: only show the link cell content when `getNeighborhoodName(row.zip_code)` returns a name. For LA rows this returns null, so the cell is empty (or hide the entire column for LA). |

**Metro parameter**: The city route param slug (e.g. `"nyc"`, `"los-angeles"`) is used directly as the `metro` value in RPC calls. There is no `metro` field on `CityMeta` — the city key itself is the metro. Always pass `metro` for both cities — `{ metro: "nyc" }` for NYC and `{ metro: "los-angeles" }` for LA. This prevents mixed-city data now that both cities have records in the table.

**`getCrimeByZip` must accept city param**: The function is currently a standalone async function with no parameters. It must be refactored to accept the city slug so it can pass `{ metro: city }` to the RPC.

### 3. Crime detail page (`src/app/[city]/crime/[zipCode]/page.tsx`)

**Problem**: Hardcoded NYC references and missing metro filters.

| Line | Current | Fix |
|------|---------|-----|
| 60 | OG description: `"...NYC."` | Use `CITY_META[city].fullName` |
| 97-99 | `crime_zip_summary` called without metro | Pass `{ target_zip: zipCode, since_date: sinceDate, metro: city }` |
| 102 | `nypd_complaints` query has no metro filter | Add `.eq("metro", city)` |
| 138 | JSON-LD: `"NYC Zip Code"` / `"NYC"` | Use `CITY_META[city].name` |
| 172 | `"NYPD crime data"` | `CITY_META[city].crimeSource` |
| 219-230 | Neighborhood Report Card link (unconditional) | **Conditionally render**: show only when `getNeighborhoodName(zipCode)` returns a name. For LA this returns null, so the link is hidden. |
| 242 | `"reported by NYPD"` | `"reported by {CITY_META[city].crimeSource}"` |
| 299 | `"Precinct {crime.precinct}"` | Only render when `crime.precinct` is not null (already conditionally rendered with `{crime.precinct && ...}`, so this works for LA automatically) |

### 4. Crime trend component (`src/components/crime/CrimeTrend.tsx`)

**Problem**: The component fetches `/api/crime/${zipCode}/trends` with no city/metro parameter. The API route calls `crime_zip_trends` RPC with only `{ target_zip: zipCode }`, returning data across all cities.

**Fix (3 parts)**:

**(a) Add `city` prop to `CrimeTrend`:**
```typescript
interface CrimeTrendProps {
  zipCode: string;
  city: string;  // add this
}
```

**(b) Pass city as query param in fetch:**
```typescript
const res = await fetch(`/api/crime/${zipCode}/trends?city=${city}`);
```

**(c) Update the trends API route** (`src/app/api/crime/[zipCode]/trends/route.ts`):
- Read `city` from `request.url` searchParams
- Pass `metro: city` to the `crime_zip_trends` RPC call:
```typescript
const { searchParams } = new URL(request.url);
const city = searchParams.get("city") || "nyc";

const { data, error } = await supabase.rpc("crime_zip_trends", {
  target_zip: zipCode,
  metro: city,
});
```

**(d) Update detail page** to pass `city` prop:
```tsx
<CrimeTrend zipCode={zipCode} city={city} />
```

### 5. API routes

All crime API routes need metro filtering:

**`/api/crime/[zipCode]/route.ts`** — Read `city` query param, pass `metro` to RPC and add `.eq("metro", city)` to direct table queries.

**`/api/crime/[zipCode]/trends/route.ts`** — Read `city` query param, pass `metro` to `crime_zip_trends` RPC (see section 4c).

**`/api/crime/by-zip/route.ts`** — Already reads `city` query param. Verify it passes `metro` correctly to the RPC. (It currently uses the Supabase REST endpoint directly; confirm the body includes `{ metro: cityParam }`.)

**`/api/map/crime/route.ts`** — **Bug fix**: Currently passes `metro_filter` as the RPC parameter name (line 34: `rpcBody.metro_filter = cityParam`), but the `crime_by_zip` RPC parameter is named `metro`. Fix to `rpcBody.metro = cityParam`.

### 6. City config additions

Add two new fields to `CityMeta` in `src/lib/cities.ts`:

```typescript
interface CityMeta {
  // ... existing fields ...
  /** Crime data source label (e.g. "NYPD", "LAPD") */
  crimeSource: string;
  /** Areas used for crime page filter chips — may differ from regions */
  crimeAreas: readonly string[];
}
```

Values:
```typescript
nyc: {
  crimeSource: "NYPD",
  crimeAreas: ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"],
  // ...existing
},
"los-angeles": {
  crimeSource: "LAPD",
  crimeAreas: [
    "77th Street", "Central", "Devonshire", "Foothill", "Harbor",
    "Hollenbeck", "Hollywood", "Mission", "N Hollywood", "Newton",
    "Northeast", "Olympic", "Pacific", "Rampart", "Southeast",
    "Southwest", "Topanga", "Van Nuys", "West LA", "West Valley", "Wilshire",
  ],
  // ...existing
},
```

### 7. `getNeighborhoodName` city-awareness

The function in `src/lib/nyc-neighborhoods.ts` only maps NYC zip codes. For LA, it will return `undefined`/`null`.

**Approach**: No changes to the function itself. Instead, callers should handle the null case:
- List page: Show zip code only when no neighborhood name
- Detail page: Hide "Neighborhood Report Card" link when `getNeighborhoodName` returns null
- Metadata: Use zip code as display name when no neighborhood name

## What Stays the Same

- All chart components (CrimeTrend, CrimeCategoryBreakdown) — already generic (CrimeTrend just needs a city prop added)
- Color scheme (violent=red, property=amber, QoL=blue)
- Table layout, sorting, summary stat cards
- Crime categorization logic (keyword-based)
- Database schema and RPC functions (already multi-city)
- CrimeMapSection and CrimeHeatLayer — already use lat/lon

## LA-Specific Differences

| Aspect | NYC | LA |
|--------|-----|-----|
| Source label | NYPD | LAPD |
| Area concept | Borough (5) | LAPD Area (21) |
| Law categories | FELONY, MISDEMEANOR, VIOLATION | FELONY, MISDEMEANOR only |
| Precinct | Yes | No (null) |
| Neighborhood mapping | `getNeighborhoodName()` | Not available yet (use zip only) |

## Out of Scope

- LA neighborhood name mapping (future task)
- NYC data refresh (separate concern)
- Crime heatmap changes (already works with lat/lon)
- New visualizations or page layouts
