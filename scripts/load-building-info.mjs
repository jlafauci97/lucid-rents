#!/usr/bin/env node
/**
 * Load building metro/zip for a range of the buildings table.
 * Usage: node scripts/load-building-info.mjs --start=0 --end=500000 --out=/tmp/bldg_0.json
 * Filters to only buildings in the needed IDs set (from /tmp/needed_building_ids.json)
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const envFile of [".env.local", ".env.production.local"]) {
  try {
    for (const line of readFileSync(resolve(__dirname, "..", envFile), "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) { const k = m[1].trim(); if (!env[k]) env[k] = m[2].trim().replace(/^"|"$/g, ""); }
    }
  } catch {}
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const START = parseInt(process.argv.find(a => a.startsWith("--start="))?.split("=")[1] || "0");
const END = parseInt(process.argv.find(a => a.startsWith("--end="))?.split("=")[1] || "500000");
const OUT = process.argv.find(a => a.startsWith("--out="))?.split("=")[1] || "/tmp/bldg.json";

function log(m) { console.log(`[${new Date().toISOString().slice(11,19)}] ${m}`); }

async function main() {
  // Load needed IDs
  const needed = new Set(JSON.parse(readFileSync("/tmp/needed_building_ids.json", "utf8")));
  log(`Loaded ${needed.size} needed IDs, scanning range ${START}-${END}`);

  const results = {};
  let offset = START, retries = 0;
  while (offset < END) {
    try {
      const { data, error } = await supabase.from("buildings").select("id, metro, zip_code").order("id").range(offset, offset + 4999);
      if (error) {
        retries++;
        if (retries > 3) { log(`Skip @ ${offset}`); offset += 5000; retries = 0; continue; }
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      retries = 0;
      if (!data?.length) break;
      for (const b of data) {
        if (needed.has(b.id)) results[b.id] = { metro: b.metro, zip: b.zip_code };
      }
      offset += 5000;
      if (offset % 50000 === 0) log(`scanned ${offset}, matched ${Object.keys(results).length}`);
      if (data.length < 5000) break;
    } catch (e) {
      retries++;
      if (retries > 3) { offset += 5000; retries = 0; }
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  writeFileSync(OUT, JSON.stringify(results));
  log(`Done: ${Object.keys(results).length} buildings saved to ${OUT}`);
}

main().catch(e => { log(`FATAL: ${e.message}`); process.exit(1); });
