#!/usr/bin/env node
/**
 * One-off script: submit all building URLs to IndexNow.
 * IndexNow accepts max 10,000 URLs per request, so we batch.
 *
 * Usage: node scripts/indexnow-submit-all.mjs
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

const CITY_URL_PREFIX = {
  nyc: "nyc",
  "los-angeles": "CA/Los-Angeles",
  chicago: "IL/Chicago",
  miami: "FL/Miami",
  houston: "TX/Houston",
};

function regionSlug(name) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function buildingUrl(metro, borough, slug) {
  const prefix = CITY_URL_PREFIX[metro] || "nyc";
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

async function main() {
  console.log("Fetching all buildings with slugs...");

  let offset = 0;
  const allUrls = [];
  const PAGE = 10000;

  while (true) {
    const { data, error } = await supabase
      .from("buildings")
      .select("metro, borough, slug")
      .not("slug", "is", null)
      .range(offset, offset + PAGE - 1);

    if (error) {
      console.error("Query error:", error.message);
      break;
    }
    if (!data || data.length === 0) break;

    for (const b of data) {
      if (b.borough && b.slug) {
        allUrls.push(buildingUrl(b.metro || "nyc", b.borough, b.slug));
      }
    }

    console.log(`  Fetched ${offset + data.length} buildings so far...`);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  console.log(`\nTotal URLs to submit: ${allUrls.length}`);

  // Submit in batches of 10,000
  const BATCH = 10000;
  let totalSubmitted = 0;

  for (let i = 0; i < allUrls.length; i += BATCH) {
    const batch = allUrls.slice(i, i + BATCH);
    console.log(`\nSubmitting batch ${Math.floor(i / BATCH) + 1} (${batch.length} URLs)...`);

    const result = await submitBatch(batch);
    if (result.ok) {
      console.log(`  ✓ Accepted (HTTP ${result.status})`);
      totalSubmitted += batch.length;
    } else {
      console.error(`  ✗ Failed (HTTP ${result.status}): ${result.text}`);
    }

    // Brief pause between batches to be polite
    if (i + BATCH < allUrls.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`\nDone! Submitted ${totalSubmitted} URLs to IndexNow.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
