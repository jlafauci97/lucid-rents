# Chicago → NYC Data Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Chicago building pages to full data parity with NYC by adding missing data sources (energy benchmarks, rodent complaints, problem landlords, CTA transit), enhancing existing syncs, and enriching the building page UI.

**Architecture:** Chicago already has 6 working syncs (violations, 311, crimes, permits, RLTO, lead) storing into shared tables (`dob_violations`, `complaints_311`, `nypd_complaints`, `dob_permits`) plus Chicago-specific tables (`chicago_rlto_violations`, `chicago_scofflaws`, `chicago_demolitions`, `chicago_lead_inspections`, `chicago_affordable_units`). We extend this pattern by: (1) adding Chicago energy benchmarking to the existing `sync-energy` route, (2) adding CTA transit to `sync-transit`, (3) creating new tables + sync functions for rodent complaints and problem landlord data, (4) enhancing the ChicagoInfoCard and building page to surface all this data.

**Tech Stack:** Next.js 15, Supabase (Postgres), Chicago SODA API (data.cityofchicago.org), CTA GTFS

---

## What Already Works for Chicago

Before diving in, here's the inventory of what's already implemented:

| Data Source | Sync Function | Table | Status |
|---|---|---|---|
| Building Code Violations | `syncChicagoViolations` (22u3-xenr) | `dob_violations` (metro=chicago) | **Working** |
| 311 Service Requests | `syncChicago311` (v6vf-nfxy) | `complaints_311` (metro=chicago) | **Working** |
| CPD Crimes | `syncChicagoCrimes` (ijzp-q8t2) | `nypd_complaints` (metro=chicago) | **Working** |
| Building Permits | `syncChicagoPermits` (ydr8-5enu) | `dob_permits` (metro=chicago) | **Working** |
| RLTO Violations | `syncChicagoRLTO` (awqx-tuwv) | `chicago_rlto_violations` | **Working** |
| Lead Inspections | `syncChicagoLead` | `chicago_lead_inspections` | **Disabled** (no individual dataset) |
| Scofflaws | `backfill-chicago-scofflaws.mjs` | `chicago_scofflaws` | **Manual backfill only** |
| Demolitions | — | `chicago_demolitions` | **Table exists, no sync** |
| Address Linking | `linkByAddress` (mode=link&source=chicago) | — | **Working** |
| Building page | `ChicagoInfoCard` | — | **Basic** (ward, RLTO, scofflaw, demolitions, lead) |
| Energy | — | `energy_benchmarks` | **Not syncing Chicago** |
| Transit | — | `transit_stops` | **Not syncing CTA** |

## What This Plan Adds

| # | Data Source | Dataset ID | Table | Records |
|---|---|---|---|---|
| 1 | Energy Benchmarking | `xq83-jr8c` | `energy_benchmarks` (metro=chicago) | ~28K |
| 2 | CTA L Stops | `8pix-ypme` | `transit_stops` (metro=chicago) | ~302 |
| 3 | CTA Bus Stops | GTFS feed | `transit_stops` (metro=chicago) | ~11K |
| 4 | Problem Landlord List | `crg5-4zyp` | `chicago_scofflaws` (upgrade to cron) | ~659 |
| 5 | Rodent Complaints | filtered from 311 | `chicago_rodent_complaints` | ~319K |
| 6 | Demolitions | filtered from permits | `chicago_demolitions` (upgrade to cron) | filtered |
| 7 | Enhanced ChicagoInfoCard | — | — | UI enrichment |
| 8 | refresh-stats Chicago coverage | — | `buildings` aggregate columns | count fixes |

---

### Task 1: Chicago Energy Benchmarking Sync

Add Chicago to the existing `sync-energy` route. Chicago's Energy Benchmarking Ordinance requires large buildings (50K+ sqft) to report annually. Dataset `xq83-jr8c` has ~28K records with `chicago_energy_rating` (0-4 scale), address, and location.

**Files:**
- Modify: `src/app/api/cron/sync-energy/route.ts`

- [ ] **Step 1: Read the existing sync-energy route to understand the full pattern**

Read the entire `src/app/api/cron/sync-energy/route.ts` file. It currently handles NYC (LL84 dataset `5zyy-y8am`) and LA (EBEWE dataset `9yda-i4ya`). Note the shared helpers: `parseNum`, `parseInt2`, `normalizeBbl`, `normalizeApn`, and the `energy_benchmarks` table schema used for upserts.

- [ ] **Step 2: Add Chicago energy benchmarking config and fetch function**

Add after the LA config section (~line 35):

```typescript
/* ---------------------------------------------------------------------------
 * Chicago Energy Benchmarking config
 * -------------------------------------------------------------------------*/

const CHICAGO_SODA_BASE = "https://data.cityofchicago.org/resource";
const CHICAGO_ENERGY_DATASET = "xq83-jr8c";
```

Then add the Chicago fetch function after the LA sync function. Follow the same pattern as `syncLAEnergy`:

