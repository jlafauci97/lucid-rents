import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ZORI_CSV_URL =
  "https://files.zillowstatic.com/research/public_csvs/zori/Zip_zori_uc_sfrcondomfr_sm_month.csv";

const BATCH_SIZE = 500;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Map NYC zip codes to boroughs */
const ZIP_BOROUGH: Record<string, string> = {};

// Manhattan (10001-10282)
for (let z = 10001; z <= 10282; z++) ZIP_BOROUGH[String(z)] = "MANHATTAN";
// Bronx (10451-10475, plus 10499)
for (let z = 10451; z <= 10475; z++) ZIP_BOROUGH[String(z)] = "BRONX";
ZIP_BOROUGH["10499"] = "BRONX";
// Staten Island (10301-10314)
for (let z = 10301; z <= 10314; z++) ZIP_BOROUGH[String(z)] = "STATEN ISLAND";
// Brooklyn (11201-11256)
for (let z = 11201; z <= 11256; z++) ZIP_BOROUGH[String(z)] = "BROOKLYN";
// Queens (11001-11109, 11351-11697)
for (let z = 11001; z <= 11109; z++) ZIP_BOROUGH[String(z)] = "QUEENS";
for (let z = 11351; z <= 11697; z++) ZIP_BOROUGH[String(z)] = "QUEENS";

function getNycBorough(zip: string): string | null {
  return ZIP_BOROUGH[zip] || null;
}

/**
 * Parse the wide-format Zillow CSV into rows of (zip_code, borough, date, median_rent).
 */
function parseZoriCsv(
  text: string
): { zip_code: string; borough: string; date: string; median_rent: number }[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",");
  const zipIdx = headers.findIndex(
    (h) => h.trim().toLowerCase() === "regionname"
  );
  if (zipIdx === -1) return [];

  // Date columns start after the metadata columns (first column matching YYYY-MM-DD pattern)
  const dateStartIdx = headers.findIndex((h) =>
    /^\d{4}-\d{2}-\d{2}$/.test(h.trim())
  );
  if (dateStartIdx === -1) return [];

  const dateHeaders = headers.slice(dateStartIdx).map((h) => h.trim());
  const rows: { zip_code: string; borough: string; date: string; median_rent: number }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const zip = cols[zipIdx]?.trim();
    if (!zip) continue;
    const borough = getNycBorough(zip);
    if (!borough) continue;

    for (let j = 0; j < dateHeaders.length; j++) {
      const val = cols[dateStartIdx + j]?.trim();
      if (!val || val === "") continue;
      const rent = parseFloat(val);
      if (isNaN(rent)) continue;

      rows.push({
        zip_code: zip,
        borough,
        date: dateHeaders[j],
        median_rent: Math.round(rent * 100) / 100,
      });
    }
  }

  return rows;
}

export async function GET() {
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    // 1. Download Zillow ZORI CSV
    const res = await fetch(ZORI_CSV_URL);
    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        error: `Failed to fetch ZORI CSV: ${res.status}`,
      });
    }
    const csvText = await res.text();

    // 2. Parse and filter to NYC zips
    const rows = parseZoriCsv(csvText);

    if (rows.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No NYC zip code data found in ZORI CSV",
      });
    }

    // 3. Upsert in batches
    let totalUpserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("zillow_rents")
        .upsert(batch, { onConflict: "zip_code,date", ignoreDuplicates: false });

      if (error) {
        errors.push(`Upsert batch ${i}: ${error.message}`);
      } else {
        totalUpserted += batch.length;
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json({
      ok: true,
      duration_seconds: parseFloat(elapsed),
      nyc_zips_matched: new Set(rows.map((r) => r.zip_code)).size,
      rows_upserted: totalUpserted,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
