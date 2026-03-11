#!/usr/bin/env node

/**
 * Backfill missing buildings from unlinked violation data.
 *
 * Finds all distinct BBLs in dob_violations and hpd_violations that have no
 * matching building, creates the building via the NYC geocoder, then links
 * the violations.
 *
 * Usage:
 *   node scripts/backfill-buildings.mjs                 # default batch of 500
 *   node scripts/backfill-buildings.mjs --limit=2000    # bigger batch
 *   node scripts/backfill-buildings.mjs --source=dob    # only DOB
 *   node scripts/backfill-buildings.mjs --source=hpd    # only HPD
 *   node scripts/backfill-buildings.mjs --link-only      # skip creation, just link
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
const LIMIT = parseInt(args.limit || "500", 10);
const SOURCE = args.source || "all"; // dob, hpd, 311, litigations, evictions, all
const LINK_ONLY = args["link-only"] === "true";
const BBL_PREFIX = args["bbl-prefix"] || ""; // e.g. "1" for Manhattan, "3" for Brooklyn
const CONCURRENCY = parseInt(args.concurrency || "20", 10);
const BOROUGH_FILTER = args.borough || ""; // e.g. "MANHATTAN", "BROOKLYN" — for 311 parallelization

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

// ── Step 1: Find distinct unlinked BBLs ──────────────────────────────────────
async function getUnlinkedBbls(table, limit) {
  const prefix = BBL_PREFIX ? ` (prefix=${BBL_PREFIX})` : "";
  console.log(`Querying distinct unlinked BBLs from ${table}${prefix}...`);

  // Get a sample of unlinked records to extract unique BBLs
  const fetchLimit = Math.min(limit * 20, 100000);
  let query = supabase
    .from(table)
    .select("bbl")
    .is("building_id", null)
    .not("bbl", "is", null);

  // Filter by BBL prefix (borough) if specified
  if (BBL_PREFIX) {
    query = query.like("bbl", `${BBL_PREFIX}%`);
  }

  const { data, error } = await query.limit(fetchLimit);

  if (error) {
    console.error(`Error querying ${table}:`, error.message);
    return [];
  }

  // Extract unique BBLs that are 10 digits (valid format)
  const bblSet = new Set();
  for (const row of data) {
    const bbl = row.bbl?.trim();
    if (bbl && /^\d+$/.test(bbl)) {
      // DOB uses 11-digit BBLs (5-digit lot), normalize to 10-digit (4-digit lot)
      const normalized = bbl.length === 11 ? bbl.substring(0, 10) : bbl;
      if (normalized.length === 10) {
        bblSet.add(normalized);
      }
    }
  }

  console.log(`  Found ${bblSet.size} unique valid BBLs from ${data.length} unlinked records`);
  return [...bblSet];
}

// ── Step 2: Filter BBLs that already have buildings ──────────────────────────
async function filterExistingBbls(bbls) {
  console.log(`Checking which of ${bbls.length} BBLs already have buildings...`);

  const existing = new Set();
  // Check in batches of 100
  for (let i = 0; i < bbls.length; i += 100) {
    const batch = bbls.slice(i, i + 100);
    const { data, error } = await supabase
      .from("buildings")
      .select("bbl")
      .in("bbl", batch);

    if (error) {
      console.error("Error checking buildings:", error.message);
      continue;
    }
    for (const row of data) existing.add(row.bbl);
  }

  const missing = bbls.filter((b) => !existing.has(b));
  console.log(`  ${existing.size} already exist, ${missing.length} need creation`);
  return missing;
}

// ── Step 3: Geocode BBL to get address ───────────────────────────────────────
async function geocodeBbl(bbl) {
  // First try to get address from existing violation data
  const tables = ["hpd_violations", "dob_violations", "bedbug_reports", "evictions"];

  for (const table of tables) {
    const cols =
      table === "evictions"
        ? "eviction_address,borough"
        : "house_number,street_name,borough,zip_code";

    const { data } = await supabase
      .from(table)
      .select(cols)
      .eq("bbl", bbl)
      .not(table === "evictions" ? "eviction_address" : "house_number", "is", null)
      .limit(1);

    if (data?.length > 0) {
      const row = data[0];
      if (table === "evictions" && row.eviction_address) {
        // Parse eviction address
        const parts = row.eviction_address.split(",");
        return {
          house_number: parts[0]?.trim().split(" ")[0] || "",
          street_name: parts[0]?.trim().split(" ").slice(1).join(" ") || "",
          borough: row.borough || "Manhattan",
          zip_code: parts[2]?.trim() || "",
          full_address: row.eviction_address,
        };
      }
      if (row.house_number && row.street_name) {
        const borough = row.borough || "Manhattan";
        const zip = row.zip_code || "";
        const street = row.street_name.replace(/\s+/g, " ").trim();
        return {
          house_number: row.house_number.trim(),
          street_name: street,
          borough,
          zip_code: zip,
          full_address: `${row.house_number.trim()} ${street}, ${borough}, NY, ${zip}`.replace(/, ,/g, ","),
        };
      }
    }
  }

  // Fallback 1: NYC PLUTO API (handles condo lots well)
  try {
    const boro = bbl[0];
    const block = bbl.substring(1, 6);
    const lot = bbl.substring(6, 10);
    const plutoUrl = `https://data.cityofnewyork.us/resource/64uk-42ks.json?$where=borocode='${boro}' AND block='${block}' AND lot='${lot}'&$limit=1`;
    const plutoResp = await fetch(plutoUrl);
    if (plutoResp.ok) {
      const plutoData = await plutoResp.json();
      if (plutoData.length > 0) {
        const p = plutoData[0];
        const BORO_NAMES = { "1": "Manhattan", "2": "Bronx", "3": "Brooklyn", "4": "Queens", "5": "Staten Island" };
        const borough = BORO_NAMES[boro] || "";
        const addr = p.address?.trim() || "";
        const zip = p.zipcode || "";
        if (addr) {
          const parts = addr.match(/^(\S+)\s+(.+)$/);
          return {
            house_number: parts?.[1] || "",
            street_name: parts?.[2] || addr,
            borough,
            zip_code: zip,
            full_address: `${addr}, ${borough}, NY, ${zip}`.replace(/, ,/g, ","),
          };
        }
      }
    }
  } catch {}

  // Fallback 2: NYC GeoSearch
  try {
    const boro = bbl[0];
    const block = bbl.substring(1, 6);
    const lot = bbl.substring(6, 10);
    const resp = await fetch(
      `https://geosearch.planninglabs.nyc/v2/search?text=${boro}/${block}/${lot}`
    );
    if (resp.ok) {
      const geo = await resp.json();
      if (geo.features?.length > 0) {
        const p = geo.features[0].properties;
        return {
          house_number: p.housenumber || "",
          street_name: p.street || "",
          borough: p.borough || "",
          zip_code: p.postalcode || "",
          full_address: `${p.housenumber || ""} ${p.street || ""}, ${p.borough || ""}, NY, ${p.postalcode || ""}`.trim(),
        };
      }
    }
  } catch {}

  return null;
}

// ── Step 4: Create buildings (concurrent) ────────────────────────────────────
async function createBuildings(bbls) {
  console.log(`\nCreating ${bbls.length} buildings (concurrency=${CONCURRENCY})...\n`);
  let created = 0;
  let failed = 0;
  let processed = 0;

  // Process BBLs in concurrent batches
  for (let i = 0; i < bbls.length; i += CONCURRENCY) {
    const batch = bbls.slice(i, i + CONCURRENCY);

    const results = await Promise.all(
      batch.map(async (bbl) => {
        const addr = await geocodeBbl(bbl);
        if (!addr || !addr.full_address || addr.full_address.length < 5) {
          return { bbl, ok: false };
        }
        const slug = generateSlug(addr.full_address);
        const { error } = await supabase.from("buildings").upsert(
          {
            bbl,
            borough: addr.borough,
            house_number: addr.house_number || null,
            street_name: addr.street_name,
            zip_code: addr.zip_code,
            full_address: addr.full_address,
            slug,
          },
          { onConflict: "bbl" }
        );
        if (error) {
          if (failed < 5) console.log(`  Error creating ${bbl}: ${error.message}`);
          return { bbl, ok: false };
        }
        return { bbl, ok: true };
      })
    );

    for (const r of results) {
      if (r.ok) created++;
      else failed++;
    }
    processed += batch.length;

    if (processed % 100 < CONCURRENCY) {
      console.log(`  Progress: ${processed}/${bbls.length} (${created} created, ${failed} failed)`);
    }

    // Small delay between batches
    await sleep(50);
  }

  console.log(`\nCreation complete: ${created} created, ${failed} failed`);
  return created;
}

// ── Step 5: Link violations to buildings (high-throughput) ────────────────────
async function linkViolations(table) {
  console.log(`\nLinking unlinked ${table} records to buildings...`);

  const FETCH_LIMIT = 1000; // Supabase max per query
  const LOOKUP_BATCH = 200;
  const UPSERT_CHUNK = 1000;
  const MAX_BATCHES = 500; // safety cap
  let linked = 0;
  let batch = 0;

  while (true) {
    batch++;
    // Get a large batch of unlinked records with valid BBLs
    let linkQuery = supabase
      .from(table)
      .select("id, bbl")
      .is("building_id", null)
      .not("bbl", "is", null);

    if (BBL_PREFIX) {
      linkQuery = linkQuery.like("bbl", `${BBL_PREFIX}%`);
    }

    const { data: unlinked, error } = await linkQuery.limit(FETCH_LIMIT);

    if (error) {
      console.error(`  Error fetching unlinked ${table}:`, error.message);
      break;
    }
    if (!unlinked?.length) {
      console.log(`  No more unlinked records in ${table}`);
      break;
    }

    // Get unique BBLs (normalize 11-digit to 10-digit) and look up building IDs concurrently
    const rawBbls = [...new Set(unlinked.map((r) => r.bbl).filter(Boolean))];
    const normalizedBbls = [...new Set(rawBbls.map((b) => (b.length === 11 ? b.substring(0, 10) : b)))];
    const bblToBuilding = new Map();

    // Concurrent building lookups in batches of CONCURRENCY
    const lookupBatches = [];
    for (let i = 0; i < normalizedBbls.length; i += LOOKUP_BATCH) {
      lookupBatches.push(normalizedBbls.slice(i, i + LOOKUP_BATCH));
    }

    for (let i = 0; i < lookupBatches.length; i += CONCURRENCY) {
      const concurrent = lookupBatches.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        concurrent.map((bblBatch) =>
          supabase.from("buildings").select("id, bbl").in("bbl", bblBatch)
        )
      );
      for (const { data: buildings } of results) {
        if (buildings) {
          for (const b of buildings) bblToBuilding.set(b.bbl, b.id);
        }
      }
    }

    console.log(`  Batch ${batch}: ${unlinked.length} unlinked, ${normalizedBbls.length} unique BBLs, ${bblToBuilding.size} matched buildings`);

    // Update records - match using normalized BBL
    const updates = unlinked
      .filter((r) => {
        const norm = r.bbl?.length === 11 ? r.bbl.substring(0, 10) : r.bbl;
        return bblToBuilding.has(norm);
      })
      .map((r) => {
        const norm = r.bbl.length === 11 ? r.bbl.substring(0, 10) : r.bbl;
        return { id: r.id, building_id: bblToBuilding.get(norm) };
      });

    if (updates.length === 0) {
      console.log(`  Batch ${batch}: no matchable records`);
      break;
    }

    // Concurrent upserts in chunks
    const upsertChunks = [];
    for (let i = 0; i < updates.length; i += UPSERT_CHUNK) {
      upsertChunks.push(updates.slice(i, i + UPSERT_CHUNK));
    }

    let batchLinked = 0;
    // Use individual .update() calls instead of .upsert() to avoid NOT NULL constraint errors
    // (upsert tries to INSERT which fails on tables with required columns like litigation_id)
    for (let i = 0; i < updates.length; i += CONCURRENCY) {
      const batch = updates.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map((u) =>
          supabase.from(table).update({ building_id: u.building_id }).eq("id", u.id)
        )
      );
      for (let j = 0; j < results.length; j++) {
        if (results[j].error) {
          console.error(`  Link error: ${results[j].error.message}`);
        } else {
          batchLinked++;
        }
      }
    }

    linked += batchLinked;
    console.log(`  Batch ${batch}: linked ${batchLinked} of ${unlinked.length} (total: ${linked})`);

    if (unlinked.length < FETCH_LIMIT || batch >= MAX_BATCHES) break;
    await sleep(50);
  }

  console.log(`  Total linked in ${table}: ${linked}`);
  return linked;
}

// ── Step 6: Link 311 complaints by address (+ create buildings) ───────────────

// Capitalize borough name: "MANHATTAN" -> "Manhattan"
function titleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

async function link311ByAddress() {
  console.log(`\nLinking unlinked complaints_311 by address...`);

  const FETCH_LIMIT = 1000;
  const MAX_BATCHES = 500;
  let linked = 0;
  let created = 0;
  let batch = 0;

  while (true) {
    batch++;

    // Get unlinked 311 records with addresses
    let q311 = supabase
      .from("complaints_311")
      .select("id, incident_address, borough, latitude, longitude")
      .is("building_id", null)
      .not("incident_address", "is", null);
    if (BOROUGH_FILTER) {
      q311 = q311.eq("borough", BOROUGH_FILTER.toUpperCase());
    }
    const { data: unlinked, error } = await q311.limit(FETCH_LIMIT);

    if (error) {
      console.error(`  Error fetching unlinked 311:`, error.message);
      break;
    }
    if (!unlinked?.length) {
      console.log(`  No more unlinked 311 records`);
      break;
    }

    // Extract unique addresses (normalize whitespace) with borough info
    const addrSet = new Map(); // normalized_addr -> { ids: [], borough, lat, lng }
    for (const r of unlinked) {
      const addr = r.incident_address?.trim().replace(/\s+/g, " ").toUpperCase();
      if (!addr) continue;
      if (!addrSet.has(addr)) {
        addrSet.set(addr, { ids: [], borough: r.borough, lat: r.latitude, lng: r.longitude });
      }
      addrSet.get(addr).ids.push(r.id);
    }

    const uniqueAddrs = [...addrSet.keys()];
    console.log(`  Batch ${batch}: ${unlinked.length} unlinked, ${uniqueAddrs.length} unique addresses`);

    // Look up buildings by house_number + street_name (concurrent targeted queries)
    const addrToBuilding = new Map();

    // Parse each 311 address into house_number + street
    const parsedAddrs = uniqueAddrs.map((addr) => {
      const parts = addr.match(/^(\S+)\s+(.+)$/);
      return { addr, houseNum: parts?.[1] || "", street: parts?.[2] || addr };
    }).filter((p) => p.houseNum);

    // Concurrent lookups: eq(house_number) + ilike(street_name) is fast (house_number narrows the set)
    for (let i = 0; i < parsedAddrs.length; i += CONCURRENCY) {
      const batch = parsedAddrs.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(({ houseNum, street }) => {
          const streetPattern = street.split(" ").filter(Boolean).join("%");
          return supabase
            .from("buildings")
            .select("id")
            .eq("house_number", houseNum)
            .ilike("street_name", streetPattern)
            .limit(1);
        })
      );
      for (let j = 0; j < results.length; j++) {
        const { data: buildings } = results[j];
        if (buildings?.length > 0) {
          addrToBuilding.set(batch[j].addr, buildings[0].id);
        }
      }
    }

    // Create buildings for unmatched addresses
    const unmatched = uniqueAddrs.filter((a) => !addrToBuilding.has(a));
    if (unmatched.length > 0 && !LINK_ONLY) {
      let batchCreated = 0;
      for (let i = 0; i < unmatched.length; i += CONCURRENCY) {
        const createBatch = unmatched.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          createBatch.map(async (addr) => {
            const info = addrSet.get(addr);
            const borough = titleCase(info.borough || "");
            // Parse house number and street from incident_address (e.g. "123 MAIN STREET")
            const parts = addr.match(/^(\S+)\s+(.+)$/);
            const houseNum = parts?.[1] || "";
            const street = parts?.[2] || addr;
            const fullAddress = `${addr}, ${borough}, NY`;
            const slug = generateSlug(fullAddress);

            const { error } = await supabase.from("buildings").insert({
              borough,
              house_number: houseNum || null,
              street_name: street,
              full_address: fullAddress,
              slug,
            });
            if (error) {
              // Likely duplicate slug — try with lat/lng suffix
              if (error.message.includes("duplicate")) return { addr, ok: false, dup: true };
              return { addr, ok: false };
            }
            // Fetch the created building ID
            const { data: newBldg } = await supabase
              .from("buildings")
              .select("id")
              .eq("slug", slug)
              .limit(1);
            if (newBldg?.length > 0) {
              addrToBuilding.set(addr, newBldg[0].id);
              return { addr, ok: true };
            }
            return { addr, ok: false };
          })
        );
        batchCreated += results.filter((r) => r.ok).length;
      }
      created += batchCreated;
      console.log(`  Created ${batchCreated} new buildings, now ${addrToBuilding.size} matched`);
    } else {
      console.log(`  Matched ${addrToBuilding.size} of ${uniqueAddrs.length} addresses`);
    }

    // Build update list
    const updates = [];
    for (const [addr, info] of addrSet) {
      const buildingId = addrToBuilding.get(addr);
      if (buildingId) {
        for (const id of info.ids) {
          updates.push({ id, building_id: buildingId });
        }
      }
    }

    if (updates.length === 0) {
      console.log(`  Batch ${batch}: no matchable records`);
      break;
    }

    // Concurrent updates
    let batchLinked = 0;
    for (let i = 0; i < updates.length; i += CONCURRENCY) {
      const updateBatch = updates.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        updateBatch.map((u) =>
          supabase.from("complaints_311").update({ building_id: u.building_id }).eq("id", u.id)
        )
      );
      for (const r of results) {
        if (r.error) {
          console.error(`  311 link error: ${r.error.message}`);
        } else {
          batchLinked++;
        }
      }
    }

    linked += batchLinked;
    console.log(`  Batch ${batch}: linked ${batchLinked} (total: ${linked})`);

    if (unlinked.length < FETCH_LIMIT || batch >= MAX_BATCHES) break;
    await sleep(50);
  }

  console.log(`  311 total: ${linked} linked, ${created} buildings created`);
  return linked;
}

// ── Step 7: Link evictions by address ──────────────────────────────────────────
async function linkEvictionsByAddress() {
  console.log(`\nLinking unlinked evictions by address...`);

  const FETCH_LIMIT = 1000;
  const MAX_BATCHES = 500;
  let linked = 0;
  let created = 0;
  let batch = 0;

  while (true) {
    batch++;

    const { data: unlinked, error } = await supabase
      .from("evictions")
      .select("id, eviction_address, borough, eviction_zip")
      .is("building_id", null)
      .is("bbl", null)
      .not("eviction_address", "is", null)
      .limit(FETCH_LIMIT);

    if (error) {
      console.error(`  Error fetching unlinked evictions:`, error.message);
      break;
    }
    if (!unlinked?.length) {
      console.log(`  No more unlinked evictions`);
      break;
    }

    // Parse eviction_address: strip apartment info (APT, UNIT, FL, #, etc.)
    const addrSet = new Map();
    for (const r of unlinked) {
      let addr = r.eviction_address?.trim().replace(/\s+/g, " ").toUpperCase();
      if (!addr) continue;
      // Strip apartment/unit suffixes
      addr = addr.replace(/\s+(APT|UNIT|FL|FLOOR|#|STE|SUITE|RM|ROOM)\s*.*/i, "").trim();
      if (!addr) continue;
      if (!addrSet.has(addr)) {
        addrSet.set(addr, { ids: [], borough: r.borough, zip: r.eviction_zip });
      }
      addrSet.get(addr).ids.push(r.id);
    }

    const uniqueAddrs = [...addrSet.keys()];
    console.log(`  Batch ${batch}: ${unlinked.length} unlinked, ${uniqueAddrs.length} unique addresses`);

    // Look up buildings by house_number + street_name
    const addrToBuilding = new Map();
    const parsedAddrs = uniqueAddrs.map((addr) => {
      const parts = addr.match(/^(\S+)\s+(.+)$/);
      return { addr, houseNum: parts?.[1] || "", street: parts?.[2] || addr };
    }).filter((p) => p.houseNum);

    for (let i = 0; i < parsedAddrs.length; i += CONCURRENCY) {
      const batchP = parsedAddrs.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batchP.map(({ houseNum, street }) => {
          const streetPattern = street.split(" ").filter(Boolean).join("%");
          return supabase
            .from("buildings")
            .select("id")
            .eq("house_number", houseNum)
            .ilike("street_name", streetPattern)
            .limit(1);
        })
      );
      for (let j = 0; j < results.length; j++) {
        const { data: buildings } = results[j];
        if (buildings?.length > 0) {
          addrToBuilding.set(batchP[j].addr, buildings[0].id);
        }
      }
    }

    // Create buildings for unmatched addresses
    const unmatched = uniqueAddrs.filter((a) => !addrToBuilding.has(a));
    if (unmatched.length > 0 && !LINK_ONLY) {
      let batchCreated = 0;
      for (let i = 0; i < unmatched.length; i += CONCURRENCY) {
        const createBatch = unmatched.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          createBatch.map(async (addr) => {
            const info = addrSet.get(addr);
            const borough = titleCase(info.borough || "");
            const parts = addr.match(/^(\S+)\s+(.+)$/);
            const houseNum = parts?.[1] || "";
            const street = parts?.[2] || addr;
            const zip = info.zip || "";
            const fullAddress = zip ? `${addr}, ${borough}, NY, ${zip}` : `${addr}, ${borough}, NY`;
            const slug = generateSlug(fullAddress);

            const { error } = await supabase.from("buildings").insert({
              borough,
              house_number: houseNum || null,
              street_name: street,
              zip_code: zip || null,
              full_address: fullAddress,
              slug,
            });
            if (error) return { addr, ok: false };
            const { data: newBldg } = await supabase.from("buildings").select("id").eq("slug", slug).limit(1);
            if (newBldg?.length > 0) {
              addrToBuilding.set(addr, newBldg[0].id);
              return { addr, ok: true };
            }
            return { addr, ok: false };
          })
        );
        batchCreated += results.filter((r) => r.ok).length;
      }
      created += batchCreated;
      console.log(`  Created ${batchCreated} new buildings, now ${addrToBuilding.size} matched`);
    } else {
      console.log(`  Matched ${addrToBuilding.size} of ${uniqueAddrs.length} addresses`);
    }

    // Build update list
    const updates = [];
    for (const [addr, info] of addrSet) {
      const buildingId = addrToBuilding.get(addr);
      if (buildingId) {
        for (const id of info.ids) {
          updates.push({ id, building_id: buildingId });
        }
      }
    }

    if (updates.length === 0) {
      console.log(`  Batch ${batch}: no matchable records`);
      break;
    }

    let batchLinked = 0;
    for (let i = 0; i < updates.length; i += CONCURRENCY) {
      const updateBatch = updates.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        updateBatch.map((u) =>
          supabase.from("evictions").update({ building_id: u.building_id }).eq("id", u.id)
        )
      );
      for (const r of results) {
        if (r.error) console.error(`  Eviction link error: ${r.error.message}`);
        else batchLinked++;
      }
    }

    linked += batchLinked;
    console.log(`  Batch ${batch}: linked ${batchLinked} (total: ${linked})`);

    if (unlinked.length < FETCH_LIMIT || batch >= MAX_BATCHES) break;
    await sleep(50);
  }

  console.log(`  Evictions total: ${linked} linked, ${created} buildings created`);
  return linked;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const LOOP = args.loop === "true";
  const prefix = BBL_PREFIX ? `, bblPrefix=${BBL_PREFIX}` : "";
  console.log(`Backfill buildings — limit=${LIMIT}, source=${SOURCE}, linkOnly=${LINK_ONLY}${prefix}, loop=${LOOP}\n`);

  let round = 0;
  let totalCreated = 0;
  let totalLinked = 0;

  do {
    round++;
    if (LOOP) console.log(`\n========== ROUND ${round} ==========\n`);

    let roundCreated = 0;
    let roundLinked = 0;

    if (!LINK_ONLY) {
      let allBbls = new Set();

      if (SOURCE === "all" || SOURCE === "dob") {
        const bbls = await getUnlinkedBbls("dob_violations", LIMIT);
        bbls.forEach((b) => allBbls.add(b));
      }
      if (SOURCE === "all" || SOURCE === "hpd") {
        const bbls = await getUnlinkedBbls("hpd_violations", LIMIT);
        bbls.forEach((b) => allBbls.add(b));
      }
      if (SOURCE === "all" || SOURCE === "litigations") {
        const bbls = await getUnlinkedBbls("hpd_litigations", LIMIT);
        bbls.forEach((b) => allBbls.add(b));
      }

      const uniqueBbls = [...allBbls].slice(0, LIMIT);
      console.log(`\nTotal unique BBLs to process: ${uniqueBbls.length}`);

      if (uniqueBbls.length === 0) {
        console.log("No more unlinked BBLs found. Moving to final linking pass...");
        break;
      }

      const missingBbls = await filterExistingBbls(uniqueBbls);

      if (missingBbls.length > 0) {
        roundCreated = await createBuildings(missingBbls);
        totalCreated += roundCreated;
      } else {
        console.log("\nAll BBLs already have buildings.");
      }
    }

    // Link violations (BBL-based)
    const tables = [];
    if (SOURCE === "all" || SOURCE === "dob") tables.push("dob_violations");
    if (SOURCE === "all" || SOURCE === "hpd") tables.push("hpd_violations");
    if (SOURCE === "all" || SOURCE === "litigations") tables.push("hpd_litigations");
    if (SOURCE === "all") tables.push("bedbug_reports", "evictions");

    for (const table of tables) {
      roundLinked += await linkViolations(table);
    }

    // Link 311 complaints by address (not BBL)
    if (SOURCE === "all" || SOURCE === "311") {
      roundLinked += await link311ByAddress();
    }

    // Link evictions without BBL by address
    if (SOURCE === "all" || SOURCE === "evictions") {
      roundLinked += await linkEvictionsByAddress();
    }
    totalLinked += roundLinked;

    // Exit loop if no progress was made this round
    if (LOOP && roundCreated === 0 && roundLinked === 0) {
      console.log("\nNo progress this round — all done.");
      break;
    }

  } while (LOOP);

  // Final linking pass
  if (LOOP) {
    console.log("\n========== FINAL LINK PASS ==========\n");
    const tables = [];
    if (SOURCE === "all" || SOURCE === "dob") tables.push("dob_violations");
    if (SOURCE === "all" || SOURCE === "hpd") tables.push("hpd_violations");
    if (SOURCE === "all") tables.push("hpd_litigations", "bedbug_reports", "evictions");
    for (const table of tables) {
      totalLinked += await linkViolations(table);
    }
    if (SOURCE === "all" || SOURCE === "311") {
      totalLinked += await link311ByAddress();
    }
    if (SOURCE === "all" || SOURCE === "evictions") {
      totalLinked += await linkEvictionsByAddress();
    }
  }

  console.log(`\nDone! Total created: ${totalCreated}, total linked: ${totalLinked}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
