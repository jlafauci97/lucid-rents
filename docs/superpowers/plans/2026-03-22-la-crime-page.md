# LA Crime Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing `[city]/crime` pages city-aware so they display LA crime data using LAPD Crime Data from data.lacity.org.

**Architecture:** Add `crimeSource` and `crimeAreas` fields to `CityMeta`, then update the crime list page, detail page, CrimeTrend component, CrimeMapSection, and API routes to pass metro filters and use city-specific labels. Finally, re-run the backfill script to load fresh 2025 data.

**Tech Stack:** Next.js App Router, Supabase RPCs, React (Recharts, React Leaflet), TypeScript

**Spec:** `docs/superpowers/specs/2026-03-22-la-crime-page-design.md`

---

### Task 1: Add `crimeSource` and `crimeAreas` to CityMeta

**Files:**
- Modify: `src/lib/cities.ts:6-25` (CityMeta interface) and `src/lib/cities.ts:27-107` (CITY_META values)

- [ ] **Step 1: Add fields to `CityMeta` interface**

In `src/lib/cities.ts`, add two new fields to the `CityMeta` interface after the existing `zoom` field:

```typescript
  /** Crime data source label (e.g. "NYPD", "LAPD") */
  crimeSource: string;
  /** Areas used for crime page filter chips — may differ from regions */
  crimeAreas: readonly string[];
```

- [ ] **Step 2: Add values to NYC config**

In the `nyc` entry of `CITY_META`, add after `zoom: 11,`:

```typescript
    crimeSource: "NYPD",
    crimeAreas: ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"],
```

- [ ] **Step 3: Add values to LA config**

In the `"los-angeles"` entry of `CITY_META`, add after `zoom: 10,`:

```typescript
    crimeSource: "LAPD",
    crimeAreas: [
      "77th Street", "Central", "Devonshire", "Foothill", "Harbor",
      "Hollenbeck", "Hollywood", "Mission", "N Hollywood", "Newton",
      "Northeast", "Olympic", "Pacific", "Rampart", "Southeast",
      "Southwest", "Topanga", "Van Nuys", "West LA", "West Valley", "Wilshire",
    ],
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors (or only pre-existing ones unrelated to cities.ts)

- [ ] **Step 5: Commit**

```bash
git add src/lib/cities.ts
git commit -m "feat: add crimeSource and crimeAreas to CityMeta"
```

---

### Task 2: Fix map crime API route bug + add metro to trends API

**Files:**
- Modify: `src/app/api/map/crime/route.ts:34` (fix `metro_filter` → `metro`)
- Modify: `src/app/api/crime/[zipCode]/trends/route.ts:37-47` (add metro param)

- [ ] **Step 1: Fix the map crime route bug**

In `src/app/api/map/crime/route.ts`, line 34, change:
```typescript
    if (cityParam) rpcBody.metro_filter = cityParam;
```
to:
```typescript
    if (cityParam) rpcBody.metro = cityParam;
