#!/usr/bin/env node
/**
 * Build landlord_stats table from buildings data.
 * Scans all buildings with owner_name, aggregates stats per landlord,
 * and upserts into landlord_stats table.
 *
 * Run after owner enrichment or periodically via cron.
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^"|"$/g, "").replace(/\\n/g, "\n");
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const landlordMap = new Map();
let lastId = null;
const BATCH = 1000;
let scanned = 0;

console.log("Scanning buildings...");

while (true) {
  let query = sb
    .from("buildings")
    .select("id,owner_name,full_address,violation_count,complaint_count,litigation_count,dob_violation_count,overall_score")
    .not("owner_name", "is", null)
    .order("id", { ascending: true })
    .limit(BATCH);

  if (lastId) query = query.gt("id", lastId);

  const { data, error } = await query;
  if (error) {
    console.error("DB error:", error.message);
    await new Promise(r => setTimeout(r, 5000));
    continue;
  }
  if (!data || data.length === 0) break;

  lastId = data[data.length - 1].id;

  for (const b of data) {
    const name = b.owner_name;
    if (!name) continue;

    const existing = landlordMap.get(name);
    if (existing) {
      existing.building_count++;
      existing.total_violations += b.violation_count || 0;
      existing.total_complaints += b.complaint_count || 0;
      existing.total_litigations += b.litigation_count || 0;
      existing.total_dob_violations += b.dob_violation_count || 0;
      if (b.overall_score !== null) {
        existing._scores.push(b.overall_score);
      }
      if ((b.violation_count || 0) > existing.worst_building_violations) {
        existing.worst_building_id = b.id;
        existing.worst_building_address = b.full_address;
        existing.worst_building_violations = b.violation_count || 0;
      }
    } else {
      landlordMap.set(name, {
        name,
        building_count: 1,
        total_violations: b.violation_count || 0,
        total_complaints: b.complaint_count || 0,
        total_litigations: b.litigation_count || 0,
        total_dob_violations: b.dob_violation_count || 0,
        worst_building_id: b.id,
        worst_building_address: b.full_address,
        worst_building_violations: b.violation_count || 0,
        _scores: b.overall_score !== null ? [b.overall_score] : [],
      });
    }
  }

  scanned += data.length;
  process.stdout.write(`\r  Scanned: ${scanned} buildings, ${landlordMap.size} landlords`);

  if (data.length < BATCH) break;
}

console.log(`\n\nTotal landlords: ${landlordMap.size}`);

// Compute avg scores and prepare rows
const rows = [];
for (const [, l] of landlordMap) {
  const avgScore = l._scores.length > 0
    ? Math.round((l._scores.reduce((a, b) => a + b, 0) / l._scores.length) * 100) / 100
    : null;

  // Create URL-safe slug
  const slug = l.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  rows.push({
    name: l.name,
    slug,
    building_count: l.building_count,
    total_violations: l.total_violations,
    total_complaints: l.total_complaints,
    total_litigations: l.total_litigations,
    total_dob_violations: l.total_dob_violations,
    avg_score: avgScore,
    worst_building_id: l.worst_building_id,
    worst_building_address: l.worst_building_address,
    worst_building_violations: l.worst_building_violations,
  });
}

// First try to create the table if it doesn't exist
// We'll use upsert which requires the table to exist
console.log("Upserting landlord stats...");

// Clear existing data
const { error: deleteError } = await sb.from("landlord_stats").delete().gte("building_count", 0);
if (deleteError) {
  console.error("Table may not exist yet. Please create it in Supabase Dashboard SQL editor:");
  console.log(`
CREATE TABLE IF NOT EXISTS landlord_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  building_count INTEGER DEFAULT 0,
  total_violations INTEGER DEFAULT 0,
  total_complaints INTEGER DEFAULT 0,
  total_litigations INTEGER DEFAULT 0,
  total_dob_violations INTEGER DEFAULT 0,
  avg_score NUMERIC(5,2),
  worst_building_id UUID,
  worst_building_address TEXT,
  worst_building_violations INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name)
);
CREATE INDEX idx_landlord_stats_slug ON landlord_stats(slug);
CREATE INDEX idx_landlord_stats_violations ON landlord_stats(total_violations DESC);
CREATE INDEX idx_landlord_stats_complaints ON landlord_stats(total_complaints DESC);
CREATE INDEX idx_landlord_stats_buildings ON landlord_stats(building_count DESC);
CREATE INDEX idx_landlord_stats_name_trgm ON landlord_stats USING gin (name gin_trgm_ops);
ALTER TABLE landlord_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON landlord_stats FOR SELECT USING (true);
  `);
  process.exit(1);
}

// Batch insert in chunks of 500
const UPSERT_BATCH = 500;
let inserted = 0;
for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
  const batch = rows.slice(i, i + UPSERT_BATCH);
  const { error } = await sb.from("landlord_stats").insert(batch);
  if (error) {
    console.error(`Insert error at batch ${i}:`, error.message);
    // Try individual inserts for this batch
    for (const row of batch) {
      const { error: singleErr } = await sb.from("landlord_stats").upsert(row, { onConflict: "name" });
      if (singleErr) console.error(`  Failed: ${row.name}: ${singleErr.message}`);
      else inserted++;
    }
  } else {
    inserted += batch.length;
  }
  process.stdout.write(`\r  Inserted: ${inserted} / ${rows.length}`);
}

console.log(`\n\nDone! ${inserted} landlords in landlord_stats table.`);
