import { getSupabaseAdmin } from "shared/supabase-admin.ts";

const PAGE_SIZE = 5000;
const BATCH_SIZE = 500;

/* ---------------------------------------------------------------------------
 * NYC LL84 config
 * -------------------------------------------------------------------------*/

const NYC_SODA_BASE = "https://data.cityofnewyork.us/resource";
const NYC_DATASET = "5zyy-y8am";

const BOROUGH_MAP: Record<string, string> = {
  MANHATTAN: "Manhattan",
  BRONX: "Bronx",
  BROOKLYN: "Brooklyn",
  QUEENS: "Queens",
  "STATEN ISLAND": "Staten Island",
};

/* ---------------------------------------------------------------------------
 * LA EBEWE config
 * -------------------------------------------------------------------------*/

const LA_SODA_BASE = "https://data.lacity.org/resource";
const LA_DATASET = "9yda-i4ya";

/* ---------------------------------------------------------------------------
 * Shared helpers
 * -------------------------------------------------------------------------*/

function parseNum(val: string | null | undefined): number | null {
  if (val == null || val === "" || val === "Not Available" || val === "N/A") return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function parseInt2(val: string | null | undefined): number | null {
  if (val == null || val === "" || val === "Not Available" || val === "N/A") return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function normalizeBbl(bbl: string | null | undefined): string | null {
  if (!bbl) return null;
  const cleaned = bbl.replace(/[-\s]/g, "");
  return /^\d{10}$/.test(cleaned) ? cleaned : null;
}

function normalizeApn(apn: string | null | undefined): string | null {
  if (!apn) return null;
  const cleaned = apn.replace(/[-\s]/g, "");
  return cleaned.length >= 7 ? cleaned : null;
}

/* ---------------------------------------------------------------------------
 * NYC transform
 * -------------------------------------------------------------------------*/

// deno-lint-ignore no-explicit-any
function transformNycRecord(r: any) {
  if (!r.property_id) return null;
  const reportYear = parseInt2(r.report_year);
  if (!reportYear) return null;

  const borough = r.borough
    ? BOROUGH_MAP[r.borough.toUpperCase()] || r.borough
    : null;

  return {
    property_id: String(r.property_id),
    property_name: r.property_name || null,
    property_type: r.primary_property_type_self || null,
    report_year: reportYear,
    bbl: normalizeBbl(r.nyc_borough_block_and_lot),
    address: r.address_1 || null,
    borough,
    zip_code: r.postal_code || null,
    energy_star_score: parseInt2(r.energy_star_score),
    site_eui: parseNum(r.site_eui_kbtu_ft),
    weather_normalized_eui: parseNum(r.weather_normalized_site_eui),
    total_ghg_emissions: parseNum(r.total_location_based_ghg),
    electricity_use: parseNum(r.electricity_use_grid_purchase),
    natural_gas_use: parseNum(r.natural_gas_use_kbtu),
    water_use: parseNum(r.water_use_all_water_sources),
    year_built: parseInt2(r.year_built),
    number_of_buildings: parseInt2(r.number_of_buildings),
    property_gfa: parseNum(r.property_gfa_self_reported),
    metro: "nyc",
  };
}

/* ---------------------------------------------------------------------------
 * LA transform
 * -------------------------------------------------------------------------*/

// deno-lint-ignore no-explicit-any
function transformLaRecord(r: any) {
  if (!r.building_id) return null;

  // program_year is like "2020-2021" -- use the second year as report_year
  let reportYear: number | null = null;
  if (r.program_year) {
    const parts = String(r.program_year).split("-");
    reportYear = parseInt2(parts[parts.length - 1]);
  }
  if (!reportYear) return null;

  return {
    property_id: String(r.building_id),
    property_name: r.organization || null,
    property_type: r.primary_property_1 || null,
    report_year: reportYear,
    bbl: null,
    apn: normalizeApn(r.apn),
    address: r.building_address || null,
    borough: null, // LA doesn't have boroughs in this dataset
    zip_code: r.postal_code || null,
    energy_star_score: parseInt2(r.energy_star_score),
    site_eui: parseNum(r.site_eui),
    weather_normalized_eui: parseNum(r.weather_normalized_3),
    total_ghg_emissions: parseNum(r.total_ghg_emissions),
    electricity_use: null,
    natural_gas_use: null,
    water_use: parseNum(r.water_use),
    year_built: parseInt2(r.year_built),
    number_of_buildings: parseInt2(r.number_of_buildings),
    property_gfa: parseNum(r.property_gfa_1),
    metro: "los-angeles",
  };
}

/* ---------------------------------------------------------------------------
 * Generic SODA sync function
 * -------------------------------------------------------------------------*/

async function syncSodaDataset(opts: {
  sodaBase: string;
  dataset: string;
  filter: string;
  // deno-lint-ignore no-explicit-any
  transform: (r: any) => ReturnType<typeof transformNycRecord>;
  sourceKey: string;
  startTime: number;
  lastSync: string | null;
  dateFilterField?: string;
  supabase: ReturnType<typeof getSupabaseAdmin>;
}): Promise<number> {
  const { sodaBase, dataset, transform, sourceKey, startTime, lastSync, dateFilterField, supabase } = opts;
  let filter = opts.filter;

  if (lastSync && dateFilterField) {
    const syncDate = new Date(lastSync);
    syncDate.setDate(syncDate.getDate() - 7);
    const isoDate = syncDate.toISOString().split("T")[0];
    filter += ` AND ${dateFilterField} > '${isoDate}'`;
  }

  let offset = 0;
  let totalUpserted = 0;

  while (true) {
    const params = new URLSearchParams({
      $where: filter,
      $limit: String(PAGE_SIZE),
      $offset: String(offset),
      $order: "property_id ASC",
    });

    // LA dataset uses building_id rather than property_id for ordering
    if (sourceKey === "energy-la") {
      params.set("$order", "building_id ASC");
    }

    const res = await fetch(`${sodaBase}/${dataset}.json?${params}`);
    if (!res.ok) {
      console.error(`${sourceKey} SODA fetch error: ${res.status}`);
      break;
    }

    const records = await res.json();
    if (records.length === 0) break;

    const allRows = records.map(transform).filter(Boolean);
    // Deduplicate
    const seen = new Map<string, ReturnType<typeof transform>>();
    for (const row of allRows) {
      if (row) seen.set(`${row.property_id}_${row.report_year}`, row);
    }
    const rows = [...seen.values()];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("energy_benchmarks")
        .upsert(batch, {
          onConflict: "property_id,report_year",
          ignoreDuplicates: false,
        });
      if (error) {
        console.error(`${sourceKey} upsert error:`, error.message);
        break;
      }
      totalUpserted += batch.length;
    }

    if (records.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;

    // Timeout guard -- leave time for linking step
    const MAX_SYNC_MS = 120000;
    if (Date.now() - startTime > MAX_SYNC_MS) break;
  }

  return totalUpserted;
}

/* ---------------------------------------------------------------------------
 * Link + update helpers
 * -------------------------------------------------------------------------*/

async function linkBuildingsByBbl(supabase: ReturnType<typeof getSupabaseAdmin>) {
  await supabase.rpc("exec_sql", {
    query: `
      UPDATE energy_benchmarks e
      SET building_id = b.id
      FROM buildings b
      WHERE e.bbl = b.bbl
        AND e.bbl IS NOT NULL
        AND e.building_id IS NULL
    `,
  });
}

async function linkBuildingsByApn(supabase: ReturnType<typeof getSupabaseAdmin>) {
  await supabase.rpc("exec_sql", {
    query: `
      UPDATE energy_benchmarks e
      SET building_id = b.id
      FROM buildings b
      WHERE e.apn = b.apn
        AND e.apn IS NOT NULL
        AND e.building_id IS NULL
    `,
  });
}

async function updateBuildingScores(supabase: ReturnType<typeof getSupabaseAdmin>) {
  await supabase.rpc("exec_sql", {
    query: `
      UPDATE buildings b
      SET energy_star_score = sub.energy_star_score
      FROM (
        SELECT DISTINCT ON (building_id)
          building_id, energy_star_score
        FROM energy_benchmarks
        WHERE building_id IS NOT NULL AND energy_star_score IS NOT NULL
        ORDER BY building_id, report_year DESC
      ) sub
      WHERE b.id = sub.building_id
    `,
  });
}

/* ---------------------------------------------------------------------------
 * Assign borough/area to LA energy records from linked buildings
 * -------------------------------------------------------------------------*/

async function backfillLaBoroughs(supabase: ReturnType<typeof getSupabaseAdmin>) {
  await supabase.rpc("exec_sql", {
    query: `
      UPDATE energy_benchmarks e
      SET borough = b.borough
      FROM buildings b
      WHERE e.building_id = b.id
        AND e.metro = 'los-angeles'
        AND e.borough IS NULL
        AND b.borough IS NOT NULL
    `,
  });
}

/* ---------------------------------------------------------------------------
 * Handler
 * -------------------------------------------------------------------------*/

Deno.serve(async (req) => {
  const authHeader = req.headers.get("authorization");
  const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const startTime = Date.now();
  const supabase = getSupabaseAdmin();

  try {
    // Get last sync times
    const { data: nycLog } = await supabase
      .from("sync_log")
      .select("completed_at")
      .eq("source", "energy")
      .order("completed_at", { ascending: false })
      .limit(1);

    const { data: laLog } = await supabase
      .from("sync_log")
      .select("completed_at")
      .eq("source", "energy-la")
      .order("completed_at", { ascending: false })
      .limit(1);

    const nycLastSync = nycLog?.[0]?.completed_at || null;
    const laLastSync = laLog?.[0]?.completed_at || null;

    // --- NYC sync ---
    const nycUpserted = await syncSodaDataset({
      sodaBase: NYC_SODA_BASE,
      dataset: NYC_DATASET,
      filter:
        "primary_property_type_self in ('Multifamily Housing','Mixed Use Property') AND property_id IS NOT NULL",
      transform: transformNycRecord,
      sourceKey: "energy",
      startTime,
      lastSync: nycLastSync,
      dateFilterField: ":updated_at",
      supabase,
    });

    // --- LA sync ---
    const laUpserted = await syncSodaDataset({
      sodaBase: LA_SODA_BASE,
      dataset: LA_DATASET,
      filter: "building_id IS NOT NULL",
      transform: transformLaRecord,
      sourceKey: "energy-la",
      startTime,
      lastSync: laLastSync,
      supabase,
    });

    // Link + update
    const totalUpserted = nycUpserted + laUpserted;
    if (totalUpserted > 0) {
      if (nycUpserted > 0) await linkBuildingsByBbl(supabase);
      if (laUpserted > 0) {
        await linkBuildingsByApn(supabase);
        await backfillLaBoroughs(supabase);
      }
      await updateBuildingScores(supabase);
    }

    // Log syncs
    const now = new Date().toISOString();
    if (nycUpserted > 0) {
      await supabase.from("sync_log").insert({
        source: "energy",
        records_synced: nycUpserted,
        completed_at: now,
      });
    }
    if (laUpserted > 0) {
      await supabase.from("sync_log").insert({
        source: "energy-la",
        records_synced: laUpserted,
        completed_at: now,
      });
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    return new Response(JSON.stringify({
      ok: true,
      nyc_synced: nycUpserted,
      la_synced: laUpserted,
      elapsed: `${elapsed}s`,
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Energy sync error:", err);
    return new Response(JSON.stringify(
      { ok: false, error: String(err) }
    ), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
