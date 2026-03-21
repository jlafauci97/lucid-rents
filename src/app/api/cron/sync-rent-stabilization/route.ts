import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Supabase admin client (service role -- bypasses RLS)
// ---------------------------------------------------------------------------
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const BATCH_SIZE = 500;

// ---------------------------------------------------------------------------
// CSV Sources
// ---------------------------------------------------------------------------
// rentstab_summary: 2007-2017 data with unitsstab2007, unitsstab2017, diff
const SUMMARY_URL = "https://taxbillsnyc.s3.amazonaws.com/changes-summary.csv";
// rentstab_v2: 2018-2024 data with uc2018..uc2024 columns
const V2_URL = "https://s3.amazonaws.com/justfix-data/rentstab_counts_from_doffer_2024.csv";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || "";
    }
    rows.push(row);
  }
  return rows;
}

function safeInt(val: string | undefined): number | null {
  if (!val || val === "" || val === "NA") return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

async function batchUpsert(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  rows: Record<string, unknown>[],
  errors: string[]
): Promise<number> {
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error, count } = await supabase
      .from("rent_stabilization")
      .upsert(batch, { onConflict: "bbl,year", ignoreDuplicates: false, count: "exact" });
    if (error) {
      errors.push(`Upsert error (batch ${i}): ${error.message}`);
    } else {
      total += count ?? batch.length;
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Parse summary CSV (2007-2017) — extract 2007 and 2017 year rows per BBL
// ---------------------------------------------------------------------------
function parseSummaryRows(csvRows: Record<string, string>[]): Record<string, unknown>[] {
  const dbRows: Record<string, unknown>[] = [];
  const now = new Date().toISOString();

  for (const row of csvRows) {
    const bbl = row.ucbbl;
    if (!bbl || bbl.length < 10) continue;

    const unitstotal = safeInt(row.unitstotal);
    const stab2007 = safeInt(row.unitsstab2007);
    const stab2017 = safeInt(row.unitsstab2017);
    const diff = safeInt(row.diff);

    if (stab2007 != null) {
      dbRows.push({
        bbl,
        year: 2007,
        units_stabilized: stab2007,
        units_total: unitstotal,
        est_units_stabilized: null,
        diff_units_stabilized: null,
        metro: "nyc",
        raw_data: row,
        imported_at: now,
      });
    }

    if (stab2017 != null) {
      dbRows.push({
        bbl,
        year: 2017,
        units_stabilized: stab2017,
        units_total: unitstotal,
        est_units_stabilized: null,
        diff_units_stabilized: diff,
        metro: "nyc",
        raw_data: row,
        imported_at: now,
      });
    }
  }

  return dbRows;
}

// ---------------------------------------------------------------------------
// Parse v2 CSV (2018-2023) — one row per BBL with uc2018..uc2023 columns
// ---------------------------------------------------------------------------
function parseV2Rows(csvRows: Record<string, string>[]): Record<string, unknown>[] {
  const dbRows: Record<string, unknown>[] = [];
  const now = new Date().toISOString();
  const years = [2018, 2019, 2020, 2021, 2022, 2023, 2024];

  for (const row of csvRows) {
    const bbl = row.ucbbl;
    if (!bbl || bbl.length < 10) continue;

    for (const year of years) {
      const stab = safeInt(row[`uc${year}`]);
      if (stab == null) continue;

      dbRows.push({
        bbl,
        year,
        units_stabilized: stab,
        units_total: null,
        est_units_stabilized: null,
        diff_units_stabilized: null,
        metro: "nyc",
        raw_data: { ucbbl: bbl, year, [`uc${year}`]: row[`uc${year}`] },
        imported_at: now,
      });
    }
  }

  return dbRows;
}

// ---------------------------------------------------------------------------
// Link rent_stabilization records to buildings by BBL
// ---------------------------------------------------------------------------
async function linkToBuildings(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  errors: string[]
): Promise<number> {
  let linked = 0;

  // Get unlinked records
  const { data: unlinked } = await supabase
    .from("rent_stabilization")
    .select("id, bbl")
    .is("building_id", null)
    .limit(100000);

  if (!unlinked || unlinked.length === 0) return 0;

  const bblSet = [...new Set(unlinked.map((r) => r.bbl).filter(Boolean))] as string[];

  // Look up buildings by BBL in batches
  const bblToBuilding = new Map<string, string>();
  for (let i = 0; i < bblSet.length; i += 500) {
    const batch = bblSet.slice(i, i + 500);
    const { data: buildings } = await supabase
      .from("buildings")
      .select("id, bbl")
      .in("bbl", batch);

    if (buildings) {
      for (const b of buildings) {
        if (b.bbl) bblToBuilding.set(b.bbl, b.id);
      }
    }
  }

  if (bblToBuilding.size === 0) return 0;

  // Group records by building ID
  const buildingToRecordIds = new Map<string, string[]>();
  for (const record of unlinked) {
    const buildingId = record.bbl ? bblToBuilding.get(record.bbl) : undefined;
    if (buildingId) {
      if (!buildingToRecordIds.has(buildingId)) {
        buildingToRecordIds.set(buildingId, []);
      }
      buildingToRecordIds.get(buildingId)!.push(record.id);
    }
  }

  // Update in batches
  for (const [buildingId, recordIds] of buildingToRecordIds) {
    for (let i = 0; i < recordIds.length; i += 500) {
      const batch = recordIds.slice(i, i + 500);
      const { error } = await supabase
        .from("rent_stabilization")
        .update({ building_id: buildingId })
        .in("id", batch);
      if (error) {
        errors.push(`Link error (building ${buildingId}): ${error.message}`);
      } else {
        linked += batch.length;
      }
    }
  }

  return linked;
}

// ---------------------------------------------------------------------------
// Denormalize: update buildings with latest rent stabilization data
// ---------------------------------------------------------------------------
async function denormalizeToBuildings(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  errors: string[]
): Promise<number> {
  let updated = 0;

  // Fetch all linked records in one query, sorted by year desc so the first
  // occurrence per building_id is the latest year.
  const { data: allRecords } = await supabase
    .from("rent_stabilization")
    .select("building_id, year, units_stabilized")
    .not("building_id", "is", null)
    .not("units_stabilized", "is", null)
    .order("year", { ascending: false })
    .limit(200000);

  if (!allRecords || allRecords.length === 0) return 0;

  // Group by building_id, keep only the latest year (first seen due to sort)
  const latestByBuilding = new Map<string, { units_stabilized: number; year: number }>();
  for (const r of allRecords) {
    if (!r.building_id || latestByBuilding.has(r.building_id)) continue;
    latestByBuilding.set(r.building_id, {
      units_stabilized: r.units_stabilized,
      year: r.year,
    });
  }

  // Batch update buildings with 20 concurrent requests to avoid overwhelming Supabase
  const entries = Array.from(latestByBuilding.entries());
  const CONCURRENT = 20;

  for (let i = 0; i < entries.length; i += CONCURRENT) {
    const batch = entries.slice(i, i + CONCURRENT);
    const results = await Promise.all(
      batch.map(([buildingId, data]) => {
        const isStabilized = (data.units_stabilized ?? 0) > 0;
        return supabase
          .from("buildings")
          .update({
            is_rent_stabilized: isStabilized,
            stabilized_units: data.units_stabilized,
            stabilized_year: data.year,
          })
          .eq("id", buildingId)
          .then(({ error }) => ({ buildingId, error }));
      })
    );

    for (const { buildingId, error } of results) {
      if (error) {
        errors.push(`Denormalize error (${buildingId}): ${error.message}`);
      } else {
        updated++;
      }
    }
  }

  return updated;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const startTime = Date.now();
  const errors: string[] = [];

  try {
    const supabase = getSupabaseAdmin();

    // Create sync log
    const { data: logData } = await supabase
      .from("sync_log")
      .insert({ sync_type: "rent_stabilization", status: "running" })
      .select("id")
      .single();
    const logId = logData?.id;

    let totalAdded = 0;

    // Fetch and parse summary CSV (2007-2017)
    try {
      const summaryRes = await fetch(SUMMARY_URL);
      if (summaryRes.ok) {
        const summaryText = await summaryRes.text();
        const summaryParsed = parseCSV(summaryText);
        const summaryRows = parseSummaryRows(summaryParsed);
        if (summaryRows.length > 0) {
          totalAdded += await batchUpsert(supabase, summaryRows, errors);
        }
      } else {
        errors.push(`Summary CSV fetch error: ${summaryRes.status}`);
      }
    } catch (err) {
      errors.push(`Summary CSV error: ${String(err)}`);
    }

    // Fetch and parse v2 CSV (2018-2023)
    try {
      const v2Res = await fetch(V2_URL);
      if (v2Res.ok) {
        const v2Text = await v2Res.text();
        const v2Parsed = parseCSV(v2Text);
        const v2Rows = parseV2Rows(v2Parsed);
        if (v2Rows.length > 0) {
          totalAdded += await batchUpsert(supabase, v2Rows, errors);
        }
      } else {
        errors.push(`V2 CSV fetch error: ${v2Res.status}`);
      }
    } catch (err) {
      errors.push(`V2 CSV error: ${String(err)}`);
    }

    // Link to buildings by BBL
    const linked = await linkToBuildings(supabase, errors);

    // Denormalize to buildings table
    const denormalized = await denormalizeToBuildings(supabase, errors);

    // Finalize sync log
    if (logId) {
      await supabase
        .from("sync_log")
        .update({
          status: errors.length > 0 && totalAdded === 0 ? "failed" : "completed",
          completed_at: new Date().toISOString(),
          records_added: totalAdded,
          records_linked: linked,
          errors: errors.length > 0 ? errors : null,
        })
        .eq("id", logId);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json({
      success: true,
      duration_seconds: parseFloat(elapsed),
      records_upserted: totalAdded,
      records_linked: linked,
      buildings_denormalized: denormalized,
      errors,
    });
  } catch (err) {
    console.error("Rent stabilization sync error:", err);
    return NextResponse.json(
      { success: false, error: String(err), errors },
      { status: 500 }
    );
  }
}
