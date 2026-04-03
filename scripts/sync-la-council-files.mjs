#!/usr/bin/env node

/**
 * Sync LA City Council Files from CFMS (ColdFusion scraping) + PrimeGov API
 * CFMS: https://cityclerk.lacity.org/lacityclerkconnect/
 * PrimeGov: https://lacity.primegov.com/api/v2/PublicPortal/
 *
 * Usage:
 *   node scripts/sync-la-council-files.mjs
 *   node scripts/sync-la-council-files.mjs --limit=100
 *   node scripts/sync-la-council-files.mjs --year=25
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

const LIMIT = parseInt(args.limit || "200", 10);
const SOURCE = "la_council_files";
const BATCH = 50;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

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

function normalizeLaStatus(raw) {
  const lower = (raw || "").toLowerCase();
  if (lower.includes("adopt") || lower.includes("approv")) return "passed";
  if (lower.includes("denied") || lower.includes("disapprov")) return "failed";
  if (lower.includes("withdraw")) return "withdrawn";
  if (lower.includes("pending") || lower.includes("filed")) return "introduced";
  return "active";
}

// Extract text after a label in the CFMS div layout:
// <div class="reclabel">Label</div>\n<div class="rectext">Value</div>
function extractField(html, label) {
  const re = new RegExp(`<div[^>]*class="reclabel"[^>]*>[^<]*${label}[^<]*</div>\\s*<div[^>]*class="rectext"[^>]*>([^<]+)</div>`, "i");
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function stripHtml(str) {
  return (str || "").replace(/<[^>]+>/g, "").trim();
}

async function scrapeCouncilFile(cfNumber) {
  const url = `https://cityclerk.lacity.org/lacityclerkconnect/index.cfm?fa=ccfi.viewrecord&cfnumber=${cfNumber}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LucidRents/1.0)" },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Check for valid page (not empty or error)
    if (html.includes("No records found") || html.length < 500) return null;

    const title = extractField(html, "Title") ||
                  extractField(html, "Subject");
    if (!title || title.length < 5) return null;

    const mover = extractField(html, "Mover") ||
                  extractField(html, "Initiated by") || null;
    const dateReceived = extractField(html, "Date Received") ||
                         extractField(html, "Introduced") || null;
    const lastChanged = extractField(html, "Last Changed") || null;
    const status = extractField(html, "Status") || null;

    let councilDistrict = null;
    const cdMatch = title.match(/CD\s*(\d+)/i) || html.match(/Council District\s*(\d+)/i);
    if (cdMatch) councilDistrict = parseInt(cdMatch[1]);

    return {
      cfNumber,
      title: stripHtml(title),
      mover: mover ? stripHtml(mover) : null,
      dateReceived: dateReceived ? parseDate(stripHtml(dateReceived)) : null,
      lastChanged: lastChanged ? parseDate(stripHtml(lastChanged)) : null,
      status: status ? stripHtml(status) : null,
      councilDistrict,
      sourceUrl: url,
    };
  } catch (err) {
    console.error(`  Error scraping ${cfNumber}:`, err.message);
    return null;
  }
}

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

function getCfRange() {
  const now = new Date();
  const year = args.year || String(now.getFullYear()).slice(2);
  const start = 1;
  const end = LIMIT;
  return { year, start, end };
}

async function main() {
  console.log(`\n=== Syncing LA Council Files ===`);
  console.log(`Limit: ${LIMIT}\n`);

  const { year, start, end } = getCfRange();
  const rows = [];
  let scraped = 0;
  let skipped = 0;

  for (let num = end; num >= start; num--) {
    const cfNumber = `${year}-${String(num).padStart(4, "0")}`;
    console.log(`Scraping CF ${cfNumber}...`);

    const data = await scrapeCouncilFile(cfNumber);
    if (!data) {
      skipped++;
      await sleep(300);
      continue;
    }

    rows.push({
      metro: "los-angeles",
      source: SOURCE,
      external_id: cfNumber,
      title: data.title,
      description: null,
      type: "legislation",
      status: normalizeLaStatus(data.status || ""),
      category: categorize(data.title),
      borough: null,
      council_district: data.councilDistrict,
      neighborhood: null,
      sponsor: data.mover,
      intro_date: data.dateReceived || `20${year}-01-01`,
      last_action_date: data.lastChanged,
      hearing_date: null,
      source_url: data.sourceUrl,
      latitude: null,
      longitude: null,
      raw_data: data,
      updated_at: new Date().toISOString(),
    });

    scraped++;
    await sleep(500);
  }

  console.log(`\nScraped: ${scraped}, Skipped: ${skipped}`);

  let totalUpserted = 0;
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

  console.log(`\nLA Council Files: ${totalUpserted} upserted\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