```

- [ ] **Step 2: Add metro filtering to the trends API route**

In `src/app/api/crime/[zipCode]/trends/route.ts`, update the GET handler. Change lines 37-47 from:

```typescript
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ zipCode: string }> }
) {
  try {
    const { zipCode } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("crime_zip_trends", {
      target_zip: zipCode,
    });
```

to:

```typescript
export async function GET(
  request: Request,
  { params }: { params: Promise<{ zipCode: string }> }
) {
  try {
    const { zipCode } = await params;
    const { searchParams } = new URL(request.url);
    const cityParam = searchParams.get("city") || "nyc";
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("crime_zip_trends", {
      target_zip: zipCode,
      metro: cityParam,
    });
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to these files

- [ ] **Step 4: Verify other API routes are already correct**

`/api/crime/[zipCode]/route.ts` — Already has metro filtering at lines 29 and 41-43. No changes needed.
`/api/crime/by-zip/route.ts` — Already passes `metro` at line 21. No changes needed.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/map/crime/route.ts src/app/api/crime/[zipCode]/trends/route.ts
git commit -m "fix: add metro filter to trends API and fix map crime route param name"
```

---

### Task 3: Update CrimeTrend component to accept city prop

**Files:**
- Modify: `src/components/crime/CrimeTrend.tsx:30-32` (props interface) and `src/components/crime/CrimeTrend.tsx:88,98` (component + fetch)

- [ ] **Step 1: Add city to props interface**

In `src/components/crime/CrimeTrend.tsx`, change the props interface (line 30-32):

```typescript
interface CrimeTrendProps {
  zipCode: string;
  city: string;
}
```

- [ ] **Step 2: Update component signature and fetch URL**

Change line 88:
```typescript
export function CrimeTrend({ zipCode, city }: CrimeTrendProps) {
```

Change line 98:
```typescript
        const res = await fetch(`/api/crime/${zipCode}/trends?city=${city}`);
```

Add `city` to the useEffect dependency array at line 112:
```typescript
  }, [zipCode, city]);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Errors in files that use `<CrimeTrend>` without the `city` prop — these will be fixed in later tasks.

- [ ] **Step 4: Commit**

```bash
git add src/components/crime/CrimeTrend.tsx
git commit -m "feat: add city prop to CrimeTrend for metro-filtered trends"
```

---

### Task 4: Update CrimeMapSection to use city-aware center + pass city to CrimeHeatLayer

**Files:**
- Modify: `src/components/crime/CrimeMapSection.tsx:27-29,31,186-189` (props, center)
- Modify: `src/components/map/CrimeHeatLayer.tsx:44-55` (pass city to API fetch)

- [ ] **Step 1: Add city prop to CrimeMapSection and use CITY_META for center**

In `src/components/crime/CrimeMapSection.tsx`:

Change props interface (line 27-29):
```typescript
interface CrimeMapSectionProps {
  borough: string;
  city: string;
}
```

Change component signature (line 31):
```typescript
export function CrimeMapSection({ borough, city }: CrimeMapSectionProps) {
```

Add import for CITY_META at the top (after existing imports):
```typescript
import { CITY_META, type City } from "@/lib/cities";
```

Change the MapContainer center and zoom (line 186-189):
```typescript
      <MapContainer
        center={[CITY_META[city as City].center.lat, CITY_META[city as City].center.lng]}
        zoom={CITY_META[city as City].zoom}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
      >
```

- [ ] **Step 2: Update CrimeHeatLayer to pass city to the API fetch**

In `src/components/map/CrimeHeatLayer.tsx`, update the fetch in the useEffect (lines 47-50):

```typescript
    const params = new URLSearchParams();
    if (borough) params.set("borough", borough);
    params.set("city", city);

    fetch(`/api/map/crime?${params}`)
```

Add `city` to the useEffect dependency array (line 55):
```typescript
  }, [borough, visible, city]);
```

(Note: `city` is already available via `useCity()` on line 40.)

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Errors in crime page that uses `<CrimeMapSection>` without `city` prop — fixed in next task.

- [ ] **Step 4: Commit**

```bash
git add src/components/crime/CrimeMapSection.tsx src/components/map/CrimeHeatLayer.tsx
git commit -m "feat: make CrimeMapSection and CrimeHeatLayer city-aware"
```

---

### Task 5: Update the crime list page (`[city]/crime/page.tsx`)

**Files:**
- Modify: `src/app/[city]/crime/page.tsx` (metro filtering, dynamic labels, area filters)

- [ ] **Step 1: Make `getCrimeByZip` accept a city param and pass metro**

Change the function (lines 32-48) to accept a city string:

```typescript
async function getCrimeByZip(city: string) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/crime_by_zip`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ metro: city }),
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    console.error("crime_by_zip fetch error:", res.status, await res.text());
    return [];
  }
  return res.json();
}
```

Update the call site (line 72) to pass the city:

```typescript
  const data = await getCrimeByZip(cityParam);