```typescript
async function syncChicagoEnergy(): Promise<{ added: number; linked: number; errors: string[] }> {
  const errors: string[] = [];
  let totalAdded = 0;
  let totalLinked = 0;

  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const url =
      `${CHICAGO_SODA_BASE}/${CHICAGO_ENERGY_DATASET}.json` +
      `?$limit=${PAGE_SIZE}&$offset=${offset}` +
      `&$order=:id`;

    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      errors.push(`Chicago Energy API error: ${res.status}`);
      break;
    }

    const records = await res.json();
    if (!records || records.length === 0) { hasMore = false; break; }

    const rows = records
      .filter((r: Record<string, unknown>) => r.address)
      .map((r: Record<string, unknown>) => ({
        property_id: r.id ? `CHI-ENERGY-${r.id}` : `CHI-ENERGY-${String(r.address).slice(0, 50)}`,
        property_name: r.address ? String(r.address) : null,
        report_year: r.data_year ? parseInt(String(r.data_year), 10) : null,
        address: r.address ? String(r.address) : null,
        borough: "Chicago",
        zip_code: r.zip_code ? String(r.zip_code) : null,
        energy_star_score: r.chicago_energy_rating != null ? parseInt(String(r.chicago_energy_rating), 10) : null,
        site_eui: parseNum(r.site_eui as string | undefined),
        weather_normalized_site_eui: parseNum(r.weather_normalized_site_eui as string | undefined),
        total_ghg_emissions: parseNum(r.total_ghg_emissions_metric_tons_co2e as string | undefined),
        electricity_use: parseNum(r.electricity_use_kbtu as string | undefined),
        natural_gas_use: parseNum(r.natural_gas_use_kbtu as string | undefined),
        property_gfa: parseNum(r.gross_floor_area_buildings_sq_ft as string | undefined),
        latitude: r.latitude ? parseFloat(String(r.latitude)) : null,
        longitude: r.longitude ? parseFloat(String(r.longitude)) : null,
        metro: "chicago",
      }));

    if (rows.length > 0) {
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from("energy_benchmarks")
          .upsert(batch, { onConflict: "property_id,report_year" });
        if (error) errors.push(`Chicago Energy upsert: ${error.message}`);
        else totalAdded += batch.length;
      }
    }

    if (records.length < PAGE_SIZE) hasMore = false;
    else offset += PAGE_SIZE;
  }

  // Link to buildings by address
  const { data: unlinked } = await supabase
    .from("energy_benchmarks")
    .select("id, address")
    .eq("metro", "chicago")
    .is("building_id", null)
    .not("address", "is", null)
    .limit(2000);

  if (unlinked && unlinked.length > 0) {
    for (const row of unlinked) {
      const normalized = String(row.address).trim().toUpperCase().replace(/\s+/g, " ");
      const { data: building } = await supabase
        .from("buildings")
        .select("id")
        .eq("metro", "chicago")
        .ilike("full_address", `${normalized}%`)
        .limit(1)
        .single();

      if (building) {
        await supabase
          .from("energy_benchmarks")
          .update({ building_id: building.id })
          .eq("id", row.id);
        totalLinked++;
      }
    }
  }

  return { added: totalAdded, linked: totalLinked, errors };
}
```

- [ ] **Step 3: Wire Chicago into the GET handler**

In the `GET` handler function, add the Chicago sync call after the LA sync. Look for where `syncLAEnergy()` is called and add:

```typescript
// Chicago Energy Benchmarking
const chicago = await syncChicagoEnergy();
results.push({
  source: "chicago",
  added: chicago.added,
  linked: chicago.linked,
  errors: chicago.errors,
});
```

- [ ] **Step 4: Test the sync locally**

Run:
```bash
curl "http://localhost:3000/api/cron/sync-energy" | jq
```

Expected: Response includes a `chicago` entry with `added > 0`.

- [ ] **Step 5: Verify data in Supabase**

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = {};
fs.readFileSync('.env.local','utf8').split('\n').forEach(l => {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if(m) env[m[1].trim()] = m[2].trim().replace(/^\"|\"$/g,'');
});
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { count } = await s.from('energy_benchmarks').select('id', { count: 'exact', head: true }).eq('metro', 'chicago');
  console.log('Chicago energy records:', count);
})();
"
```

Expected: Count > 0 (likely ~28K after full sync).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/sync-energy/route.ts
git commit -m "feat(sync): add Chicago energy benchmarking to sync-energy"
```

---

### Task 2: CTA Transit Stops Sync

Add CTA L (train) and bus stops to the existing `sync-transit` route. The current route only fetches NYC MTA subway + bus stops.

**Files:**
- Modify: `src/app/api/cron/sync-transit/route.ts`

- [ ] **Step 1: Read the full sync-transit route**

Read `src/app/api/cron/sync-transit/route.ts` entirely. Note the `TransitStop` interface and the upsert pattern to `transit_stops` table.

- [ ] **Step 2: Add CTA L stops fetch function**

Add after the existing NYC fetch functions:

