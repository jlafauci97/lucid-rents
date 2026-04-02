#!/usr/bin/env node
/**
 * Submit all non-building URLs to IndexNow:
 * landlords, neighborhoods, crime/zip pages, static pages,
 * city pages, news articles, subway lines, region directories.
 *
 * Usage: node scripts/indexnow-submit-rest.mjs
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

const VALID_CITIES = ["nyc", "los-angeles", "chicago", "miami", "houston"];

const CITY_META = {
  nyc: { urlPrefix: "nyc", regions: ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"] },
  "los-angeles": { urlPrefix: "CA/Los-Angeles", regions: ["Downtown","Hollywood","Silver Lake","Echo Park","Los Feliz","Koreatown","Mid-Wilshire","Westlake","East Hollywood","Thai Town","Highland Park","Eagle Rock","Boyle Heights","Lincoln Heights","El Sereno","Glassell Park","Atwater Village","Venice","Mar Vista","Palms","West Los Angeles","Sawtelle","Brentwood","Pacific Palisades","Westwood","Century City","Culver City","Playa Vista","South LA","Leimert Park","Baldwin Hills","Crenshaw","Watts","Wilmington","San Pedro","Harbor City","North Hollywood","Studio City","Sherman Oaks","Van Nuys","Encino","Tarzana","Reseda","Northridge","Chatsworth","Canoga Park","Woodland Hills","Sunland-Tujunga","Sylmar","Pacoima","Arleta","Sun Valley"] },
  chicago: { urlPrefix: "IL/Chicago", regions: ["Loop","South Loop","West Loop","River North","Gold Coast","Streeterville","Old Town","Lincoln Park","Lakeview","Wicker Park","Bucktown","Logan Square","Humboldt Park","Avondale","Lincoln Square","Uptown","Edgewater","Rogers Park","Hyde Park","Bronzeville","Woodlawn","South Shore","Chatham","Englewood","Auburn Gresham","Beverly","Pilsen","Bridgeport","Chinatown","Back of the Yards","Brighton Park","Austin","Garfield Park","North Lawndale","Irving Park","Portage Park","Jefferson Park","Belmont Cragin","South Chicago","Roseland"] },
  miami: { urlPrefix: "FL/Miami", regions: ["Brickell","Downtown Miami","Wynwood","Edgewater","Midtown","Miami Beach","South Beach","North Beach","Coconut Grove","Coral Gables","Little Havana","Little Haiti","Allapattah","Overtown","Design District","Upper East Side","Morningside","Doral","Kendall","Hialeah","Aventura","Sunny Isles Beach","Coral Way","Flagami","Key Biscayne","North Miami","Palmetto Bay","Pinecrest","Cutler Bay","Miami Gardens","Sweetwater","Surfside","Bal Harbour","West Kendall","Fontainebleau","Liberty City"] },
  houston: { urlPrefix: "TX/Houston", regions: ["Downtown","Midtown","Montrose","Heights","River Oaks","Upper Kirby","Galleria","Museum District","Medical Center","Rice Village","West University","Bellaire","Meyerland","Memorial","Spring Branch","Katy","Energy Corridor","Westchase","Sharpstown","Gulfton","Third Ward","East End","Second Ward","EaDo","Northside","Near Northside","Independence Heights","Oak Forest","Garden Oaks","Timbergrove","Lazybrook","Greenway","Braeswood","South Main","Pearland","Sugar Land","Clear Lake","Pasadena","Cypress","Humble","Kingwood","The Woodlands"] },
};

const NEWS_CATEGORIES = ["rental-market", "tenant-rights", "data-insights", "guides", "general"];
const SUBWAY_LINE_SLUGS = [
  "1-train","2-train","3-train","4-train","5-train","6-train","7-train",
  "a-train","c-train","e-train","b-train","d-train","f-train","m-train",
  "g-train","j-train","z-train","l-train","n-train","q-train","r-train",
  "w-train","s-shuttle",
];

function regionSlug(name) {
  return name.toLowerCase().replace(/\s+/g, "-");
}
function cityPath(path, city = "nyc") {
  return `/${CITY_META[city].urlPrefix}${path}`;
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

async function submitAll(urls) {
  const BATCH = 10000;
  let totalSubmitted = 0;
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    process.stdout.write(`  Batch ${Math.floor(i / BATCH) + 1} (${batch.length} URLs)... `);
    const result = await submitBatch(batch);
    if (result.ok) {
      console.log(`✓ (HTTP ${result.status})`);
      totalSubmitted += batch.length;
    } else {
      console.log(`✗ (HTTP ${result.status}): ${result.text}`);
    }
    if (i + BATCH < urls.length) await new Promise((r) => setTimeout(r, 500));
  }
  return totalSubmitted;
}

async function main() {
  const urls = [];

  // ── 1. Static pages ──
  console.log("Adding static pages...");
  urls.push(HOST);
  for (const p of ["/about", "/contact", "/privacy", "/terms", "/guides/nyc-tenant-rights", "/rent-affordability-calculator", "/rent-timing-calculator"]) {
    urls.push(`${HOST}${p}`);
  }

  // ── 2. City-level pages ──
  console.log("Adding city pages...");
  const cityPages = ["/buildings", "/landlords", "/worst-rated-buildings", "/feed", "/crime", "/rent-stabilization", "/map", "/search", "/news", "/rent-data", "/scaffolding", "/permits", "/energy", "/transit", "/tenant-rights", "/tenant-tools", "/tenant-tools/templates", "/rankings", "/affordable-housing", "/heating-tracker", "/compare", "/problem-landlords", "/lead-safety", "/encampments"];
  for (const city of VALID_CITIES) {
    urls.push(`${HOST}${cityPath("", city)}`);
    for (const page of cityPages) urls.push(`${HOST}${cityPath(page, city)}`);
    for (const cat of NEWS_CATEGORIES) urls.push(`${HOST}${cityPath(`/news/${cat}`, city)}`);
    for (const region of CITY_META[city].regions) urls.push(`${HOST}${cityPath(`/buildings/${regionSlug(region)}`, city)}`);
  }

  // ── 3. Subway line pages ──
  for (const slug of SUBWAY_LINE_SLUGS) urls.push(`${HOST}/nyc/apartments-near/${slug}`);

  // ── 4. Neighborhood + crime/zip pages via SQL ──
  console.log("Fetching distinct zip codes via SQL...");
  const { data: zipRows, error: zipErr } = await supabase.rpc("exec_sql", {
    query: "SELECT DISTINCT zip_code, metro FROM buildings WHERE zip_code IS NOT NULL"
  }).maybeSingle();

  // If exec_sql RPC doesn't exist, fall back to per-metro queries
  if (zipErr) {
    console.log("  exec_sql not available, fetching per metro...");
    for (const metro of VALID_CITIES) {
      const { data, error } = await supabase
        .from("buildings")
        .select("zip_code")
        .eq("metro", metro)
        .not("zip_code", "is", null)
        .limit(5000);
      if (error) { console.error(`  ${metro} zip error:`, error.message); continue; }
      if (!data) continue;
      const zips = new Set(data.map(b => b.zip_code).filter(Boolean));
      for (const zip of zips) {
        urls.push(`${HOST}${cityPath(`/neighborhood/${zip}`, metro)}`);
        urls.push(`${HOST}${cityPath(`/crime/${zip}`, metro)}`);
      }
      console.log(`  ${metro}: ${zips.size} unique zips`);
    }
  } else if (zipRows) {
    const rows = Array.isArray(zipRows) ? zipRows : [];
    for (const r of rows) {
      const metro = r.metro || "nyc";
      urls.push(`${HOST}${cityPath(`/neighborhood/${r.zip_code}`, metro)}`);
      urls.push(`${HOST}${cityPath(`/crime/${r.zip_code}`, metro)}`);
    }
    console.log(`  Found ${rows.length} distinct zips`);
  }

  // ── 5. Landlord pages — paginate without ORDER BY using slug cursor ──
  console.log("Fetching landlords...");
  let landlordCount = 0;
  let slugCursor = "";
  while (true) {
    const { data, error } = await supabase
      .from("landlord_stats")
      .select("slug")
      .not("slug", "is", null)
      .gt("slug", slugCursor)
      .order("slug", { ascending: true })
      .limit(2000);

    if (error) { console.error("  Landlord query error:", error.message); break; }
    if (!data || data.length === 0) break;

    for (const l of data) {
      if (l.slug) urls.push(`${HOST}/nyc/landlord/${l.slug}`);
    }
    landlordCount += data.length;
    slugCursor = data[data.length - 1].slug;

    if (landlordCount % 10000 < 2000) console.log(`  ${landlordCount.toLocaleString()} landlords...`);
    if (data.length < 2000) break;
  }
  console.log(`  Total landlords: ${landlordCount.toLocaleString()}`);

  // ── 6. News articles ──
  console.log("Fetching news articles...");
  const { data: articles } = await supabase
    .from("news_articles")
    .select("slug")
    .order("published_at", { ascending: false })
    .limit(5000);
  if (articles) {
    for (const a of articles) urls.push(`${HOST}${cityPath(`/news/${a.slug}`)}`);
    console.log(`  Found ${articles.length} articles`);
  }

  // ── Submit ──
  console.log(`\nTotal URLs to submit: ${urls.length.toLocaleString()}`);
  const totalSubmitted = await submitAll(urls);
  console.log(`\nDone! Submitted ${totalSubmitted.toLocaleString()} URLs to IndexNow.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
