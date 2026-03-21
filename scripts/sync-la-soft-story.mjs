#!/usr/bin/env node

/**
 * Sync LA soft-story seismic retrofit data from LADBS.
 * Matches to buildings by address+zip and updates is_soft_story + soft_story_status.
 *
 * Source: LADBS Soft Story Permits (nc44-6znn)
 * https://data.lacity.org/resource/nc44-6znn.json
 *
 * Usage:
 *   node scripts/sync-la-soft-story.mjs
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
const CONCURRENCY = 20;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function normalizeStatus(status) {
  if (!status) return "Unknown";
  const s = status.toUpperCase();
  if (s.includes("COFC") || s.includes("CERTIFICATE") || s.includes("FINAL")) return "Retrofitted";
  if (s.includes("ISSUED") && !s.includes("COFC")) return "In Progress";
  if (s.includes("SUBMITTED") || s.includes("PLAN CHECK")) return "In Progress";
  if (s.includes("EXPIRED") || s.includes("CANCEL")) return "Expired";
  return "In Progress";
}

async function main() {
  console.log("\n=== LA Soft-Story Seismic Retrofit Sync ===\n");

  // Load building address map
  console.log("Loading LA building slugs...");
  const slugMap = new Map(); // slug -> building_id
  let lastId = null;
  while (true) {
    let q = supabase.from("buildings").select("id, slug").eq("metro", "los-angeles").order("id", { ascending: true }).limit(10000);
    if (lastId) q = q.gt("id", lastId);
    const { data } = await q;
    if (!data || data.length === 0) break;
    for (const b of data) slugMap.set(b.slug, b.id);
    lastId = data[data.length - 1].id;
    if (data.length < 10000) break;
  }
  console.log(`  ${slugMap.size} building slugs loaded\n`);

  // Fetch all soft-story records
  console.log("Fetching soft-story data...");
  let offset = 0;
  let totalMatched = 0;
  let totalRecords = 0;

  while (true) {
    const url = `https://data.lacity.org/resource/nc44-6znn.json?$limit=5000&$offset=${offset}&$order=pcis_permit`;
    const res = await fetch(url);
    if (!res.ok) { console.error(`API error: ${res.status}`); break; }
    const records = await res.json();
    if (!records || records.length === 0) break;

    const updates = [];
    for (const r of records) {
      const addr = [r.address_start, r.street_direction, r.street_name, r.street_suffix].filter(Boolean).join(" ").trim();
      if (!addr) continue;
      const zip = (r.zip_code || "").slice(0, 5);
      if (!zip) continue;

      const slug = addr.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      const fullSlug = `${slug}-los-angeles-ca-${zip}`;
      const buildingId = slugMap.get(fullSlug);
      if (!buildingId) continue;

      updates.push({
        id: buildingId,
        is_soft_story: true,
        soft_story_status: normalizeStatus(r.latest_status),
      });
    }

    // Update buildings concurrently
    for (let i = 0; i < updates.length; i += CONCURRENCY) {
      const batch = updates.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map((u) =>
        supabase.from("buildings").update({
          is_soft_story: u.is_soft_story,
          soft_story_status: u.soft_story_status,
        }).eq("id", u.id)
      ));
    }

    totalMatched += updates.length;
    totalRecords += records.length;
    console.log(`  ${totalRecords} records, ${totalMatched} matched to buildings`);

    if (records.length < 5000) break;
    offset += records.length;
    await sleep(300);
  }

  console.log(`\n✅ Soft-story: ${totalRecords} records, ${totalMatched} matched to buildings`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