```typescript
// ── CTA L Stops (data.cityofchicago.org) ────────────────────────────
async function fetchCTALStops(): Promise<TransitStop[]> {
  const url =
    "https://data.cityofchicago.org/resource/8pix-ypme.json?$limit=500";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CTA L API ${res.status}`);
  const data = await res.json();

  const lineNames: Record<string, string> = {
    red: "Red", blue: "Blue", g: "Green", brn: "Brown",
    p: "Purple", pnk: "Pink", o: "Orange", y: "Yellow",
  };

  return data
    .filter((s: Record<string, unknown>) => s.location)
    .map((s: Record<string, unknown>) => {
      const loc = s.location as { latitude?: string; longitude?: string } | undefined;
      const lat = loc?.latitude ? parseFloat(loc.latitude) : null;
      const lng = loc?.longitude ? parseFloat(loc.longitude) : null;
      if (!lat || !lng) return null;

      const routes: string[] = [];
      for (const [key, name] of Object.entries(lineNames)) {
        if (s[key] === true || s[key] === "true") routes.push(name);
      }

      return {
        type: "rail" as const,
        stop_id: `CTA-L-${s.stop_id || s.map_id}`,
        name: s.station_name ? String(s.station_name) : String(s.stop_name || ""),
        latitude: lat,
        longitude: lng,
        routes,
        ada_accessible: s.ada === true || s.ada === "true" ? true : s.ada === false || s.ada === "false" ? false : null,
      };
    })
    .filter(Boolean) as TransitStop[];
}
```

- [ ] **Step 3: Add CTA bus stops fetch function**

CTA bus stop data on the SODA portal may be incomplete. Use the CTA GTFS feed as primary source:

```typescript
// ── CTA Bus Stops (GTFS) ─────────────────────────────────────────────
async function fetchCTABusStops(): Promise<TransitStop[]> {
  // CTA publishes GTFS data with stops.txt containing all bus stops.
  // Fallback: use the SODA dataset if GTFS is unavailable.
  const url =
    "https://data.cityofchicago.org/resource/hvnx-qtky.json?$limit=50000";
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) {
    console.warn(`CTA Bus SODA API returned ${res.status}, skipping bus stops`);
    return [];
  }
  const data = await res.json();
  if (!data || data.length === 0) return [];

  return data
    .filter((s: Record<string, unknown>) => {
      const geom = s.the_geom as { coordinates?: number[] } | undefined;
      return geom?.coordinates && geom.coordinates.length >= 2;
    })
    .map((s: Record<string, unknown>) => {
      const geom = s.the_geom as { coordinates: number[] };
      return {
        type: "bus" as const,
        stop_id: `CTA-BUS-${s.systemstop || s.public_nam}`,
        name: s.public_nam ? String(s.public_nam) : `${s.street || ""} & ${s.cross_st || ""}`.trim(),
        latitude: geom.coordinates[1],
        longitude: geom.coordinates[0],
        routes: s.routesstpg ? String(s.routesstpg).split(",").map((r: string) => r.trim()) : [],
        ada_accessible: null,
      };
    });
}
```

- [ ] **Step 4: Wire CTA into the GET handler**

In the GET handler, after the NYC stops are fetched and upserted, add the Chicago block. Follow the same pattern — deduplicate by stop_id, upsert with `metro: "chicago"`:

```typescript
// ── Chicago CTA ──────────────────────────────────────────────────────
try {
  const [lStops, busStops] = await Promise.all([
    fetchCTALStops(),
    fetchCTABusStops(),
  ]);

  const allCTA = [...lStops, ...busStops];
  const ctaRows = allCTA.map((s) => ({
    stop_id: s.stop_id,
    name: s.name,
    type: s.type,
    latitude: s.latitude,
    longitude: s.longitude,
    routes: s.routes,
    ada_accessible: s.ada_accessible,
    metro: "chicago",
  }));

  if (ctaRows.length > 0) {
    for (let i = 0; i < ctaRows.length; i += BATCH_SIZE) {
      const batch = ctaRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("transit_stops")
        .upsert(batch, { onConflict: "stop_id" });
      if (error) console.error("CTA upsert error:", error.message);
    }
  }

  results.push({ source: "CTA L", count: lStops.length });
  results.push({ source: "CTA Bus", count: busStops.length });
} catch (err) {
  results.push({ source: "CTA", count: 0, error: String(err) });
}
```

- [ ] **Step 5: Test the transit sync locally**

Run:
```bash
curl "http://localhost:3000/api/cron/sync-transit" | jq
```

Expected: Response includes CTA L (~300) and CTA Bus entries.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/sync-transit/route.ts
git commit -m "feat(sync): add CTA L and bus stops to sync-transit"
```

---

### Task 3: Rodent Complaints Table and Sync

Chicago's rodent complaint data is a high-value differentiator — one of the city's most-searched datasets. We filter rodent-related 311 requests into a dedicated table for fast building-page queries.

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_chicago_rodent_complaints.sql`
- Modify: `src/app/api/cron/sync/route.ts`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260413100000_chicago_rodent_complaints.sql`:

```sql
-- Chicago Rodent Complaints (filtered from 311 data)
CREATE TABLE IF NOT EXISTS chicago_rodent_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES buildings(id),
  sr_number text NOT NULL,
  service_type text,
  status text,
  created_date date,
  closed_date date,
  address text,
  zip_code text,
  ward integer,
  community_area text,
  latitude double precision,
  longitude double precision,
  imported_at timestamptz DEFAULT now(),
  metro text NOT NULL DEFAULT 'chicago',
  UNIQUE(sr_number)
);

CREATE INDEX idx_chi_rodent_building ON chicago_rodent_complaints(building_id) WHERE building_id IS NOT NULL;
CREATE INDEX idx_chi_rodent_date ON chicago_rodent_complaints(created_date DESC);
CREATE INDEX idx_chi_rodent_address ON chicago_rodent_complaints(address);

ALTER TABLE chicago_rodent_complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read chicago_rodent_complaints" ON chicago_rodent_complaints FOR SELECT USING (true);
```

- [ ] **Step 2: Apply the migration**

Run:
```bash
npx supabase db push
```

Or apply via the Supabase MCP `apply_migration` tool.

- [ ] **Step 3: Add the sync function to route.ts**

In `src/app/api/cron/sync/route.ts`, add after `syncChicagoLead` (~line 3705):

```typescript
/**
 * Sync Chicago Rodent Complaints.
 * Uses the legacy rodent-specific dataset: 97t6-zrhs
 * Stores in chicago_rodent_complaints table
 */
async function syncChicagoRodents(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "chicago_rodents");
  const logId = await createSyncLog(supabase, "chicago_rodents");
  const syncStartMs = Date.now();

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildChicagoSodaUrl(
        "97t6-zrhs",
        `creation_date > '${lastSync}'`,
        PAGE_SIZE,
        offset,
        "creation_date ASC"
      );

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        errors.push(`Chicago Rodent API error (offset ${offset}): ${res.status}`);
        break;
      }

      const records = await res.json();
      if (!records || records.length === 0) { hasMore = false; break; }

      const rows = records
        .filter((r: Record<string, unknown>) => r.service_request_number)
        .map((r: Record<string, unknown>) => ({
          sr_number: `CHI-RODENT-${r.service_request_number}`,
          service_type: r.type_of_service_request ? String(r.type_of_service_request) : "Rodent Baiting/Rat Complaint",
          status: r.status ? String(r.status) : null,
          created_date: r.creation_date ? String(r.creation_date).slice(0, 10) : null,
          closed_date: null,
          address: r.street_address ? String(r.street_address) : null,
          zip_code: r.zip_code ? String(r.zip_code) : null,
          ward: r.ward ? parseInt(String(r.ward), 10) : null,
          community_area: r.community_area ? String(r.community_area) : null,
          latitude: r.latitude ? parseFloat(String(r.latitude)) : null,
          longitude: r.longitude ? parseFloat(String(r.longitude)) : null,
          metro: "chicago",
          imported_at: new Date().toISOString(),
        }));

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "chicago_rodent_complaints", rows, "sr_number", errors, "Chicago Rodents", true);
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES || isTimeBudgetExceeded(syncStartMs)) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
      }
    }

    errors.push(`Chicago Rodents: linking deferred to dedicated link cron (${totalAdded} rows synced)`);
    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`Chicago Rodents fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}
