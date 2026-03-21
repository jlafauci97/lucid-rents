#!/usr/bin/env node

/**
 * Backfill LA buildings from LA County Assessor open data.
 *
 * Fetches residential parcels from the LA County Assessor dataset on
 * data.lacounty.gov, filters to City of Los Angeles, and upserts into
 * the buildings table with metro='los-angeles'.
 *
 * Data source: LA County Assessor Parcels (Socrata)
 * https://data.lacounty.gov/resource/9trm-uz8i.json
 *
 * Usage:
 *   node scripts/backfill-la-buildings.mjs                  # default 5000
 *   node scripts/backfill-la-buildings.mjs --limit=20000    # bigger batch
 *   node scripts/backfill-la-buildings.mjs --offset=5000    # resume from offset
 *   node scripts/backfill-la-buildings.mjs --zip=90028      # specific zip
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

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v || "true"];
  })
);
const LIMIT = parseInt(args.limit || "5000", 10);
const OFFSET = parseInt(args.offset || "0", 10);
const ZIP_FILTER = args.zip || "";
const BATCH_SIZE = 500;

// LA County Assessor dataset on data.lacounty.gov
const ASSESSOR_BASE = "https://data.lacounty.gov/resource/9trm-uz8i.json";
const APP_TOKEN = env.SOCRATA_APP_TOKEN || "";

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

// Map LA neighborhoods/areas from zip codes
function getNeighborhood(zipCode) {
  const LA_ZIP_NEIGHBORHOODS = {
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
    "90056": "Ladera Heights", "90057": "Westlake", "90058": "Vernon",
    "90059": "Willowbrook", "90061": "South LA", "90062": "South LA",
    "90063": "East LA", "90064": "Rancho Park", "90065": "Glassell Park",
    "90066": "Mar Vista", "90067": "Century City", "90068": "Hollywood Hills",
    "90069": "West Hollywood", "90071": "Downtown",
    "90077": "Bel Air", "90089": "USC",
    "90094": "Playa Vista", "90095": "UCLA",
    "90210": "Beverly Hills", "90212": "Beverly Hills",
    "90230": "Culver City", "90232": "Culver City",
    "90247": "Gardena", "90248": "Gardena",
    "90272": "Pacific Palisades", "90274": "Palos Verdes",
    "90291": "Venice", "90292": "Marina del Rey", "90293": "Playa del Rey",
    "90301": "Inglewood", "90302": "Inglewood",
    "90401": "Santa Monica", "90402": "Santa Monica",
    "90403": "Santa Monica", "90404": "Santa Monica",
    "91301": "Agoura Hills", "91302": "Calabasas",
    "91303": "Canoga Park", "91304": "Canoga Park",
    "91306": "Winnetka", "91307": "West Hills",
    "91311": "Chatsworth", "91316": "Encino",
    "91321": "Newhall", "91324": "Northridge",
    "91325": "Northridge", "91326": "Porter Ranch",
    "91331": "Pacoima", "91335": "Reseda",
    "91340": "San Fernando", "91342": "Sylmar",
    "91343": "North Hills", "91344": "Granada Hills",
    "91345": "Mission Hills", "91352": "Sun Valley",
    "91356": "Tarzana", "91364": "Woodland Hills",
    "91367": "Woodland Hills", "91401": "Van Nuys",
    "91402": "Panorama City", "91403": "Sherman Oaks",
    "91405": "Van Nuys", "91406": "Van Nuys",
    "91411": "Van Nuys", "91423": "Sherman Oaks",
    "91436": "Encino", "91501": "Burbank",
    "91502": "Burbank", "91504": "Burbank",
    "91505": "Burbank", "91601": "North Hollywood",
    "91602": "North Hollywood", "91604": "Studio City",
    "91605": "North Hollywood", "91606": "North Hollywood",
    "91607": "Valley Village",
  };
  return LA_ZIP_NEIGHBORHOODS[zipCode] || "Los Angeles";
}

async function fetchAssessorParcels(offset, limit) {
  const params = new URLSearchParams({
    $limit: String(limit),
    $offset: String(offset),
    $order: "ain",
    $where: `usetype LIKE '%Residential%' AND city = 'LOS ANGELES'`,
    $select: "ain,situshouse,situsdir,situsstreet,situssuf,situsunit,situscity,situszip,usetype,yearbuilt,units,sqftmain,latitude,longitude",
  });

  if (ZIP_FILTER) {
    params.set("$where", `usetype LIKE '%Residential%' AND city = 'LOS ANGELES' AND situszip = '${ZIP_FILTER}'`);
  }

  const url = `${ASSESSOR_BASE}?${params}`;
  const headers = { Accept: "application/json" };
  if (APP_TOKEN) headers["X-App-Token"] = APP_TOKEN;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Assessor API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function buildAddress(parcel) {
  const parts = [
    parcel.situshouse,
    parcel.situsdir,
    parcel.situsstreet,
    parcel.situssuf,
  ].filter(Boolean);
  return parts.join(" ").trim();
}

async function upsertBuildings(parcels) {
  const buildings = parcels
    .filter((p) => p.ain && buildAddress(p))
    .map((p) => {
      const address = buildAddress(p);
      const zip = (p.situszip || "").slice(0, 5);
      const neighborhood = getNeighborhood(zip);
      return {
        apn: p.ain,
        full_address: `${address}, Los Angeles, CA ${zip}`,
        borough: neighborhood,
        zip_code: zip,
        city: "Los Angeles",
        state: "CA",
        metro: "los-angeles",
        slug: generateSlug(`${address}-los-angeles-ca-${zip}`),
        year_built: p.yearbuilt ? parseInt(p.yearbuilt, 10) : null,
        total_units: p.units ? parseInt(p.units, 10) : null,
        latitude: p.latitude ? parseFloat(p.latitude) : null,
        longitude: p.longitude ? parseFloat(p.longitude) : null,
        violation_count: 0,
        complaint_count: 0,
        review_count: 0,
        overall_score: null,
      };
    });

  if (buildings.length === 0) return 0;

  // Upsert in batches
  let inserted = 0;
  for (let i = 0; i < buildings.length; i += BATCH_SIZE) {
    const batch = buildings.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("buildings")
      .upsert(batch, { onConflict: "apn", ignoreDuplicates: true });

    if (error) {
      console.error(`  Batch ${i / BATCH_SIZE + 1} error:`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  return inserted;
}

async function main() {
  console.log(`\n=== LA Building Backfill ===`);
  console.log(`Limit: ${LIMIT}, Offset: ${OFFSET}${ZIP_FILTER ? `, Zip: ${ZIP_FILTER}` : ""}\n`);

  let totalInserted = 0;
  let offset = OFFSET;
  const pageSize = 1000;

  while (totalInserted < LIMIT) {
    const remaining = LIMIT - totalInserted;
    const fetchSize = Math.min(pageSize, remaining);

    console.log(`Fetching parcels ${offset}–${offset + fetchSize}...`);
    const parcels = await fetchAssessorParcels(offset, fetchSize);

    if (!parcels || parcels.length === 0) {
      console.log("No more parcels. Done.");
      break;
    }

    console.log(`  Got ${parcels.length} parcels, upserting...`);
    const inserted = await upsertBuildings(parcels);
    totalInserted += inserted;
    offset += parcels.length;

    console.log(`  Inserted/updated: ${inserted} (total: ${totalInserted})`);

    if (parcels.length < fetchSize) {
      console.log("Last page reached. Done.");
      break;
    }

    await sleep(500); // Rate limit
  }

  console.log(`\n✅ Total buildings upserted: ${totalInserted}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
