#!/usr/bin/env node

/**
 * Backfill additional LA buildings from MyLA311 service requests.
 *
 * Extracts unique addresses from 311 data that don't already exist
 * in the buildings table. This dramatically expands LA building coverage
 * beyond just enforcement cases.
 *
 * Usage:
 *   node scripts/backfill-la-buildings-311.mjs
 *   node scripts/backfill-la-buildings-311.mjs --limit=50000
 *   node scripts/backfill-la-buildings-311.mjs --dataset=b7dx-7gc3  # 2024 data
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

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v || "true"];
  })
);
const LIMIT = parseInt(args.limit || "500000", 10);
const DATASET = args.dataset || "h73f-gn57"; // 2025 by default
const BATCH_SIZE = 500;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function generateSlug(fullAddress) {
  return fullAddress
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getNeighborhood(zipCode) {
  const map = {
    "90001": "Florence", "90002": "Watts", "90003": "South LA",
    "90004": "Los Feliz", "90005": "Koreatown", "90006": "Westlake",
    "90007": "South LA", "90008": "Baldwin Hills", "90010": "Mid-Wilshire",
    "90011": "South LA", "90012": "Downtown", "90013": "Downtown",
    "90014": "Downtown", "90015": "Downtown", "90016": "West Adams",
    "90017": "Downtown", "90018": "Jefferson Park", "90019": "Mid-City",
    "90020": "Koreatown", "90024": "Westwood", "90025": "West LA",
    "90026": "Echo Park", "90027": "Los Feliz", "90028": "Hollywood",
    "90029": "East Hollywood", "90031": "Lincoln Heights",
    "90032": "El Sereno", "90033": "Boyle Heights", "90034": "Palms",
    "90035": "Mid-Wilshire", "90036": "Fairfax", "90037": "South LA",
    "90038": "Hollywood", "90039": "Silver Lake", "90041": "Eagle Rock",
    "90042": "Highland Park", "90043": "View Park", "90044": "South LA",
    "90045": "Westchester", "90046": "Hollywood Hills",
    "90047": "South LA", "90048": "Fairfax", "90049": "Brentwood",
    "90056": "Ladera Heights", "90057": "Westlake",
    "90059": "Willowbrook", "90061": "South LA", "90062": "South LA",
    "90063": "East LA", "90064": "Rancho Park", "90065": "Glassell Park",
    "90066": "Mar Vista", "90067": "Century City", "90068": "Hollywood Hills",
    "90069": "West Hollywood", "90071": "Downtown",
    "90077": "Bel Air", "90094": "Playa Vista",
    "90272": "Pacific Palisades", "90291": "Venice",
    "90292": "Marina del Rey", "90293": "Playa del Rey",
    "91303": "Canoga Park", "91304": "Canoga Park",
    "91306": "Winnetka", "91307": "West Hills",
    "91311": "Chatsworth", "91316": "Encino",
    "91324": "Northridge", "91325": "Northridge",
    "91326": "Porter Ranch", "91331": "Pacoima",
    "91335": "Reseda", "91340": "San Fernando",
    "91342": "Sylmar", "91343": "North Hills",
    "91344": "Granada Hills", "91345": "Mission Hills",
    "91352": "Sun Valley", "91356": "Tarzana",
    "91364": "Woodland Hills", "91367": "Woodland Hills",
    "91401": "Van Nuys", "91402": "Panorama City",
    "91403": "Sherman Oaks", "91405": "Van Nuys",
    "91406": "Van Nuys", "91423": "Sherman Oaks",
    "91436": "Encino", "91601": "North Hollywood",
    "91602": "North Hollywood", "91604": "Studio City",
    "91605": "North Hollywood", "91606": "North Hollywood",
    "91607": "Valley Village",
  };
  return map[zipCode] || "Los Angeles";
}

async function main() {
  console.log(`\n=== LA Building Backfill from MyLA311 (dataset: ${DATASET}) ===\n`);

  // Step 1: Get existing LA building slugs to skip duplicates
  console.log("Loading existing LA building slugs...");
  const existingSlugs = new Set();
  let lastId = null;
  while (true) {
    let q = supabase
      .from("buildings")
      .select("id, slug")
      .eq("metro", "los-angeles")
      .order("id", { ascending: true })
      .limit(10000);
    if (lastId) q = q.gt("id", lastId);
    const { data } = await q;
    if (!data || data.length === 0) break;
    for (const b of data) existingSlugs.add(b.slug);
    lastId = data[data.length - 1].id;
    if (data.length < 10000) break;
  }
  console.log(`  Found ${existingSlugs.size} existing LA buildings\n`);

  // Step 2: Fetch 311 records and extract unique addresses
  const addressMap = new Map();
  let offset = 0;
  const pageSize = 5000;
  let totalFetched = 0;

  while (totalFetched < LIMIT) {
    const fetchSize = Math.min(pageSize, LIMIT - totalFetched);
    const url = `https://data.lacity.org/resource/${DATASET}.json?$limit=${fetchSize}&$offset=${offset}&$order=srnumber&$select=address,zipcode,latitude,longitude`;

    console.log(`Fetching 311 records ${offset}–${offset + fetchSize}...`);
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`API error: ${res.status}`);
      break;
    }

    const records = await res.json();
    if (!records || records.length === 0) break;

    for (const r of records) {
      const address = (r.address || "").trim();
      if (!address || address.length < 5) continue;

      const zip = (r.zipcode || "").trim().slice(0, 5);
      if (!zip || zip.length !== 5 || !zip.startsWith("9")) continue;

      const key = `${address.toUpperCase()}|${zip}`;
      if (addressMap.has(key)) continue;

      const slug = generateSlug(`${address}-los-angeles-ca-${zip}`);
      if (existingSlugs.has(slug)) continue;

      const neighborhood = getNeighborhood(zip);
      const houseNum = address.match(/^(\d+)/)?.[1] || "";
      const streetName = address.replace(/^\d+\s*/, "").trim() || "UNKNOWN";

      addressMap.set(key, {
        full_address: `${address}, Los Angeles, CA ${zip}`,
        house_number: houseNum,
        street_name: streetName,
        borough: neighborhood,
        zip_code: zip,
        city: "Los Angeles",
        state: "CA",
        metro: "los-angeles",
        slug,
        latitude: r.latitude ? parseFloat(r.latitude) : null,
        longitude: r.longitude ? parseFloat(r.longitude) : null,
        violation_count: 0,
        complaint_count: 0,
        review_count: 0,
        overall_score: null,
      });
    }

    totalFetched += records.length;
    offset += records.length;
    console.log(`  New unique addresses: ${addressMap.size}`);

    if (records.length < fetchSize) break;
    await sleep(300);
  }

  console.log(`\n${addressMap.size} new buildings to insert. Inserting...`);

  const buildings = Array.from(addressMap.values());
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < buildings.length; i += BATCH_SIZE) {
    const batch = buildings.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("buildings").insert(batch);

    if (error) {
      errors++;
      if (errors <= 3) console.error(`  Batch error:`, error.message);
    } else {
      inserted += batch.length;
    }

    if (i % (BATCH_SIZE * 20) === 0 && i > 0) {
      console.log(`  Progress: ${inserted}/${buildings.length}`);
    }
  }

  console.log(`\n✅ Inserted ${inserted} new LA buildings (${errors} batch errors)`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
