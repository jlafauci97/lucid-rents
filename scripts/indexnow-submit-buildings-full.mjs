#!/usr/bin/env node
/**
 * Submit ALL building URLs to IndexNow.
 * Queries per-metro with id-based cursor pagination (uses PK index).
 *
 * Usage: node scripts/indexnow-submit-buildings-full.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://okjehevpqvymuayyqkek.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY env var");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const INDEXNOW_KEY = "abef9b924e2f4854b589f0b2aad38695";
const HOST = "https://lucidrents.com";

// Set ONLY_METROS env var to comma-separated list to limit which metros to process
const ALL_METROS = [
  { metro: "nyc", prefix: "nyc" },
  { metro: "los-angeles", prefix: "CA/Los-Angeles" },
  { metro: "chicago", prefix: "IL/Chicago" },
  { metro: "miami", prefix: "FL/Miami" },
  { metro: "houston", prefix: "TX/Houston" },
];
const onlyMetros = process.env.ONLY_METROS?.split(",");
const METROS = onlyMetros
  ? ALL_METROS.filter((m) => onlyMetros.includes(m.metro))
  : ALL_METROS;

function regionSlug(name) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function buildingUrl(prefix, borough, slug) {
  const bSlug = borough ? regionSlug(borough) : "unknown";
  return `${HOST}/${prefix}/building/${bSlug}/${slug}`;
}

async function submitBatch(urls) {
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: "lucidrents.com",
      key: INDEXNOW_KEY,
      keyLocation: `${HOST}/${INDEXNOW_KEY}.txt`,
      urlList: urls,
    }),
  });
  return { status: res.status, ok: res.ok, text: res.ok ? "" : await res.text() };
}

async function fetchPage(metro, cursor, limit) {
  let query = supabase
    .from("buildings")
    .select("id, borough, slug")
    .eq("metro", metro)
    .not("slug", "is", null)
    .order("id", { ascending: true })
    .limit(limit);

  if (cursor) query = query.gt("id", cursor);

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await query;
    if (!error) return data || [];
    console.error(`  Timeout (attempt ${attempt + 1}), retrying...`);
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  return null; // all retries failed
}

async function main() {
  let grandTotal = 0;
  let grandSubmitted = 0;
  const PAGE = 500;

  for (const { metro, prefix } of METROS) {
    console.log(`\n── ${metro} ──`);
    let cursor = null;
    let metroFetched = 0;
    let urlBuffer = [];
    let consecutiveFailures = 0;

    while (true) {
      const data = await fetchPage(metro, cursor, PAGE);

      if (data === null) {
        consecutiveFailures++;
        if (consecutiveFailures >= 3) {
          console.error(`  Too many consecutive failures, moving to next metro.`);
          break;
        }
        continue;
      }
      consecutiveFailures = 0;

      if (data.length === 0) break;

      for (const b of data) {
        if (b.borough && b.slug) urlBuffer.push(buildingUrl(prefix, b.borough, b.slug));
      }
      metroFetched += data.length;
      cursor = data[data.length - 1].id;

      // Submit in 10k batches
      while (urlBuffer.length >= 10000) {
        const batch = urlBuffer.splice(0, 10000);
        process.stdout.write(`  Submit 10,000 URLs (${metroFetched.toLocaleString()} fetched)... `);
        const result = await submitBatch(batch);
        if (result.ok) {
          console.log(`✓`);
          grandSubmitted += batch.length;
        } else {
          console.log(`✗ (${result.status})`);
        }
        await new Promise((r) => setTimeout(r, 300));
      }

      if (metroFetched % 50000 < PAGE) {
        console.log(`  Progress: ${metroFetched.toLocaleString()} buildings...`);
      }

      if (data.length < PAGE) break;
    }

    // Submit remaining
    if (urlBuffer.length > 0) {
      process.stdout.write(`  Submit ${urlBuffer.length.toLocaleString()} URLs (final)... `);
      const result = await submitBatch(urlBuffer);
      if (result.ok) {
        console.log(`✓`);
        grandSubmitted += urlBuffer.length;
      } else {
        console.log(`✗ (${result.status})`);
      }
    }

    console.log(`  ${metro}: ${metroFetched.toLocaleString()} buildings`);
    grandTotal += metroFetched;
  }

  console.log(`\nDone! Fetched ${grandTotal.toLocaleString()} buildings, submitted ${grandSubmitted.toLocaleString()} URLs to IndexNow.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
