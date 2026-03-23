#!/usr/bin/env node

/**
 * Sync NYC ZAP Land Use Projects from NYC Open Data (Socrata)
 * Source: https://data.cityofnewyork.us/resource/hgx4-8ukb.json
 *
 * Usage:
 *   node scripts/sync-nyc-zap.mjs
 *   node scripts/sync-nyc-zap.mjs --limit=500
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
const SOURCE = "nyc_zap";

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
  Filed: "introduced",
  "Pre-Cert": "introduced",
  "In Public Review": "active",
  Certified: "active",
  Approved: "passed",
  Completed: "completed",
  Disapproved: "failed",
  Withdrawn: "withdrawn",
};

function normalizeStatus(publicStatus, milestone) {
  if (milestone && STATUS_MAP[milestone]) return STATUS_MAP[milestone];
  return STATUS_MAP[publicStatus] || "active";
}

const BOROUGH_MAP = { MN: "Manhattan", BK: "Brooklyn", QN: "Queens", BX: "Bronx", SI: "Staten Island" };

function normalizeBorough(raw) {
  if (!raw) return null;
  return BOROUGH_MAP[raw] || BOROUGH_MAP[raw.toUpperCase()] || raw;
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
  console.log(`\n=== Syncing NYC ZAP Land Use ===`);
  console.log(`Since: ${sinceDate}, Limit: ${LIMIT}\n`);

  let offset = 0;
  let totalFetched = 0;
  let totalUpserted = 0;

  while (totalFetched < LIMIT) {
    const fetchSize = Math.min(PAGE_SIZE, LIMIT - totalFetched);
    const url = `https://data.cityofnewyork.us/resource/hgx4-8ukb.json?$where=app_filed_date>'${sinceDate}'&$limit=${fetchSize}&$offset=${offset}&$order=app_filed_date DESC`;

    console.log(`Fetching ZAP projects ${offset}-${offset + fetchSize}...`);
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

    const rows = records.map((r) => {
      const title = r.project_name || "Untitled Project";
      const brief = r.project_brief || "";
      return {
        metro: "nyc",
        source: SOURCE,
        external_id: r.project_id,
        title,
        type: "land_use",
        status: normalizeStatus(r.public_status, r.current_milestone),
        category: categorize(title + " " + brief),
        borough: normalizeBorough(r.borough),
        council_district: r.cc_district ? parseInt(r.cc_district) : null,
        neighborhood: r.community_district || null,
        sponsor: r.primary_applicant || null,
        intro_date: r.app_filed_date ? r.app_filed_date.split("T")[0] : null,
        last_action_date: r.current_milestone_date ? r.current_milestone_date.split("T")[0] : null,
        hearing_date: null,
        source_url: `https://zap.planning.nyc.gov/projects/${r.project_id}`,
        latitude: null,
        longitude: null,
        raw_data: r,
        updated_at: new Date().toISOString(),
      };
    }).filter((r) => r.intro_date && r.external_id);

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
    console.log(`  Processed ${records.length} projects (total: ${totalUpserted} upserted)`);

    if (records.length < fetchSize) break;
  }

  console.log(`\nNYC ZAP: ${totalUpserted} upserted\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
