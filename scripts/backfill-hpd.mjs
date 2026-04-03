#!/usr/bin/env node
/**
 * Backfill building_id for HPD violations, querying in monthly chunks
 * to avoid statement timeouts on the 800K+ row table.
 */
import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "").replace(/\\n$/g, "");
  if (!process.env[key]) process.env[key] = val;
}

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function linkChunk(startDate, endDate) {
  let totalLinked = 0;
  let hasMore = true;
  let offset = 0;

  while (hasMore) {
    const q = sb
      .from("hpd_violations")
      .select("id, bbl")
      .is("building_id", null)
      .not("bbl", "is", null)
      .neq("bbl", "")
      .gte("inspection_date", startDate)
      .lt("inspection_date", endDate)
      .order("id", { ascending: true });

    const { data: unlinked, error } = offset > 0
      ? await q.range(offset, offset + 999)
      : await q.limit(1000);

    if (error) {
      console.error(`  Fetch error (${startDate}): ${error.message}`);
      break;
    }

    if (!unlinked || unlinked.length === 0) {
      hasMore = false;
      break;
    }

    // Get unique BBLs
    const bblSet = [...new Set(unlinked.map((r) => r.bbl).filter(Boolean))];

    // Lookup buildings
    const bblToBuilding = new Map();
    for (let i = 0; i < bblSet.length; i += 500) {
      const batch = bblSet.slice(i, i + 500);
      const { data: buildings } = await sb
        .from("buildings")
        .select("id, bbl")
        .in("bbl", batch);

      if (buildings) {
        for (const b of buildings) {
          bblToBuilding.set(b.bbl, b.id);
        }
      }
    }

    // Group records by building_id
    const buildingToRecords = new Map();
    let unmatched = 0;
    for (const record of unlinked) {
      const buildingId = record.bbl ? bblToBuilding.get(record.bbl) : undefined;
      if (buildingId) {
        if (!buildingToRecords.has(buildingId)) buildingToRecords.set(buildingId, []);
        buildingToRecords.get(buildingId).push(record.id);
      } else {
        unmatched++;
      }
    }

    // Batch update with concurrency limit
    let batchLinked = 0;
    const entries = [...buildingToRecords.entries()];
    for (let i = 0; i < entries.length; i += 20) {
      const chunk = entries.slice(i, i + 20);
      await Promise.all(
        chunk.map(([buildingId, recordIds]) =>
          sb
            .from("hpd_violations")
            .update({ building_id: buildingId })
            .in("id", recordIds)
            .then(({ error: e }) => {
              if (e) console.error(`  Link error: ${e.message}`);
              else batchLinked += recordIds.length;
            })
        )
      );
    }
    totalLinked += batchLinked;

    if (batchLinked === 0) {
      offset += unlinked.length;
    }

    if (unlinked.length < 1000) hasMore = false;

    await new Promise((r) => setTimeout(r, 200));
  }

  return totalLinked;
}

console.log("Backfilling HPD violations by monthly chunks...\n");

// Process month by month, going back 2 years (most relevant for the feed)
let grandTotal = 0;
const now = new Date();

for (let monthsBack = 0; monthsBack < 24; monthsBack++) {
  const end = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const start = new Date(now.getFullYear(), now.getMonth() - monthsBack - 1, 1);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const linked = await linkChunk(startStr, endStr);
  if (linked > 0) {
    console.log(`  ${startStr} to ${endStr}: ${linked} linked`);
  }
  grandTotal += linked;
}

console.log(`\nDone! Total HPD violations linked: ${grandTotal}`);