```

- [ ] **Step 4: Register the sync function in the SYNC_FUNCTIONS map**

Find the `SYNC_FUNCTIONS` map (around line 4542) and add:

```typescript
"chicago-rodents": syncChicagoRodents,
```

- [ ] **Step 5: Add rodent table to Chicago address linking**

Find the `chicagoAddrTables` array (around line 4865) and add:

```typescript
{ name: "chicago-rodents", table: "chicago_rodent_complaints", idColumn: "id", addressColumns: ["address"], label: "Chicago Rodents" },
```

- [ ] **Step 6: Test the sync locally**

Run:
```bash
curl "http://localhost:3000/api/cron/sync?source=chicago-rodents" | jq
```

Expected: Response shows `totalAdded > 0`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260413100000_chicago_rodent_complaints.sql src/app/api/cron/sync/route.ts
git commit -m "feat(sync): add Chicago rodent complaints sync with dedicated table"
```

---

### Task 4: Problem Landlord Sync (Upgrade Scofflaw Backfill to Cron)

The scofflaw backfill script (`scripts/backfill-chicago-scofflaws.mjs`) currently runs manually. Convert it to a cron sync function so the problem landlord list stays current.

**Files:**
- Modify: `src/app/api/cron/sync/route.ts`

- [ ] **Step 1: Add the sync function to route.ts**

Add after `syncChicagoRodents`:

```typescript
/**
 * Sync Chicago Problem Landlord / Scofflaw List.
 * Chicago Open Data endpoint: crg5-4zyp (Building Code Scofflaw List)
 * Stores in chicago_scofflaws table.
 * Small dataset (~659 records) — full refresh each run.
 */
async function syncChicagoScofflaws(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
  const logId = await createSyncLog(supabase, "chicago_scofflaws");

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    // Full refresh — dataset is small enough to fetch entirely
    const url = buildChicagoSodaUrl(
      "crg5-4zyp",
      "1=1",
      5000,
      0,
      ":id"
    );

    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      errors.push(`Chicago Scofflaws API error: ${res.status}`);
      await finalizeSyncLog(supabase, logId, "failed", 0, 0, errors);
      return { totalAdded: 0, totalLinked: 0, errors, affectedBuildingIds };
    }

    const records = await res.json();

    const rows = records
      .filter((r: Record<string, unknown>) => r.defendant_owner || r.address)
      .map((r: Record<string, unknown>) => ({
        respondent_name: r.defendant_owner ? String(r.defendant_owner).trim().slice(0, 255) : "Unknown",
        address: r.address ? String(r.address).trim().toUpperCase().replace(/\s+/g, " ") : null,
        last_violation_date: r.building_list_date ? String(r.building_list_date).slice(0, 10) : null,
        ward: r.ward ? parseInt(String(r.ward), 10) : null,
        community_area: r.community_area ? String(r.community_area).trim() : null,
        status: "scofflaw",
        latitude: r.latitude ? parseFloat(String(r.latitude)) : null,
        longitude: r.longitude ? parseFloat(String(r.longitude)) : null,
        metro: "chicago",
        imported_at: new Date().toISOString(),
      }));

    if (rows.length > 0) {
      totalAdded += await batchUpsert(supabase, "chicago_scofflaws", rows, "respondent_name,address", errors, "Chicago Scofflaws", true);
    }

    // Link to buildings and mark as scofflaw
    const { data: unlinked } = await supabase
      .from("chicago_scofflaws")
      .select("id, address")
      .is("building_id", null)
      .not("address", "is", null)
      .limit(1000);

    if (unlinked) {
      for (const row of unlinked) {
        const normalized = String(row.address).trim().toUpperCase().replace(/\s+/g, " ");
        const { data: building } = await supabase
          .from("buildings")
          .select("id")
          .eq("metro", "chicago")
          .ilike("full_address", `${normalized}%`)
          .limit(1)
          .single();

        if (building) {
          await supabase.from("chicago_scofflaws").update({ building_id: building.id }).eq("id", row.id);
          await supabase.from("buildings").update({ is_scofflaw: true }).eq("id", building.id);
          totalLinked++;
          affectedBuildingIds.add(building.id);
        }
      }
    }

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`Chicago Scofflaws fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}
```

- [ ] **Step 2: Register in SYNC_FUNCTIONS**

```typescript
"chicago-scofflaws": syncChicagoScofflaws,
```

- [ ] **Step 3: Test the sync**

Run:
```bash
curl "http://localhost:3000/api/cron/sync?source=chicago-scofflaws" | jq
```

Expected: ~659 records synced and some linked to buildings.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/sync/route.ts
git commit -m "feat(sync): upgrade Chicago scofflaw backfill to automated cron sync"
```

---

### Task 5: Demolitions Sync (Extract from Permits)

The `chicago_demolitions` table exists but has no automated sync. Demolition permits are a subset of building permits — filter permits with `permit_type` containing "WRECKING" or `work_description` containing "DEMOLITION".

**Files:**
- Modify: `src/app/api/cron/sync/route.ts`

- [ ] **Step 1: Add demolition extraction logic to syncChicagoPermits**

