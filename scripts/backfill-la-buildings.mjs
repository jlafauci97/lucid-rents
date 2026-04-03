#!/usr/bin/env node

/**
 * Backfill LA buildings from LADBS Code Enforcement data.
 *
 * Fetches unique building addresses from the LADBS Code Enforcement dataset
 * on data.lacity.org, deduplicates by address+zip, and upserts into the
 * buildings table with metro='los-angeles'.
 *
 * Data source: LADBS Code Enforcement Cases (u82d-eh7z)
 * https://data.lacity.org/resource/u82d-eh7z.json
 *
 * Usage:
 *   node scripts/backfill-la-buildings.mjs                  # default 5000
 *   node scripts/backfill-la-buildings.mjs --limit=20000    # bigger batch
 *   node scripts/backfill-la-buildings.mjs --offset=5000    # resume
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
const LIMIT = parseInt(args.limit || "30000", 10);
const OFFSET = parseInt(args.offset || "0", 10);
const BATCH_SIZE = 500;

// LADBS Code Enforcement dataset
const ENDPOINT = "https://data.lacity.org/resource/u82d-eh7z.json";

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

// Map LA neighborhoods from zip codes
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
    "91301": "Agoura Hills", "91302": "Calabasas",
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
    "91406": "Van Nuys", "91411": "Van Nuys",
    "91423": "Sherman Oaks", "91436": "Encino",
    "91501": "Burbank", "91601": "North Hollywood",
    "91602": "North Hollywood", "91604": "Studio City",
    "91605": "North Hollywood", "91606": "North Hollywood",
    "91607": "Valley Village",
  };
  return map[zipCode] || "Los Angeles";
}

async function fetchRecords(offset, limit) {
  const params = new URLSearchParams({
    $limit: String(limit),
    $offset: String(offset),
    $order: "apno",
    $select: "apno,stno,predir,stname,suffix,zip,apc",
  });

  const url = `${ENDPOINT}?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`LADBS API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function buildAddress(r) {
  const parts = [r.stno, r.predir, r.stname, r.suffix].filter(Boolean);
  return parts.join(" ").trim();
}

async function main() {
  console.log(`\n=== LA Building Backfill (from LADBS Code Enforcement) ===`);
  console.log(`Limit: ${LIMIT}, Offset: ${OFFSET}\n`);

  // Fetch all records and deduplicate by address+zip
  const addressMap = new Map(); // key: "address|zip" -> building data
  let offset = OFFSET;
  const pageSize = 5000;
  let totalFetched = 0;

  while (totalFetched < LIMIT) {
    const fetchSize = Math.min(pageSize, LIMIT - totalFetched);
    console.log(`Fetching records ${offset}–${offset + fetchSize}...`);

    const records = await fetchRecords(offset, fetchSize);
    if (!records || records.length === 0) {
      console.log("No more records.");
      break;
    }

    for (const r of records) {
      const address = buildAddress(r);
      if (!address) continue;

      const zip = (r.zip || "").replace(/-.*/, "").trim().slice(0, 5);
      if (!zip || zip.length !== 5) continue;

      const key = `${address.toUpperCase()}|${zip}`;
      if (!addressMap.has(key)) {
        const neighborhood = getNeighborhood(zip);
        // Extract house number and street name from the address
        const stno = r.stno || "";
        const streetParts = [r.predir, r.stname, r.suffix].filter(Boolean).join(" ").trim();

        addressMap.set(key, {
          full_address: `${address}, Los Angeles, CA ${zip}`,
          house_number: stno || address.split(" ")[0] || "",
          street_name: streetParts || address.replace(/^\d+\s*/, "") || "UNKNOWN",
          borough: neighborhood,
          zip_code: zip,
          city: "Los Angeles",
          state: "CA",
          metro: "los-angeles",
          slug: generateSlug(`${address}-los-angeles-ca-${zip}`),
          violation_count: 0,
          complaint_count: 0,
          review_count: 0,
          overall_score: null,
        });
      }
    }

    totalFetched += records.length;
    offset += records.length;
    console.log(`  Fetched ${records.length}, unique buildings so far: ${addressMap.size}`);

    if (records.length < fetchSize) break;
    await sleep(300);
  }

  console.log(`\nDeduped to ${addressMap.size} unique buildings. Upserting...`);

  // Upsert in batches using select-before-insert to prevent duplicates
  const buildings = Array.from(addressMap.values());
  const stats = { inserted: 0, updated: 0, errors: 0 };

  for (let i = 0; i < buildings.length; i += BATCH_SIZE) {
    const batch = buildings.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      const { data: existing } = await supabase
        .from("buildings")
        .select("id")
        .eq("slug", row.slug)
        .eq("metro", "los-angeles")
        .eq("borough", row.borough)
        .maybeSingle();

      if (existing) {
        // Update non-null fields from this row into the existing building
        const updates = {};
        for (const [key, val] of Object.entries(row)) {
          if (val != null && key !== "slug" && key !== "id") updates[key] = val;
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from("buildings").update(updates).eq("id", existing.id);
        }
        stats.updated++;
      } else {
        const { error } = await supabase.from("buildings").insert(row);
        if (error && error.code !== "23505") {
          console.error("Insert error:", error.message);
          stats.errors++;
        } else {
          stats.inserted++;
        }
      }
    }

    if ((i / BATCH_SIZE) % 10 === 0) {
      console.log(`  Progress: ${stats.inserted + stats.updated}/${buildings.length} (inserted: ${stats.inserted}, updated: ${stats.updated}, errors: ${stats.errors})`);
    }
  }

  console.log(`\n✅ Done — inserted: ${stats.inserted}, updated: ${stats.updated}, errors: ${stats.errors}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
