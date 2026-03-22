#!/usr/bin/env node

/**
 * Sync NYC Council Bills from NYC Open Data (Socrata)
 * Source: https://data.cityofnewyork.us/resource/6ctv-n46c.json
 *
 * Usage:
 *   node scripts/sync-nyc-council-bills.mjs
 *   node scripts/sync-nyc-council-bills.mjs --limit=500
 *   node scripts/sync-nyc-council-bills.mjs --since=2025-01-01
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
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v || "true"];
  })
);

const LIMIT = parseInt(args.limit || "5000", 10);
const PAGE_SIZE = 1000;
const BATCH = 200;
const SOURCE = "nyc_council_bills";

const CATEGORY_RULES = [
  { keywords: ["rent", "stabiliz", "rso", "lease", "tenant protection"], category: "rent_regulation" },
  { keywords: ["zone", "rezone", "variance", "special permit", "ulurp"], category: "zoning_change" },
  { keywords: ["tenant", "evict", "harass", "displacement"], category: "tenant_protection" },
  { keywords: ["develop", "construct", "build", "new building"], category: "new_development" },
  { keywords: ["demolish", "demolition", "tear down"], category: "demolition" },
  { keywords: ["afford", "inclusionary", "mih", "section 8"], category: "affordable_housing" },
  { keywords: ["safety", "fire", "seismic", "structural", "elevator"], category: "building_safety" },
];

function categorize(title) {
  const lower = (title || "").toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) return rule.category;
  }
  return "other";
}

const STATUS_MAP = {
  "Filed (Pending Introduction)": "introduced",
  Filed: "introduced",
  Introduced: "introduced",
  Committee: "in_committee",
  "General Orders Calendar": "voted",
  Approved: "passed",
  Enacted: "passed",
  Adopted: "passed",
  Vetoed: "failed",
  Disapproved: "failed",
  Withdrawn: "withdrawn",
};

function normalizeStatus(raw) {
  return STATUS_MAP[raw] || "active";
}

async function getLastSyncDate() {
  if (args.since) return args.since;
  const { data } = await supabase
    .from("proposals")
    .select("updated_at")
    .eq("source", SOURCE)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (data && data.length > 0) {
    const d = new Date(data[0].updated_at);
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  }
  return "2024-01-01";
}

async function main() {
  const sinceDate = await getLastSyncDate();
  console.log(`\n=== Syncing NYC Council Bills ===`);
  console.log(`Since: ${sinceDate}, Limit: ${LIMIT}\n`);

  let offset = 0;
  let totalFetched = 0;
  let totalUpserted = 0;

  while (totalFetched < LIMIT) {
    const fetchSize = Math.min(PAGE_SIZE, LIMIT - totalFetched);
    const url = `https://data.cityofnewyork.us/resource/6ctv-n46c.json?$where=intro_date>'${sinceDate}'&$limit=${fetchSize}&$offset=${offset}&$order=intro_date DESC`;

    console.log(`Fetching bills ${offset}-${offset + fetchSize}...`);
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Socrata API error: ${res.status}`);
      break;
    }

    const records = await res.json();
    if (!records || records.length === 0) {
      console.log("No more records.");
      break;
    }

    const rows = records.map((r) => ({
      metro: "nyc",
      source: SOURCE,
      external_id: r.matter_id || r.file_number,
      title: r.title || r.name || "Untitled",
      type: "legislation",
      status: normalizeStatus(r.status),
      category: categorize(r.title || r.name || ""),
      borough: null,
      council_district: null,
      neighborhood: null,
      sponsor: r.primary_sponsor || null,
      intro_date: r.intro_date ? r.intro_date.split("T")[0] : null,
      last_action_date: r.modified_date ? r.modified_date.split("T")[0] : null,
      hearing_date: r.agenda_date ? r.agenda_date.split("T")[0] : null,
      source_url: `https://legistar.council.nyc.gov/LegislationDetail.aspx?ID=${r.matter_id || ""}&GUID=${r.matter_id || ""}`,
      latitude: null,
      longitude: null,
      raw_data: r,
      updated_at: new Date().toISOString(),
    })).filter((r) => r.intro_date && r.external_id);

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await supabase
        .from("proposals")
        .upsert(batch, { onConflict: "source,external_id" });
      if (error) {
        console.error("  Upsert error:", error.message);
      } else {
        totalUpserted += batch.length;
      }
    }

    totalFetched += records.length;
    offset += records.length;
    console.log(`  Processed ${records.length} bills (total: ${totalUpserted} upserted)`);

    if (records.length < fetchSize) break;
  }

  console.log(`\nNYC Council Bills: ${totalUpserted} upserted\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
