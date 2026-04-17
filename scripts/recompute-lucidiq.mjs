#!/usr/bin/env node
/**
 * Recompute LucidIQ scores for every building.
 *
 * Pages through `buildings` 1000 at a time. For each batch:
 *   1. Bulk-fetch published review aggregates (count + avg overall_rating).
 *   2. Bulk-fetch latest median rent per building from dewey_building_rents.
 *   3. Bulk-fetch neighborhood median rent per zip from dewey_neighborhood_rents.
 *   4. Bulk-fetch lead inspection failures per building (Chicago).
 *   5. Compute LucidIQ score via shared algorithm in src/lib/lucidiq-score.ts.
 *   6. Update buildings.overall_score for each building.
 *
 * Run:   node scripts/recompute-lucidiq.mjs
 * Flags: --metro=nyc       only process one metro
 *        --limit=10000     stop after N buildings (debugging)
 *        --dry             compute but skip DB writes
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Inline copy of the LucidIQ algorithm.
// Mirrors src/lib/lucidiq-score.ts so this script can run as plain ESM
// without a TS build step. Keep in sync with the canonical TS module.
// ---------------------------------------------------------------------------

const WEIGHTS = {
  reviews: 0.30,
  health: 0.25,
  rentFairness: 0.15,
  protection: 0.10,
  habitability: 0.10,
  cityRisk: 0.10,
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const num = (n) => (typeof n === "number" && Number.isFinite(n) ? n : 0);

function weightedAverage(parts) {
  const present = parts.filter((p) => p.score !== null);
  if (!present.length) return 2.5;
  const total = present.reduce((s, p) => s + p.weight, 0);
  if (total === 0) return 2.5;
  return present.reduce((acc, p) => acc + p.score * (p.weight / total), 0);
}

function scoreToGrade(s) {
  if (s >= 4.7) return "A+";
  if (s >= 4.3) return "A";
  if (s >= 4.0) return "A-";
  if (s >= 3.7) return "B+";
  if (s >= 3.3) return "B";
  if (s >= 3.0) return "B-";
  if (s >= 2.7) return "C+";
  if (s >= 2.3) return "C";
  if (s >= 2.0) return "C-";
  if (s >= 1.7) return "D+";
  if (s >= 1.3) return "D";
  if (s >= 1.0) return "D-";
  return "F";
}

function computeLucidIQ(inputs) {
  const b = inputs.building;

  // Reviews
  let reviews;
  if (inputs.reviewCount <= 0 || inputs.avgRating === null) {
    reviews = { score: null, weight: WEIGHTS.reviews, reason: "no reviews" };
  } else {
    const conf = Math.min(1, inputs.reviewCount / 5);
    const blended = inputs.avgRating * conf + 2.5 * (1 - conf);
    reviews = { score: clamp(blended, 0, 5), weight: WEIGHTS.reviews, reason: `n=${inputs.reviewCount}` };
  }

  // Health
  const incidents =
    num(b.violation_count) + num(b.dob_violation_count) + num(b.complaint_count) + num(b.litigation_count) * 3;
  const units = Math.max(1, num(b.total_units));
  const perUnit = incidents / units;
  const health = {
    score: clamp(5 - Math.log10(perUnit + 1) * 2.5, 0, 5),
    weight: WEIGHTS.health,
    reason: `${incidents} incidents / ${units} units`,
  };

  // Rent fairness
  let rentFairness;
  if (
    !inputs.buildingMedianRent ||
    !inputs.neighborhoodMedianRent ||
    inputs.buildingMedianRent <= 0 ||
    inputs.neighborhoodMedianRent <= 0
  ) {
    rentFairness = { score: null, weight: WEIGHTS.rentFairness, reason: "no rent data" };
  } else {
    const ratio = inputs.buildingMedianRent / inputs.neighborhoodMedianRent;
    let s;
    if (ratio < 0.85) s = 5;
    else if (ratio < 0.95) s = 4.5;
    else if (ratio <= 1.05) s = 4;
    else if (ratio <= 1.15) s = 3;
    else if (ratio <= 1.2) s = 2;
    else s = 1;
    rentFairness = { score: s, weight: WEIGHTS.rentFairness, reason: `ratio=${ratio.toFixed(2)}` };
  }

  // Protection
  let pScore = 3;
  if (b.is_rent_stabilized) pScore += 1.5;
  if (b.ellis_act_filing) pScore -= 1;
  const evictions = num(b.eviction_count);
  if (evictions > 0) pScore -= Math.min(evictions * 0.5, 1.5);
  if (num(b.buyout_count) > 5) pScore -= 0.5;
  const protection = { score: clamp(pScore, 0, 5), weight: WEIGHTS.protection, reason: "" };

  // Habitability
  let hScore = 5;
  const bedbugs = num(b.bedbug_report_count);
  if (bedbugs > 0) hScore -= Math.min(bedbugs * 0.5, 2.5);
  const leadFails = num(inputs.leadInspectionFailures);
  if (leadFails > 0) hScore -= Math.min(leadFails * 0.5, 1);
  if (num(b.rodent_complaint_count) > 5) hScore -= 0.5;
  if (b.dangerous_building_count && b.dangerous_building_count > 0) hScore -= 2;
  if (b.unsafe_structure_count && b.unsafe_structure_count > 0) hScore -= 0.5;
  const habitability = { score: clamp(hScore, 0, 5), weight: WEIGHTS.habitability, reason: "" };

  // City-specific risk
  const metro = (b.metro || "").toLowerCase();
  let cScore = 5;
  if (metro === "nyc" || metro === "new-york" || metro === "new_york") {
    if (b.is_soft_story) {
      const status = (b.soft_story_status || "").toLowerCase();
      if (!status.includes("retrofit") && !status.includes("complete")) cScore -= 1;
    }
  } else if (metro === "la" || metro === "los-angeles" || metro === "los_angeles") {
    const fz = (b.fire_hazard_zone || "").toLowerCase();
    if (fz.includes("high")) cScore -= 1;
    if (b.fair_plan_risk) cScore -= 1;
  } else if (metro === "chicago") {
    if (b.is_scofflaw) cScore -= 2;
    if (b.is_rlto_protected === false) cScore -= 0.5;
  } else if (metro === "miami") {
    const slr = num(b.sea_level_risk_feet);
    if (slr > 0) cScore -= Math.min(slr * 0.5, 2);
    if ((b.forty_year_recert_status || "").toLowerCase() === "overdue") cScore -= 1;
  } else if (metro === "houston") {
    if (b.in_floodplain) cScore -= 1;
    const ind = inputs.industrialProximityClosestMi;
    if (typeof ind === "number" && ind >= 0 && ind < 0.5) cScore -= 0.5;
  }
  const cityRisk = { score: clamp(cScore, 0, 5), weight: WEIGHTS.cityRisk, reason: metro };

  const all = [reviews, health, rentFairness, protection, habitability, cityRisk];

  // Count evidence-backed sub-scores (real data signals, not just "no negative info")
  let evidenceCount = 0;
  if (inputs.reviewCount > 0) evidenceCount++;
  if (incidents > 0) evidenceCount++;
  if (inputs.buildingMedianRent && inputs.neighborhoodMedianRent) evidenceCount++;
  if (b.is_rent_stabilized || b.ellis_act_filing || evictions > 0 || num(b.buyout_count) > 0) evidenceCount++;
  if (bedbugs > 0 || leadFails > 0 || num(b.rodent_complaint_count) > 5 || num(b.dangerous_building_count) > 0 || num(b.unsafe_structure_count) > 0) evidenceCount++;
  if (b.is_soft_story || b.fire_hazard_zone || b.fair_plan_risk || b.is_scofflaw || num(b.sea_level_risk_feet) > 0 || b.in_floodplain || (b.forty_year_recert_status || "").toLowerCase() === "overdue") evidenceCount++;

  // Skip unscoreable buildings entirely
  if (evidenceCount === 0) {
    return { score: null, grade: "—", evidenceCount: 0 };
  }

  // Confidence factor — softer penalty, capped at 0.75 points
  let confidenceFactor;
  if (evidenceCount >= 3) confidenceFactor = 1.0;
  else if (evidenceCount === 2) confidenceFactor = 0.9;
  else confidenceFactor = 0.75;

  const raw = weightedAverage(all);
  const idealAdjusted = 2.5 + (raw - 2.5) * confidenceFactor;
  const delta = idealAdjusted - raw;
  const cappedDelta = Math.sign(delta) * Math.min(Math.abs(delta), 0.75);
  const adjusted = raw + cappedDelta;
  const score = Math.round(clamp(adjusted, 0, 5) * 10) / 10;
  return { score, grade: scoreToGrade(score), evidenceCount };
}

// ---------------------------------------------------------------------------
// CLI args + env
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const argMetro = args.find((a) => a.startsWith("--metro="))?.split("=")[1] || null;
const argLimit = parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] || "0", 10);
const dryRun = args.includes("--dry");

const envRaw = readFileSync(".env.local", "utf-8");
const env = {};
for (const line of envRaw.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i === -1) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^"|"$/g, "");
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// ---------------------------------------------------------------------------
// Building columns we need from the buildings table
// ---------------------------------------------------------------------------

const BUILDING_COLS = [
  "id",
  "metro",
  "zip_code",
  "total_units",
  "violation_count",
  "dob_violation_count",
  "complaint_count",
  "litigation_count",
  "eviction_count",
  "bedbug_report_count",
  "is_rent_stabilized",
  "ellis_act_filing",
  "buyout_count",
  "is_scofflaw",
  "is_rlto_protected",
  "rodent_complaint_count",
  "is_soft_story",
  "soft_story_status",
  "fire_hazard_zone",
  "fair_plan_risk",
  "sea_level_risk_feet",
  "forty_year_recert_status",
  "unsafe_structure_count",
  "in_floodplain",
  "flood_claims_count",
  "dangerous_building_count",
].join(",");

// ---------------------------------------------------------------------------
// Bulk lookup helpers
// ---------------------------------------------------------------------------

async function fetchReviewAggregates(buildingIds) {
  // Pull published reviews in chunks; aggregate client-side.
  const out = new Map();
  const CHUNK = 100;
  for (let i = 0; i < buildingIds.length; i += CHUNK) {
    const ids = buildingIds.slice(i, i + CHUNK);
    const { data, error } = await sb
      .from("reviews")
      .select("building_id, overall_rating")
      .in("building_id", ids)
      .eq("status", "published")
      .not("overall_rating", "is", null);
    if (error) {
      console.error("reviews fetch error:", error.message);
      continue;
    }
    for (const r of data || []) {
      const cur = out.get(r.building_id) || { sum: 0, n: 0 };
      cur.sum += Number(r.overall_rating) || 0;
      cur.n += 1;
      out.set(r.building_id, cur);
    }
  }
  // Reduce sum to avg
  const final = new Map();
  for (const [bid, v] of out) {
    final.set(bid, { count: v.n, avg: v.n > 0 ? v.sum / v.n : null });
  }
  return final;
}

async function fetchBuildingMedianRents(buildingIds) {
  // Latest median rent per building, any bedroom — use most recent month overall.
  const out = new Map();
  const CHUNK = 100;
  for (let i = 0; i < buildingIds.length; i += CHUNK) {
    const ids = buildingIds.slice(i, i + CHUNK);
    const { data, error } = await sb
      .from("dewey_building_rents")
      .select("building_id, month, beds, median_rent")
      .in("building_id", ids)
      .gt("median_rent", 0)
      .order("month", { ascending: false });
    if (error) {
      console.error("dewey_building_rents error:", error.message);
      continue;
    }
    for (const r of data || []) {
      if (!out.has(r.building_id)) {
        out.set(r.building_id, { beds: r.beds, median_rent: Number(r.median_rent) });
      }
    }
  }
  return out;
}

async function fetchNeighborhoodMedianRents(zipBedsPairs) {
  // zipBedsPairs: array of { zip, beds }
  const out = new Map(); // key: `${zip}|${beds}` -> median_rent
  const uniqZips = [...new Set(zipBedsPairs.map((p) => p.zip).filter(Boolean))];
  const CHUNK = 200;
  for (let i = 0; i < uniqZips.length; i += CHUNK) {
    const zips = uniqZips.slice(i, i + CHUNK);
    const { data, error } = await sb
      .from("dewey_neighborhood_rents")
      .select("zip, month, beds, median_rent")
      .in("zip", zips)
      .gt("median_rent", 0)
      .order("month", { ascending: false });
    if (error) {
      console.error("dewey_neighborhood_rents error:", error.message);
      continue;
    }
    for (const r of data || []) {
      const key = `${r.zip}|${r.beds}`;
      if (!out.has(key)) out.set(key, Number(r.median_rent));
    }
  }
  return out;
}

async function fetchLeadFailures(buildingIds) {
  // Chicago-only signal; table may not exist or be empty for other metros — fail soft.
  const out = new Map();
  const CHUNK = 100;
  for (let i = 0; i < buildingIds.length; i += CHUNK) {
    const ids = buildingIds.slice(i, i + CHUNK);
    const { data, error } = await sb
      .from("chicago_lead_inspections")
      .select("building_id, result")
      .in("building_id", ids);
    if (error) {
      // Table probably not present — silently skip after first warn.
      return out;
    }
    for (const r of data || []) {
      const result = (r.result || "").toLowerCase();
      if (result.includes("fail")) {
        out.set(r.building_id, (out.get(r.building_id) || 0) + 1);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function processChunk(buildings) {
  const ids = buildings.map((b) => b.id);

  const [reviewMap, bldgRentMap, leadMap] = await Promise.all([
    fetchReviewAggregates(ids),
    fetchBuildingMedianRents(ids),
    fetchLeadFailures(ids),
  ]);

  // Build the (zip, beds) lookup list from the building rent data we just fetched.
  const zipBedsPairs = [];
  for (const b of buildings) {
    const br = bldgRentMap.get(b.id);
    if (b.zip_code && br) zipBedsPairs.push({ zip: b.zip_code, beds: br.beds });
  }
  const nhoodMap = await fetchNeighborhoodMedianRents(zipBedsPairs);

  // Compute scores
  const updates = [];
  const dist = {};
  let sumScore = 0;
  for (const b of buildings) {
    const rev = reviewMap.get(b.id) || { count: 0, avg: null };
    const br = bldgRentMap.get(b.id) || null;
    const nrent = br ? nhoodMap.get(`${b.zip_code}|${br.beds}`) || null : null;

    const result = computeLucidIQ({
      building: {
        metro: b.metro,
        total_units: b.total_units,
        violation_count: b.violation_count,
        dob_violation_count: b.dob_violation_count,
        complaint_count: b.complaint_count,
        litigation_count: b.litigation_count,
        eviction_count: b.eviction_count,
        bedbug_report_count: b.bedbug_report_count,
        is_rent_stabilized: b.is_rent_stabilized,
        ellis_act_filing: b.ellis_act_filing,
        buyout_count: b.buyout_count,
        is_scofflaw: b.is_scofflaw,
        is_rlto_protected: b.is_rlto_protected,
        rodent_complaint_count: b.rodent_complaint_count,
        is_soft_story: b.is_soft_story,
        soft_story_status: b.soft_story_status,
        fire_hazard_zone: b.fire_hazard_zone,
        fair_plan_risk: b.fair_plan_risk,
        sea_level_risk_feet: b.sea_level_risk_feet,
        forty_year_recert_status: b.forty_year_recert_status,
        unsafe_structure_count: b.unsafe_structure_count,
        in_floodplain: b.in_floodplain,
        flood_claims_count: b.flood_claims_count,
        dangerous_building_count: b.dangerous_building_count,
      },
      reviewCount: rev.count,
      avgRating: rev.avg,
      buildingMedianRent: br ? br.median_rent : null,
      neighborhoodMedianRent: nrent,
      leadInspectionFailures: leadMap.get(b.id) || 0,
      industrialProximityClosestMi: null,
    });
    updates.push({ id: b.id, score: result.score });
    if (result.score !== null) sumScore += result.score;
    dist[result.grade] = (dist[result.grade] || 0) + 1;
  }

  if (!dryRun) {
    // Group updates by score so we can do bulk IN-list updates.
    const byScore = new Map();
    for (const u of updates) {
      if (!byScore.has(u.score)) byScore.set(u.score, []);
      byScore.get(u.score).push(u.id);
    }
    const promises = [];
    for (const [score, idList] of byScore) {
      for (let i = 0; i < idList.length; i += 200) {
        const batch = idList.slice(i, i + 200);
        promises.push(
          sb
            .from("buildings")
            .update({ overall_score: score })
            .in("id", batch)
            .then(({ error }) => {
              if (error) console.error(`update err (score=${score}):`, error.message);
            })
        );
      }
    }
    // Run with limited concurrency
    for (let i = 0; i < promises.length; i += 10) {
      await Promise.all(promises.slice(i, i + 10));
    }
  }

  return { count: updates.length, sumScore, dist };
}

async function main() {
  console.log("LucidIQ Recompute");
  console.log("=================");
  console.log(`metro=${argMetro || "all"} limit=${argLimit || "none"} dry=${dryRun}\n`);

  const PAGE = 1000;
  let offset = 0;
  let totalProcessed = 0;
  let totalScoreSum = 0;
  const totalDist = {};
  const startTime = Date.now();

  while (true) {
    // Retry the page query up to 5 times with exponential backoff on transient failures.
    let data = null;
    let lastErr = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      let q = sb.from("buildings").select(BUILDING_COLS).order("id").range(offset, offset + PAGE - 1);
      if (argMetro) q = q.eq("metro", argMetro);
      try {
        const res = await q;
        if (res.error) {
          lastErr = res.error;
          console.error(`\nquery err (attempt ${attempt + 1}/5):`, res.error.message);
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt))); // 1s, 2s, 4s, 8s, 16s
          continue;
        }
        data = res.data;
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        console.error(`\nquery throw (attempt ${attempt + 1}/5):`, e.message);
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
    if (lastErr || data === null) {
      console.error("\nquery failed after 5 retries; skipping page and continuing:", lastErr?.message);
      offset += PAGE;
      continue;
    }
    if (!data || data.length === 0) break;

    const { count, sumScore, dist } = await processChunk(data);
    totalProcessed += count;
    totalScoreSum += sumScore;
    for (const [g, n] of Object.entries(dist)) totalDist[g] = (totalDist[g] || 0) + n;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rate = (totalProcessed / Math.max(elapsed, 1)).toFixed(1);
    process.stdout.write(
      `\rProcessed ${totalProcessed.toLocaleString()} | ${rate}/s | ${elapsed}s elapsed`
    );

    offset += PAGE;
    if (argLimit && totalProcessed >= argLimit) break;
    if (data.length < PAGE) break;
  }

  const unscoreable = totalDist["—"] || 0;
  const scored = totalProcessed - unscoreable;
  const avg = scored > 0 ? (totalScoreSum / scored).toFixed(2) : "0";
  console.log(`\n\nDone. Processed: ${totalProcessed.toLocaleString()}  Scored: ${scored.toLocaleString()}  Unscoreable: ${unscoreable.toLocaleString()}  Avg score: ${avg}`);
  console.log("Distribution (of scored buildings):");
  const order = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"];
  const denom = scored || 1;
  for (const g of order) {
    const n = totalDist[g] || 0;
    if (!n) continue;
    const pct = ((n / denom) * 100).toFixed(1);
    console.log(`  ${g.padEnd(2)}  ${n.toString().padStart(7)}  ${pct}%`);
  }
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