In the `syncChicagoPermits` function (around line 3528), after the main permit upsert loop, add demolition extraction:

```typescript
    // Extract demolition permits into chicago_demolitions
    const demoRows = records
      .filter((r: Record<string, unknown>) => {
        const pType = String(r.permit_type || "").toUpperCase();
        const desc = String(r.work_description || "").toUpperCase();
        return pType.includes("WRECKING") || desc.includes("DEMOLITION") || desc.includes("WRECK");
      })
      .map((r: Record<string, unknown>) => {
        const streetParts = [r.street_direction, r.street_name].filter(Boolean).map(String).join(" ").trim();
        const addr = r.street_number ? `${r.street_number} ${streetParts}` : streetParts;
        return {
          permit_number: r.permit_ ? String(r.permit_) : `CHI-DEMO-${r.id}`,
          address: addr || null,
          issue_date: r.issue_date ? String(r.issue_date).slice(0, 10) : null,
          status: "ISSUED",
          work_description: r.work_description ? String(r.work_description).slice(0, 500) : null,
          contractor: r.contact_1_name ? String(r.contact_1_name) : null,
          ward: null,
          community_area: null,
          latitude: r.latitude ? parseFloat(String(r.latitude)) : null,
          longitude: r.longitude ? parseFloat(String(r.longitude)) : null,
          metro: "chicago",
          imported_at: new Date().toISOString(),
        };
      });

    if (demoRows.length > 0) {
      await batchUpsert(supabase, "chicago_demolitions", demoRows, "permit_number", errors, "Chicago Demolitions", true);
      errors.push(`Chicago Permits: extracted ${demoRows.length} demolition permits`);
    }
```

Place this code inside the `while (hasMore)` loop, after the main permit upsert, using the same `records` variable from that iteration.

- [ ] **Step 2: Add demolition table to Chicago address linking**

In the `chicagoAddrTables` array, add if not already present:

```typescript
{ name: "chicago-demolitions", table: "chicago_demolitions", idColumn: "id", addressColumns: ["address"], label: "Chicago Demolitions" },
```

- [ ] **Step 3: Test by running the permits sync**

```bash
curl "http://localhost:3000/api/cron/sync?source=chicago-permits" | jq
```

Expected: Logs mention "extracted N demolition permits".

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/sync/route.ts
git commit -m "feat(sync): extract demolition permits into chicago_demolitions during permit sync"
```

---

### Task 6: Enhanced ChicagoInfoCard with All Data Sources

Upgrade the ChicagoInfoCard to show energy benchmarking, rodent complaints, scofflaw details, and RLTO violations — making it as rich as NYC's building page.

**Files:**
- Modify: `src/components/building/ChicagoInfoCard.tsx`
- Modify: `src/app/[city]/building/[borough]/[slug]/page.tsx`

- [ ] **Step 1: Update the ChicagoInfoCard props and UI**

Rewrite `src/components/building/ChicagoInfoCard.tsx`:

```tsx
"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import {
  ShieldCheck, AlertTriangle, MapPin, Building2, Hammer,
  FlaskConical, Bug, Zap, Gavel,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface ChicagoInfoCardProps {
  isRltoProtected?: boolean;
  isScofflaw?: boolean;
  ward?: string | number | null;
  communityArea?: string | number | null;
  demolitions?: { id: string; permit_number: string; issue_date: string; status: string; work_description: string; contractor: string }[];
  leadInspections?: { id: string; inspection_date: string; result: string; risk_level: string; hazard_type: string }[];
  affordableUnits?: unknown[];
  rodentComplaints?: { id: string; created_date: string; status: string; service_type: string }[];
  rltoViolations?: { id: string; case_number: string; violation_date: string; violation_description: string; status: string }[];
  energyRating?: number | null;
  energyYear?: number | null;
  siteEui?: number | null;
}