```

- [ ] **Step 2: Replace hardcoded boroughs with `crimeAreas`**

Change line 103 from:
```typescript
  const boroughs = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];
```
to:
```typescript
  const meta = CITY_META[cityParam as City];
  const areas = meta.crimeAreas;
```

- [ ] **Step 3: Update all hardcoded labels**

Change the description text (line 125-127):
```typescript
        <p className="text-[#64748b] text-sm sm:text-base">
          {meta.crimeSource} crime data aggregated by zip code over the last 12 months. Click a
          zip code for detailed breakdowns and trends.
        </p>
```

Change "All Boroughs" link text (line 140):
```typescript
          All {meta.regionLabel}s
```

Update the area filter loop (line 142) — change `boroughs.map` to `areas.map` and update variable name from `b` for clarity:
```typescript
        {areas.map((area) => (
          <Link
            key={area}
            href={`${cityPath("/crime", cityParam as City)}?borough=${encodeURIComponent(area)}${sortBy !== "total" ? `&sort=${sortBy}&order=${order}` : ""}`}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              borough.toLowerCase() === area.toLowerCase()
                ? "bg-[#0F1D2E] text-white"
                : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
            }`}
          >
            {area}
          </Link>
        ))}
```

Change the column header "Borough" (line 216-218) to:
```typescript
                      {meta.regionLabel} <ArrowUpDown className="w-3 h-3" />
```

- [ ] **Step 4: Pass city prop to CrimeMapSection**

Change line 159:
```typescript
        <CrimeMapSection borough={borough} city={cityParam} />
```

- [ ] **Step 5: Make the neighborhood report card link conditional**

Change lines 273-282. Wrap the cell content so it only renders when a neighborhood name exists:

```typescript
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {(() => {
                        const name = getNeighborhoodName(row.zip_code);
                        return name ? (
                          <Link
                            href={neighborhoodUrl(row.zip_code)}
                            className="inline-flex items-center gap-1 text-xs text-[#3B82F6] hover:text-[#1d4ed8] font-medium"
                            title="Neighborhood Report Card"
                          >
                            <MapPin className="w-3 h-3" />
                            {name}
                          </Link>
                        ) : null;
                      })()}
                    </td>
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to this file

- [ ] **Step 7: Commit**

```bash
git add src/app/[city]/crime/page.tsx
git commit -m "feat: make crime list page city-aware with dynamic labels and metro filter"
```

---

### Task 6: Update the crime detail page (`[city]/crime/[zipCode]/page.tsx`)

**Files:**
- Modify: `src/app/[city]/crime/[zipCode]/page.tsx` (metro filters, dynamic labels, conditional blocks)

- [ ] **Step 1: Fix OG description to use city name**

Change line 60 from:
```typescript
      description: `Crime trends and recent incidents for ${displayName}, NYC.`,
```
to:
```typescript
      description: `Crime trends and recent incidents for ${displayName}, ${CITY_META[city as City].fullName}.`,
```

- [ ] **Step 2: Add metro filter to RPC call and direct query**

Change the `crime_zip_summary` call (lines 97-100) to include metro:
```typescript
    supabase.rpc("crime_zip_summary", {
      target_zip: zipCode,
      since_date: sinceDate,
      metro: city,
    }),
```

Add `.eq("metro", city)` to the `nypd_complaints` query (after line 106, after `.eq("zip_code", zipCode)`):
```typescript
      .eq("metro", city)
```

- [ ] **Step 3: Fix JSON-LD to use city name**

Change line 138-139 from:
```typescript
        name: neighborhoodName
          ? `${neighborhoodName}, NYC (${zipCode})`
          : `NYC Zip Code ${zipCode}`,
```
to:
```typescript
        name: neighborhoodName
          ? `${neighborhoodName}, ${CITY_META[city].name} (${zipCode})`
          : `${CITY_META[city].name} Zip Code ${zipCode}`,
```

- [ ] **Step 4: Replace hardcoded source labels**

Change line 172 from:
```typescript
          NYPD crime data for the last 12 months
```
to:
```typescript
          {CITY_META[city].crimeSource} crime data for the last 12 months
```

Change line 242 from:
```typescript
              Most recent incidents reported by NYPD
```
to:
```typescript
              Most recent incidents reported by {CITY_META[city].crimeSource}
```

- [ ] **Step 5: Pass city prop to CrimeTrend**

Change line 214:
```typescript
        <CrimeTrend zipCode={zipCode} city={city} />
```

- [ ] **Step 6: Make Neighborhood Report Card link conditional**

Wrap lines 219-230 in a conditional:
```typescript
      {neighborhoodName && (
        <Link
          href={neighborhoodUrl(zipCode)}
          className="flex items-center gap-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4 mb-8 hover:bg-[#DBEAFE] transition-colors"
        >
          <MapPin className="w-5 h-5 text-[#3B82F6] shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#0F1D2E]">
              {neighborhoodName} Report Card
            </p>
            <p className="text-xs text-[#64748b]">See building grades, violations, and landlord info for {displayName}</p>
          </div>
        </Link>
      )}
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/app/[city]/crime/[zipCode]/page.tsx
git commit -m "feat: make crime detail page city-aware with metro filters and dynamic labels"
```

---

### Task 7: Re-run the LAPD crime backfill to load 2025 data

**Files:**
- Run: `scripts/lapd-crime-backfill.mjs`

- [ ] **Step 1: Run the backfill script**

Run: `node scripts/lapd-crime-backfill.mjs`

This will:
- Fetch ~2 years of LAPD crime data from the SODA API (including 2025)
- Upsert into `nypd_complaints` with `metro='los-angeles'`
- Backfill zip codes from lat/lon coordinates
- Print a summary of records loaded and category breakdown

Expected output: Something like "Fetch complete: X records fetched, Y upserted" followed by zip code backfill count and category breakdown.

This may take several minutes depending on the volume of data (potentially 100k+ records across 2 years).

- [ ] **Step 2: Verify data is loaded**

Check the database to confirm 2025 data exists:

```sql
SELECT EXTRACT(YEAR FROM cmplnt_date) as year, COUNT(*)
FROM nypd_complaints
WHERE metro = 'los-angeles'
GROUP BY year ORDER BY year;
```

Expected: Rows for both 2024 and 2025.

Also verify zip codes are populated:
```sql
SELECT COUNT(*) FILTER (WHERE zip_code IS NOT NULL) as has_zip,
       COUNT(*) FILTER (WHERE zip_code IS NULL) as no_zip
FROM nypd_complaints WHERE metro = 'los-angeles';
```

Expected: Most records should have zip codes, with few or none missing.

---

### Task 8: Smoke test the LA crime page

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Visit the LA crime list page**

Navigate to: `http://localhost:3000/los-angeles/crime`

Verify:
- Page loads with "LAPD crime data" in the description (not "NYPD")
- Area filter chips show LAPD areas (Central, Hollywood, West LA, etc.) not NYC boroughs
- Table shows LA zip codes with crime data
- Map is centered on Los Angeles (not NYC)
- Clicking an area filter chip filters the table correctly
- Summary cards show totals that look reasonable

- [ ] **Step 3: Visit an LA crime detail page**

Click on any zip code in the table to go to the detail page.

Verify:
- Page says "LAPD crime data" (not "NYPD")
- Summary cards show data
- CrimeTrend chart loads with data
- Category breakdown chart shows data
- Recent crimes list shows incidents with "reported by LAPD"
- No "Neighborhood Report Card" link is shown (expected — no LA mapping yet)
- No "Precinct" labels on individual crimes (LA has no precincts)

- [ ] **Step 4: Verify NYC still works**

Navigate to: `http://localhost:3000/nyc/crime`

Verify:
- Page still shows NYC boroughs, "NYPD" labels
- Map centered on NYC
- Data is NYC-only (not mixed with LA)

- [ ] **Step 5: Commit any remaining fixes if needed**

If smoke testing reveals issues, fix them and commit.
