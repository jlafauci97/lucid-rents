#!/usr/bin/env node

/**
 * Backfill LA zip code centroids into the zip_centroids table.
 *
 * Uses hardcoded lat/lon centroids for LA zip codes so that
 * nearby-buildings and map features work for LA.
 *
 * Usage:
 *   node scripts/backfill-la-zip-centroids.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
const envText = fs.readFileSync(envPath, "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "").replace(/\\n/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// LA zip code centroids (approximate lat/lon for each zip)
const LA_CENTROIDS = [
  { zip_code: "90001", avg_lat: 33.9425, avg_lon: -118.2551 },
  { zip_code: "90002", avg_lat: 33.9490, avg_lon: -118.2468 },
  { zip_code: "90003", avg_lat: 33.9640, avg_lon: -118.2730 },
  { zip_code: "90004", avg_lat: 34.0770, avg_lon: -118.3090 },
  { zip_code: "90005", avg_lat: 34.0590, avg_lon: -118.3100 },
  { zip_code: "90006", avg_lat: 34.0490, avg_lon: -118.2940 },
  { zip_code: "90007", avg_lat: 34.0290, avg_lon: -118.2830 },
  { zip_code: "90008", avg_lat: 34.0110, avg_lon: -118.3410 },
  { zip_code: "90010", avg_lat: 34.0600, avg_lon: -118.3020 },
  { zip_code: "90011", avg_lat: 33.9960, avg_lon: -118.2580 },
  { zip_code: "90012", avg_lat: 34.0620, avg_lon: -118.2400 },
  { zip_code: "90013", avg_lat: 34.0440, avg_lon: -118.2430 },
  { zip_code: "90014", avg_lat: 34.0400, avg_lon: -118.2560 },
  { zip_code: "90015", avg_lat: 34.0380, avg_lon: -118.2680 },
  { zip_code: "90016", avg_lat: 34.0280, avg_lon: -118.3530 },
  { zip_code: "90017", avg_lat: 34.0530, avg_lon: -118.2660 },
  { zip_code: "90018", avg_lat: 34.0280, avg_lon: -118.3170 },
  { zip_code: "90019", avg_lat: 34.0470, avg_lon: -118.3350 },
  { zip_code: "90020", avg_lat: 34.0660, avg_lon: -118.3090 },
  { zip_code: "90024", avg_lat: 34.0635, avg_lon: -118.4310 },
  { zip_code: "90025", avg_lat: 34.0430, avg_lon: -118.4390 },
  { zip_code: "90026", avg_lat: 34.0780, avg_lon: -118.2610 },
  { zip_code: "90027", avg_lat: 34.0990, avg_lon: -118.2920 },
  { zip_code: "90028", avg_lat: 34.0980, avg_lon: -118.3270 },
  { zip_code: "90029", avg_lat: 34.0890, avg_lon: -118.2940 },
  { zip_code: "90031", avg_lat: 34.0810, avg_lon: -118.2100 },
  { zip_code: "90032", avg_lat: 34.0800, avg_lon: -118.1820 },
  { zip_code: "90033", avg_lat: 34.0490, avg_lon: -118.2110 },
  { zip_code: "90034", avg_lat: 34.0300, avg_lon: -118.3960 },
  { zip_code: "90035", avg_lat: 34.0540, avg_lon: -118.3780 },
  { zip_code: "90036", avg_lat: 34.0700, avg_lon: -118.3490 },
  { zip_code: "90037", avg_lat: 33.9940, avg_lon: -118.2870 },
  { zip_code: "90038", avg_lat: 34.0880, avg_lon: -118.3300 },
  { zip_code: "90039", avg_lat: 34.1090, avg_lon: -118.2620 },
  { zip_code: "90041", avg_lat: 34.1370, avg_lon: -118.2110 },
  { zip_code: "90042", avg_lat: 34.1140, avg_lon: -118.1920 },
  { zip_code: "90043", avg_lat: 33.9910, avg_lon: -118.3300 },
  { zip_code: "90044", avg_lat: 33.9550, avg_lon: -118.2920 },
  { zip_code: "90045", avg_lat: 33.9580, avg_lon: -118.3900 },
  { zip_code: "90046", avg_lat: 34.1120, avg_lon: -118.3690 },
  { zip_code: "90047", avg_lat: 33.9560, avg_lon: -118.3100 },
  { zip_code: "90048", avg_lat: 34.0730, avg_lon: -118.3680 },
  { zip_code: "90049", avg_lat: 34.0650, avg_lon: -118.4880 },
  { zip_code: "90056", avg_lat: 33.9880, avg_lon: -118.3700 },
  { zip_code: "90057", avg_lat: 34.0600, avg_lon: -118.2780 },
  { zip_code: "90058", avg_lat: 34.0030, avg_lon: -118.2170 },
  { zip_code: "90059", avg_lat: 33.9260, avg_lon: -118.2380 },
  { zip_code: "90061", avg_lat: 33.9220, avg_lon: -118.2740 },
  { zip_code: "90062", avg_lat: 34.0060, avg_lon: -118.3060 },
  { zip_code: "90063", avg_lat: 34.0440, avg_lon: -118.1850 },
  { zip_code: "90064", avg_lat: 34.0360, avg_lon: -118.4290 },
  { zip_code: "90065", avg_lat: 34.1050, avg_lon: -118.2260 },
  { zip_code: "90066", avg_lat: 34.0020, avg_lon: -118.4290 },
  { zip_code: "90067", avg_lat: 34.0570, avg_lon: -118.4140 },
  { zip_code: "90068", avg_lat: 34.1230, avg_lon: -118.3340 },
  { zip_code: "90069", avg_lat: 34.0900, avg_lon: -118.3780 },
  { zip_code: "90071", avg_lat: 34.0530, avg_lon: -118.2540 },
  { zip_code: "90077", avg_lat: 34.0930, avg_lon: -118.4440 },
  { zip_code: "90094", avg_lat: 33.9740, avg_lon: -118.4170 },
  { zip_code: "90210", avg_lat: 34.0901, avg_lon: -118.4065 },
  { zip_code: "90272", avg_lat: 34.0447, avg_lon: -118.5260 },
  { zip_code: "90291", avg_lat: 33.9930, avg_lon: -118.4650 },
  { zip_code: "90292", avg_lat: 33.9780, avg_lon: -118.4510 },
  { zip_code: "90293", avg_lat: 33.9580, avg_lon: -118.4460 },
  { zip_code: "91301", avg_lat: 34.1530, avg_lon: -118.7730 },
  { zip_code: "91302", avg_lat: 34.1570, avg_lon: -118.6790 },
  { zip_code: "91303", avg_lat: 34.2000, avg_lon: -118.6010 },
  { zip_code: "91304", avg_lat: 34.2270, avg_lon: -118.6060 },
  { zip_code: "91306", avg_lat: 34.2060, avg_lon: -118.5630 },
  { zip_code: "91307", avg_lat: 34.2100, avg_lon: -118.6370 },
  { zip_code: "91311", avg_lat: 34.2570, avg_lon: -118.5990 },
  { zip_code: "91316", avg_lat: 34.1590, avg_lon: -118.5010 },
  { zip_code: "91324", avg_lat: 34.2280, avg_lon: -118.5530 },
  { zip_code: "91325", avg_lat: 34.2380, avg_lon: -118.5530 },
  { zip_code: "91326", avg_lat: 34.2810, avg_lon: -118.5630 },
  { zip_code: "91331", avg_lat: 34.2550, avg_lon: -118.4090 },
  { zip_code: "91335", avg_lat: 34.1980, avg_lon: -118.5350 },
  { zip_code: "91340", avg_lat: 34.2820, avg_lon: -118.4370 },
  { zip_code: "91342", avg_lat: 34.3070, avg_lon: -118.4470 },
  { zip_code: "91343", avg_lat: 34.2370, avg_lon: -118.4870 },
  { zip_code: "91344", avg_lat: 34.2810, avg_lon: -118.5100 },
  { zip_code: "91345", avg_lat: 34.2710, avg_lon: -118.4640 },
  { zip_code: "91352", avg_lat: 34.2170, avg_lon: -118.3770 },
  { zip_code: "91356", avg_lat: 34.1720, avg_lon: -118.5440 },
  { zip_code: "91364", avg_lat: 34.1680, avg_lon: -118.6070 },
  { zip_code: "91367", avg_lat: 34.1830, avg_lon: -118.6150 },
  { zip_code: "91401", avg_lat: 34.1820, avg_lon: -118.4490 },
  { zip_code: "91402", avg_lat: 34.2290, avg_lon: -118.4470 },
  { zip_code: "91403", avg_lat: 34.1520, avg_lon: -118.4560 },
  { zip_code: "91405", avg_lat: 34.2000, avg_lon: -118.4500 },
  { zip_code: "91406", avg_lat: 34.1970, avg_lon: -118.4920 },
  { zip_code: "91411", avg_lat: 34.1870, avg_lon: -118.4670 },
  { zip_code: "91423", avg_lat: 34.1500, avg_lon: -118.4340 },
  { zip_code: "91436", avg_lat: 34.1560, avg_lon: -118.4870 },
  { zip_code: "91501", avg_lat: 34.1870, avg_lon: -118.3070 },
  { zip_code: "91502", avg_lat: 34.1830, avg_lon: -118.3170 },
  { zip_code: "91504", avg_lat: 34.2020, avg_lon: -118.3100 },
  { zip_code: "91505", avg_lat: 34.1910, avg_lon: -118.3380 },
  { zip_code: "91601", avg_lat: 34.1680, avg_lon: -118.3780 },
  { zip_code: "91602", avg_lat: 34.1500, avg_lon: -118.3670 },
  { zip_code: "91604", avg_lat: 34.1420, avg_lon: -118.3960 },
  { zip_code: "91605", avg_lat: 34.2090, avg_lon: -118.4030 },
  { zip_code: "91606", avg_lat: 34.1870, avg_lon: -118.3900 },
  { zip_code: "91607", avg_lat: 34.1640, avg_lon: -118.3990 },
];

async function main() {
  console.log(`\n=== LA Zip Centroids Backfill ===`);
  console.log(`Loading ${LA_CENTROIDS.length} zip centroids...\n`);

  const rows = LA_CENTROIDS.map((c) => ({
    zip_code: c.zip_code,
    avg_lat: c.avg_lat,
    avg_lon: c.avg_lon,
    metro: "los-angeles",
  }));

  const { error } = await supabase
    .from("zip_centroids")
    .upsert(rows, { onConflict: "zip_code", ignoreDuplicates: false });

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  console.log(`✅ Upserted ${rows.length} LA zip centroids`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
