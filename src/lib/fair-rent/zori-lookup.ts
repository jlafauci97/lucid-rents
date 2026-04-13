import { readFile } from "fs/promises";
import path from "path";

interface ZoriRow {
  zip_code: string;
  monthly_values: { date: string; value: number }[];
}

let cache: ZoriRow[] | null = null;

/** Simple CSV parser — no external dependency needed for ZORI's flat structure */
function parseSimpleCsv(raw: string): Record<string, string>[] {
  const lines = raw.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.replace(/^"|"$/g, "").trim());
    const record: Record<string, string> = {};
    headers.forEach((h, i) => { record[h] = values[i] || ""; });
    return record;
  });
}

async function loadZori(): Promise<ZoriRow[]> {
  if (cache) return cache;

  const csvPath = path.join(process.cwd(), "public", "data", "zori-nyc.csv");
  const raw = await readFile(csvPath, "utf-8");
  const records = parseSimpleCsv(raw);

  cache = records.map((row) => {
    const zip_code = row["RegionName"];
    const monthly_values: { date: string; value: number }[] = [];

    for (const [key, val] of Object.entries(row)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key) && val) {
        monthly_values.push({ date: key, value: parseFloat(val) });
      }
    }

    monthly_values.sort((a, b) => a.date.localeCompare(b.date));
    return { zip_code, monthly_values };
  });

  return cache;
}

export interface ZoriLookupResult {
  current: number | null;
  avg_12mo: number | null;
}

export async function lookupZori(zipCode: string): Promise<ZoriLookupResult> {
  const rows = await loadZori();
  const row = rows.find((r) => r.zip_code === zipCode);

  if (!row || row.monthly_values.length === 0) {
    const allLatest = rows
      .map((r) => r.monthly_values[r.monthly_values.length - 1]?.value)
      .filter((v): v is number => v != null && !isNaN(v));

    if (allLatest.length === 0) return { current: null, avg_12mo: null };

    const metroAvg = allLatest.reduce((a, b) => a + b, 0) / allLatest.length;
    return { current: metroAvg, avg_12mo: metroAvg };
  }

  const vals = row.monthly_values;
  const current = vals[vals.length - 1]?.value ?? null;
  const last12 = vals.slice(-12).map((v) => v.value);
  const avg_12mo =
    last12.length > 0
      ? last12.reduce((a, b) => a + b, 0) / last12.length
      : null;

  return { current, avg_12mo };
}
