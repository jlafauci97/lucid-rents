import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SODA_BASE = "https://data.cityofnewyork.us/resource";
const DATASET = "5zyy-y8am";
const PAGE_SIZE = 5000;
const BATCH_SIZE = 500;

const BOROUGH_MAP: Record<string, string> = {
  MANHATTAN: "Manhattan",
  BRONX: "Bronx",
  BROOKLYN: "Brooklyn",
  QUEENS: "Queens",
  "STATEN ISLAND": "Staten Island",
};

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformRecord(r: any) {
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
  };
}

export async function GET() {
  const startTime = Date.now();

  try {
    // Get last sync time
    const { data: logData } = await supabase
      .from("sync_log")
      .select("completed_at")
      .eq("source", "energy")
      .order("completed_at", { ascending: false })
      .limit(1);

    const lastSync = logData?.[0]?.completed_at;

    // Build filter — multifamily/mixed-use only
    let filter =
      "primary_property_type_self in ('Multifamily Housing','Mixed Use Property') AND property_id IS NOT NULL";

    if (lastSync) {
      // SODA :updated_at meta column for incremental sync
      const syncDate = new Date(lastSync);
      syncDate.setDate(syncDate.getDate() - 7); // 7-day overlap for annual data
      const isoDate = syncDate.toISOString().split("T")[0];
      filter += ` AND :updated_at > '${isoDate}'`;
    }

    let offset = 0;
    let totalUpserted = 0;

    while (true) {
      const params = new URLSearchParams({
        $where: filter,
        $limit: String(PAGE_SIZE),
        $offset: String(offset),
        $order: "report_year ASC, property_id ASC",
      });

      const res = await fetch(`${SODA_BASE}/${DATASET}.json?${params}`);
      if (!res.ok) break;

      const records = await res.json();
      if (records.length === 0) break;

      const allRows = records.map(transformRecord).filter(Boolean);
      // Deduplicate
      const seen = new Map<string, ReturnType<typeof transformRecord>>();
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
          console.error("Energy upsert error:", error.message);
          break;
        }
        totalUpserted += batch.length;
      }

      if (records.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;

      // Timeout guard
      if (Date.now() - startTime > 50000) break;
    }

    // Link to buildings by BBL
    if (totalUpserted > 0) {
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

      // Update buildings.energy_star_score from latest year
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

    // Log sync
    await supabase.from("sync_log").insert({
      source: "energy",
      records_synced: totalUpserted,
      completed_at: new Date().toISOString(),
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    return NextResponse.json({
      ok: true,
      synced: totalUpserted,
      elapsed: `${elapsed}s`,
    });
  } catch (err) {
    console.error("Energy sync error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
