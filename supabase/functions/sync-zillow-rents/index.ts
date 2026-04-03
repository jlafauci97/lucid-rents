import { getSupabaseAdmin } from "shared/supabase-admin.ts";

const ZORI_CSV_URL =
  "https://files.zillowstatic.com/research/public_csvs/zori/Zip_zori_uc_sfrcondomfr_sm_month.csv";

const BATCH_SIZE = 500;

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

/** LA metro identifier in Zillow CSV */
const LA_METRO_PREFIX = "Los Angeles-Long Beach-Anaheim";

interface RentRow {
  zip_code: string;
  borough: string;
  date: string;
  median_rent: number;
  metro: string;
}

/**
 * Parse a single CSV line, handling quoted fields (e.g. "Los Angeles-Long Beach-Anaheim, CA").
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parse the wide-format Zillow CSV into rows for both NYC and LA.
 */
function parseZoriCsv(text: string): RentRow[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const zipIdx = headers.findIndex(
    (h) => h.toLowerCase() === "regionname"
  );
  const metroIdx = headers.findIndex(
    (h) => h.toLowerCase() === "metro"
  );
  const cityIdx = headers.findIndex(
    (h) => h.toLowerCase() === "city"
  );
  if (zipIdx === -1) return [];

  // Date columns start after the metadata columns
  const dateStartIdx = headers.findIndex((h) =>
    /^\d{4}-\d{2}-\d{2}$/.test(h)
  );
  if (dateStartIdx === -1) return [];

  const dateHeaders = headers.slice(dateStartIdx);
  const rows: RentRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const zip = cols[zipIdx];
    if (!zip) continue;

    const metro = metroIdx >= 0 ? cols[metroIdx] : "";
    const city = cityIdx >= 0 ? cols[cityIdx] : "";

    // Determine if NYC or LA
    let borough: string | null = null;
    let metroKey = "";

    const nycBorough = getNycBorough(zip);
    if (nycBorough) {
      borough = nycBorough;
      metroKey = "nyc";
    } else if (metro.startsWith(LA_METRO_PREFIX)) {
      // Use city name as area, uppercase to match building data convention
      borough = city ? city.toUpperCase() : "LOS ANGELES";
      metroKey = "los-angeles";
    }

    if (!borough) continue;

    for (let j = 0; j < dateHeaders.length; j++) {
      const val = cols[dateStartIdx + j];
      if (!val || val === "") continue;
      const rent = parseFloat(val);
      if (isNaN(rent)) continue;

      rows.push({
        zip_code: zip,
        borough,
        date: dateHeaders[j],
        median_rent: Math.round(rent * 100) / 100,
        metro: metroKey,
      });
    }
  }

  return rows;
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("authorization");
  const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabaseAdmin();
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    // 1. Download Zillow ZORI CSV
    const res = await fetch(ZORI_CSV_URL);
    if (!res.ok) {
      return new Response(JSON.stringify({
        ok: false,
        error: `Failed to fetch ZORI CSV: ${res.status}`,
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    const csvText = await res.text();

    // 2. Parse and filter to NYC + LA zips
    const rows = parseZoriCsv(csvText);

    if (rows.length === 0) {
      return new Response(JSON.stringify({
        ok: true,
        message: "No matching zip code data found in ZORI CSV",
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const nycRows = rows.filter((r) => r.metro === "nyc");
    const laRows = rows.filter((r) => r.metro === "los-angeles");

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

    return new Response(JSON.stringify({
      ok: true,
      duration_seconds: parseFloat(elapsed),
      nyc_zips: new Set(nycRows.map((r) => r.zip_code)).size,
      la_zips: new Set(laRows.map((r) => r.zip_code)).size,
      nyc_rows: nycRows.length,
      la_rows: laRows.length,
      rows_upserted: totalUpserted,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