export function ChicagoInfoCard({
  isRltoProtected,
  isScofflaw,
  ward,
  communityArea,
  demolitions = [],
  leadInspections = [],
  rodentComplaints = [],
  rltoViolations = [],
  energyRating,
  energyYear,
  siteEui,
}: ChicagoInfoCardProps) {
  const hasData =
    isRltoProtected || isScofflaw || ward || communityArea ||
    demolitions.length > 0 || leadInspections.length > 0 ||
    rodentComplaints.length > 0 || rltoViolations.length > 0 ||
    energyRating != null;
  if (!hasData) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[#6366F1]" />
          <h3 className="text-lg font-semibold text-[#1A1F36]">Chicago Info</h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {ward && (
            <div className="flex items-center gap-2 text-sm text-[#5E6687]">
              <MapPin className="w-4 h-4" />
              <span>Ward {ward}</span>
              {communityArea && <span>· {communityArea}</span>}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {isRltoProtected && (
              <Badge variant="success">
                <ShieldCheck className="w-3 h-3 mr-1" />
                RLTO Protected
              </Badge>
            )}
            {isScofflaw && (
              <Badge variant="danger">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Scofflaw Building
              </Badge>
            )}
          </div>

          {energyRating != null && (
            <div className="flex items-center gap-2 text-sm text-[#5E6687]">
              <Zap className="w-4 h-4" />
              <span>
                Chicago Energy Rating: <strong>{energyRating}/4</strong>
                {energyYear && <span className="text-xs ml-1">({energyYear})</span>}
                {siteEui != null && <span className="text-xs ml-1">· Site EUI: {siteEui.toFixed(1)}</span>}
              </span>
            </div>
          )}

          {rltoViolations.length > 0 && (
            <div className="text-sm text-[#5E6687]">
              <div className="flex items-center gap-1 font-medium mb-1">
                <Gavel className="w-4 h-4" />
                {rltoViolations.length} RLTO Violation{rltoViolations.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}

          {rodentComplaints.length > 0 && (
            <div className="text-sm text-[#5E6687]">
              <div className="flex items-center gap-1 font-medium mb-1">
                <Bug className="w-4 h-4" />
                {rodentComplaints.length} Rodent Complaint{rodentComplaints.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}

          {demolitions.length > 0 && (
            <div className="text-sm text-[#5E6687]">
              <div className="flex items-center gap-1 font-medium mb-1">
                <Hammer className="w-4 h-4" />
                {demolitions.length} Demolition Permit{demolitions.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}

          {leadInspections.length > 0 && (
            <div className="text-sm text-[#5E6687]">
              <div className="flex items-center gap-1 font-medium mb-1">
                <FlaskConical className="w-4 h-4" />
                {leadInspections.length} Lead Inspection{leadInspections.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Add new data queries to the building page**

In `src/app/[city]/building/[borough]/[slug]/page.tsx`, find the Chicago-specific queries section (around line 322-324). Add queries for the new data:

```typescript
// Existing queries (keep these):
isChicago ? safe(supabase.from("chicago_demolitions").select("id, permit_number, issue_date, status, work_description, contractor").eq("building_id", buildingId).order("issue_date", { ascending: false }).limit(5), []) : Promise.resolve([]),
isChicago ? safe(supabase.from("chicago_lead_inspections").select("id, inspection_date, result, risk_level, hazard_type").eq("building_id", buildingId).order("inspection_date", { ascending: false }).limit(10), []) : Promise.resolve([]),
isChicago ? safe(supabase.from("chicago_affordable_units").select("id, project_name, affordable_units, total_units, income_requirement, status").eq("building_id", buildingId).limit(5), []) : Promise.resolve([]),

// NEW queries:
isChicago ? safe(supabase.from("chicago_rodent_complaints").select("id, created_date, status, service_type").eq("building_id", buildingId).order("created_date", { ascending: false }).limit(20), []) : Promise.resolve([]),
isChicago ? safe(supabase.from("chicago_rlto_violations").select("id, case_number, violation_date, violation_description, status").eq("building_id", buildingId).order("violation_date", { ascending: false }).limit(10), []) : Promise.resolve([]),
isChicago ? safe(supabase.from("energy_benchmarks").select("energy_star_score, report_year, site_eui").eq("building_id", buildingId).order("report_year", { ascending: false }).limit(1), []) : Promise.resolve([]),
```

- [ ] **Step 3: Destructure the new query results and pass to ChicagoInfoCard**

Update the `Promise.all` destructuring to include the new results. Then pass them to `<ChicagoInfoCard>`:

```tsx
<ChicagoInfoCard
  isRltoProtected={building.is_rlto_protected}
  isScofflaw={building.is_scofflaw}
  ward={building.ward}
  communityArea={building.community_area}
  demolitions={chicagoDemolitions}
  leadInspections={chicagoLeadInspections}
  rodentComplaints={chicagoRodentComplaints}
  rltoViolations={chicagoRltoViolations}
  energyRating={chicagoEnergy?.[0]?.energy_star_score}
  energyYear={chicagoEnergy?.[0]?.report_year}
  siteEui={chicagoEnergy?.[0]?.site_eui}
/>
```

- [ ] **Step 4: Verify the building page renders correctly**

Start the dev server and navigate to a Chicago building page. Verify all new sections appear when data is available.

```bash
npm run dev
# Open a Chicago building page in the browser
```

- [ ] **Step 5: Commit**

```bash
git add src/components/building/ChicagoInfoCard.tsx src/app/[city]/building/[borough]/[slug]/page.tsx
git commit -m "feat(building): enhance ChicagoInfoCard with energy, rodent, RLTO data"
```

---

### Task 7: Add Rodent Complaint Count to Building Stats

Add a `rodent_complaint_count` field to the buildings table and update refresh-stats to compute it.

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_building_rodent_count.sql`
- Modify: `src/app/api/cron/refresh-stats/route.ts`

- [ ] **Step 1: Create migration**

Create `supabase/migrations/20260413110000_building_rodent_count.sql`:

```sql
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS rodent_complaint_count integer DEFAULT 0;
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

- [ ] **Step 3: Read refresh-stats route fully**

Read `src/app/api/cron/refresh-stats/route.ts` to understand how it computes aggregate counts per building.

- [ ] **Step 4: Add rodent count refresh for Chicago**

In the refresh-stats route, within the Chicago metro section, add:

```typescript
// Rodent complaint count
const { error: rodentErr } = await supabase.rpc("refresh_building_stat", {
  p_metro: "chicago",
  p_table: "chicago_rodent_complaints",
  p_column: "rodent_complaint_count",
});
if (rodentErr) errors.push(`chicago rodent count: ${rodentErr.message}`);
```

If the route uses raw SQL instead of RPCs, add the equivalent:

```sql
UPDATE buildings b
SET rodent_complaint_count = COALESCE(sub.cnt, 0)
FROM (
  SELECT building_id, COUNT(*) as cnt
  FROM chicago_rodent_complaints
  WHERE building_id IS NOT NULL
  GROUP BY building_id
) sub
WHERE b.id = sub.building_id AND b.metro = 'chicago';
```

- [ ] **Step 5: Test refresh-stats**

```bash
curl "http://localhost:3000/api/cron/refresh-stats" | jq
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260413110000_building_rodent_count.sql src/app/api/cron/refresh-stats/route.ts
git commit -m "feat(stats): add rodent_complaint_count to building stats refresh"
```

---

### Task 8: Cron Schedule for All Chicago Syncs

Ensure all Chicago sync sources are registered and scheduled. Currently syncs run via launchd on the Mac Mini.

**Files:**
- Depends on your launchd/cron configuration

- [ ] **Step 1: Verify all Chicago sync sources are registered**

Check the `SYNC_FUNCTIONS` map in `src/app/api/cron/sync/route.ts` includes all Chicago sources:

```typescript
"chicago-violations": syncChicagoViolations,    // existing
"chicago-311": syncChicago311,                   // existing
"chicago-crimes": syncChicagoCrimes,             // existing
"chicago-permits": syncChicagoPermits,           // existing (now extracts demolitions too)
"chicago-rlto": syncChicagoRLTO,                 // existing
"chicago-lead": syncChicagoLead,                 // existing (disabled)
"chicago-rodents": syncChicagoRodents,           // NEW (Task 3)
"chicago-scofflaws": syncChicagoScofflaws,       // NEW (Task 4)
```

- [ ] **Step 2: Test each sync source end-to-end**

Run each one and verify it completes without errors:

```bash
# Core syncs (already working — verify still work)
curl "http://localhost:3000/api/cron/sync?source=chicago-violations" | jq '.totalAdded'
curl "http://localhost:3000/api/cron/sync?source=chicago-311" | jq '.totalAdded'
curl "http://localhost:3000/api/cron/sync?source=chicago-crimes" | jq '.totalAdded'
curl "http://localhost:3000/api/cron/sync?source=chicago-permits" | jq '.totalAdded'
curl "http://localhost:3000/api/cron/sync?source=chicago-rlto" | jq '.totalAdded'

# New syncs
curl "http://localhost:3000/api/cron/sync?source=chicago-rodents" | jq '.totalAdded'
curl "http://localhost:3000/api/cron/sync?source=chicago-scofflaws" | jq '.totalAdded'

# Linking pass
curl "http://localhost:3000/api/cron/sync?mode=link&source=chicago" | jq

# Transit + Energy (standalone routes)
curl "http://localhost:3000/api/cron/sync-transit" | jq
curl "http://localhost:3000/api/cron/sync-energy" | jq

# Stats refresh
curl "http://localhost:3000/api/cron/refresh-stats" | jq
```

- [ ] **Step 3: Update launchd schedule if needed**

Add the new sync sources to the launchd plist or cron schedule. Recommended frequency:

| Source | Frequency | Notes |
|---|---|---|
| chicago-violations | Every 6 hours | Moderate volume |
| chicago-311 | Every 6 hours | High volume (~5K/day) |
| chicago-crimes | Every 6 hours | High volume |
| chicago-permits | Daily | Low-moderate volume |
| chicago-rlto | Daily | Low volume |
| chicago-rodents | Daily | Moderate volume |
| chicago-scofflaws | Weekly | Very small dataset (~659) |
| sync-transit (CTA) | Weekly | Static dataset |
| sync-energy (Chicago) | Monthly | Annual reports |
| mode=link&source=chicago | Daily (15:30 UTC) | Already scheduled |
| refresh-stats | Daily | Already scheduled |

- [ ] **Step 4: Commit any schedule changes**

```bash
git add -A
git commit -m "chore: register and schedule all Chicago sync sources"
```

---

### Task 9: Rent Data Verification and Supplementation

Verify Dewey and Zillow rent data coverage for Chicago. If gaps exist, add Chicago-specific sources.

**Files:**
- May modify: `src/app/api/cron/sync/route.ts` or scraping scripts

- [ ] **Step 1: Check current Chicago rent data coverage**

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = {};
fs.readFileSync('.env.local','utf8').split('\n').forEach(l => {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if(m) env[m[1].trim()] = m[2].trim().replace(/^\"|\"$/g,'');
});
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { count: deweyBuilding } = await s.from('dewey_building_rents').select('id', { count: 'exact', head: true }).eq('metro', 'chicago');
  const { count: deweyNeighborhood } = await s.from('dewey_neighborhood_rents').select('id', { count: 'exact', head: true }).eq('metro', 'chicago');
  const { count: buildingRents } = await s.from('building_rents').select('id', { count: 'exact', head: true }).eq('metro', 'chicago');
  const { count: zillow } = await s.from('zillow_rents').select('id', { count: 'exact', head: true }).eq('metro', 'chicago');
  const { count: unitListings } = await s.from('unit_listings').select('id', { count: 'exact', head: true }).eq('metro', 'chicago');
  console.log('Dewey building rents:', deweyBuilding);
  console.log('Dewey neighborhood rents:', deweyNeighborhood);
  console.log('Building rents (scraped):', buildingRents);
  console.log('Zillow rents:', zillow);
  console.log('Unit listings:', unitListings);
})();
"
```

- [ ] **Step 2: If Zillow data is present, verify it covers Chicago neighborhoods**

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = {};
fs.readFileSync('.env.local','utf8').split('\n').forEach(l => {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if(m) env[m[1].trim()] = m[2].trim().replace(/^\"|\"$/g,'');
});
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data } = await s.from('buildings').select('borough').eq('metro', 'chicago').not('borough', 'is', null).limit(1000);
  const neighborhoods = [...new Set(data?.map(b => b.borough))];
  console.log('Chicago neighborhoods in buildings:', neighborhoods.length, neighborhoods.slice(0, 10));
})();
"
```

- [ ] **Step 3: Run Zillow scraper for Chicago buildings if coverage is low**

If the building_rents count is low for Chicago:

```bash
python3 scripts/scrape-rents.py --source=zillow --limit=50
```

Note: StreetEasy is NYC-only. Zillow covers Chicago nationally. If Zillow coverage is poor, consider adding Apartments.com or Rent.com scraping support to the scrape-rents script for Chicago.

- [ ] **Step 4: Document findings and commit any changes**

```bash
git add -A
git commit -m "chore: verify and supplement Chicago rent data coverage"
```

---

### Task 10: Building Count and Data Quality Audit

Final audit: verify Chicago building count, data linkage rates, and building page completeness.

**Files:**
- No code changes expected (audit only)

- [ ] **Step 1: Run a comprehensive Chicago data audit**

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = {};
fs.readFileSync('.env.local','utf8').split('\n').forEach(l => {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if(m) env[m[1].trim()] = m[2].trim().replace(/^\"|\"$/g,'');
});
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  // Building count
  const { count: totalBuildings } = await s.from('buildings').select('id', { count: 'exact', head: true }).eq('metro', 'chicago');

  // Violations linked
  const { count: violationsTotal } = await s.from('dob_violations').select('id', { count: 'exact', head: true }).eq('metro', 'chicago');
  const { count: violationsLinked } = await s.from('dob_violations').select('id', { count: 'exact', head: true }).eq('metro', 'chicago').not('building_id', 'is', null);

  // 311 linked
  const { count: c311Total } = await s.from('complaints_311').select('id', { count: 'exact', head: true }).eq('metro', 'chicago');
  const { count: c311Linked } = await s.from('complaints_311').select('id', { count: 'exact', head: true }).eq('metro', 'chicago').not('building_id', 'is', null);

  // Crimes
  const { count: crimesTotal } = await s.from('nypd_complaints').select('id', { count: 'exact', head: true }).eq('metro', 'chicago');

  // Permits linked
  const { count: permitsTotal } = await s.from('dob_permits').select('id', { count: 'exact', head: true }).eq('metro', 'chicago');
  const { count: permitsLinked } = await s.from('dob_permits').select('id', { count: 'exact', head: true }).eq('metro', 'chicago').not('building_id', 'is', null);

  // Chicago-specific
  const { count: rlto } = await s.from('chicago_rlto_violations').select('id', { count: 'exact', head: true });
  const { count: scofflaws } = await s.from('chicago_scofflaws').select('id', { count: 'exact', head: true });
  const { count: demos } = await s.from('chicago_demolitions').select('id', { count: 'exact', head: true });
  const { count: rodents } = await s.from('chicago_rodent_complaints').select('id', { count: 'exact', head: true });
  const { count: energy } = await s.from('energy_benchmarks').select('id', { count: 'exact', head: true }).eq('metro', 'chicago');
  const { count: transit } = await s.from('transit_stops').select('id', { count: 'exact', head: true }).eq('metro', 'chicago');

  console.log('=== Chicago Data Parity Audit ===');
  console.log('Buildings:', totalBuildings);
  console.log('');
  console.log('Violations:', violationsTotal, '| Linked:', violationsLinked, '| Rate:', ((violationsLinked/violationsTotal)*100).toFixed(1) + '%');
  console.log('311 Complaints:', c311Total, '| Linked:', c311Linked, '| Rate:', ((c311Linked/c311Total)*100).toFixed(1) + '%');
  console.log('Crimes:', crimesTotal);
  console.log('Permits:', permitsTotal, '| Linked:', permitsLinked, '| Rate:', ((permitsLinked/permitsTotal)*100).toFixed(1) + '%');
  console.log('');
  console.log('RLTO Violations:', rlto);
  console.log('Scofflaws:', scofflaws);
  console.log('Demolitions:', demos);
  console.log('Rodent Complaints:', rodents);
  console.log('Energy Benchmarks:', energy);
  console.log('Transit Stops:', transit);
})();
"
```

- [ ] **Step 2: Compare with NYC data for parity check**

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = {};
fs.readFileSync('.env.local','utf8').split('\n').forEach(l => {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if(m) env[m[1].trim()] = m[2].trim().replace(/^\"|\"$/g,'');
});
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const metros = ['nyc', 'chicago'];
  for (const metro of metros) {
    const { count: buildings } = await s.from('buildings').select('id', { count: 'exact', head: true }).eq('metro', metro);
    const { count: violations } = await s.from('dob_violations').select('id', { count: 'exact', head: true }).eq('metro', metro);
    const { count: complaints } = await s.from('complaints_311').select('id', { count: 'exact', head: true }).eq('metro', metro);
    const { count: crimes } = await s.from('nypd_complaints').select('id', { count: 'exact', head: true }).eq('metro', metro);
    const { count: permits } = await s.from('dob_permits').select('id', { count: 'exact', head: true }).eq('metro', metro);
    const { count: energy } = await s.from('energy_benchmarks').select('id', { count: 'exact', head: true }).eq('metro', metro);
    const { count: transit } = await s.from('transit_stops').select('id', { count: 'exact', head: true }).eq('metro', metro);
    console.log('\\n=== ' + metro.toUpperCase() + ' ===');
    console.log('Buildings:', buildings);
    console.log('Violations:', violations);
    console.log('311 Complaints:', complaints);
    console.log('Crimes:', crimes);
    console.log('Permits:', permits);
    console.log('Energy:', energy);
    console.log('Transit:', transit);
  }
})();
"
```

- [ ] **Step 3: Identify and document remaining gaps**

After the audit, document any remaining gaps in a comment or issue. Common gaps to watch for:

- Low building count (Chicago should have 50K+ residential buildings)
- Low linking rate (<50% means address normalization needs tuning)
- Missing rent data (Dewey may not cover Chicago yet)
- Eviction data unavailable (Cook County has no public API — document as known gap)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "docs: Chicago data parity audit results"
```

---

## Data Sources NOT Available for Chicago (Known Gaps)

These are NYC features that have no Chicago equivalent or no public data source:

| NYC Feature | Chicago Status | Notes |
|---|---|---|
| Eviction records | **No public API** | Cook County requires FOIA; Eviction Lab has aggregate data only |
| Bed bug reports | **No equivalent** | Chicago does not require bed bug disclosure |
| Rent stabilization | **Not applicable** | Chicago has RLTO (general tenant protection) instead of unit-level stabilization |
| Sidewalk sheds | **Not applicable** | Different permit system, not tracked separately |
| Encampments | **No public dataset** | Chicago does not publish encampment data |
| HPD-style housing violations | **Covered by Building Code Violations** | Different agency, same concept |

These gaps are structural — they reflect differences in city regulations and data transparency, not missing implementation work.
