/**
 * Static sitemap generator.
 *
 * Queries Supabase once, writes XML files to public/sitemap/.
 * These are served as static CDN assets — zero function execution.
 *
 * Usage:
 *   npx tsx scripts/generate-sitemaps.ts
 *
 * Run as part of the Vercel build: "build": "tsx scripts/generate-sitemaps.ts && next build"
 */

import { writeFileSync, mkdirSync, rmSync } from "fs";
import { buildingUrl, cityPath, neighborhoodUrl, regionSlug } from "../src/lib/seo";
import { CITY_META, VALID_CITIES, type City } from "../src/lib/cities";
import { NEWS_CATEGORIES } from "../src/lib/news-sources";
import { SUBWAY_LINES, transitLineUrl } from "../src/lib/subway-lines";

const BASE_URL = "https://lucidrents.com";
const OUT_DIR = "public/sitemap";
const CONCURRENCY = 5; // max parallel Supabase requests
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

// ─── Supabase helpers ───────────────────────────────────────────

async function supabaseFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${path}`);
  return (await res.json()) as T;
}

async function rpcFetch<T>(fn: string, params: Record<string, unknown>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error(`RPC ${fn} ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      if (attempt === 4) throw err;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  throw new Error("unreachable");
}

// ─── XML builders ───────────────────────────────────────────────

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface SitemapEntry {
  url: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

function buildSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map((e) => {
      let xml = `  <url>\n    <loc>${escapeXml(e.url)}</loc>`;
      if (e.lastmod) xml += `\n    <lastmod>${e.lastmod}</lastmod>`;
      if (e.changefreq) xml += `\n    <changefreq>${e.changefreq}</changefreq>`;
      if (e.priority !== undefined) xml += `\n    <priority>${e.priority}</priority>`;
      return xml + "\n  </url>";
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

function buildSitemapIndex(files: { name: string; lastmod: string }[]): string {
  const entries = files
    .map(
      (f) =>
        `  <sitemap>\n    <loc>${BASE_URL}/sitemap/${f.name}</loc>\n    <lastmod>${f.lastmod}</lastmod>\n  </sitemap>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>`;
}

// ─── Batch runner ───────────────────────────────────────────────

async function runBatches<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  let i = 0;
  async function next(): Promise<void> {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => next()));
  return results;
}

// ─── Helpers ────────────────────────────────────────────────────

function metroToCity(metro: string): City {
  if (metro === "los-angeles") return "los-angeles";
  if (metro === "chicago") return "chicago";
  if (metro === "miami") return "miami";
  if (metro === "houston") return "houston";
  return "nyc";
}

// ─── Static sitemap (0.xml) ────────────────────────────────────

async function generateStaticSitemap(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];
  const now = new Date().toISOString();

  entries.push({ url: BASE_URL, lastmod: now, changefreq: "daily", priority: 1.0 });

  const rootPages = [
    { path: "/about", freq: "monthly", priority: 0.5 },
    { path: "/contact", freq: "monthly", priority: 0.5 },
    { path: "/privacy", freq: "monthly", priority: 0.3 },
    { path: "/terms", freq: "monthly", priority: 0.3 },
    { path: "/guides/nyc-tenant-rights", freq: "monthly", priority: 0.7 },
    { path: "/guides/la-tenant-rights", freq: "monthly", priority: 0.7 },
  ];
  for (const p of rootPages) {
    entries.push({ url: `${BASE_URL}${p.path}`, lastmod: now, changefreq: p.freq, priority: p.priority });
  }

  const staticPages = [
    "/buildings", "/landlords", "/worst-rated-buildings", "/feed", "/crime",
    "/rent-stabilization", "/map", "/search", "/news", "/rent-data",
    "/scaffolding", "/permits", "/energy", "/transit", "/tenant-rights",
  ];
  for (const city of VALID_CITIES) {
    for (const page of staticPages) {
      entries.push({
        url: `${BASE_URL}${cityPath(page, city)}`,
        lastmod: now,
        changefreq: page === "/news" ? "daily" : "weekly",
        priority: 0.8,
      });
    }
  }

  // News categories
  for (const city of VALID_CITIES) {
    for (const cat of Object.keys(NEWS_CATEGORIES)) {
      entries.push({ url: `${BASE_URL}${cityPath(`/news/${cat}`, city)}`, changefreq: "daily", priority: 0.7 });
    }
  }

  // Transit lines
  for (const line of SUBWAY_LINES) {
    entries.push({ url: `${BASE_URL}${transitLineUrl(line.slug)}`, changefreq: "weekly", priority: 0.7 });
  }

  // Region directory pages
  for (const city of VALID_CITIES) {
    for (const region of CITY_META[city].regions) {
      entries.push({
        url: `${BASE_URL}${cityPath(`/buildings/${regionSlug(region)}`, city)}`,
        changefreq: "weekly",
        priority: 0.8,
      });
    }
  }

  // Neighborhoods + crime by zip
  const zipData = await supabaseFetch<{ zip_code: string; metro: string; updated_at: string | null }[]>(
    "buildings?select=zip_code,metro,updated_at&zip_code=not.is.null&limit=10000"
  );
  const zipCityLastMod = new Map<string, string>();
  for (const b of zipData) {
    if (!b.zip_code) continue;
    const city = metroToCity(b.metro);
    const key = `${city}:${b.zip_code}`;
    const d = b.updated_at || now;
    const existing = zipCityLastMod.get(key);
    if (!existing || d > existing) zipCityLastMod.set(key, d);
  }
  for (const [key, lastmod] of zipCityLastMod) {
    const [city, zip] = key.split(":") as [City, string];
    entries.push({ url: `${BASE_URL}${neighborhoodUrl(zip, city)}`, lastmod, changefreq: "weekly", priority: 0.7 });
    entries.push({ url: `${BASE_URL}${cityPath(`/crime/${zip}`, city)}`, lastmod, changefreq: "weekly", priority: 0.6 });
  }

  // News articles
  const articles = await supabaseFetch<{ slug: string; published_at: string }[]>(
    "news_articles?select=slug,published_at&order=published_at.desc&limit=1000"
  );
  for (const a of articles) {
    entries.push({
      url: `${BASE_URL}${cityPath(`/news/${a.slug}`)}`,
      lastmod: new Date(a.published_at).toISOString(),
      changefreq: "monthly",
      priority: 0.5,
    });
  }

  // Compare pages
  for (const city of VALID_CITIES) {
    entries.push({ url: `${BASE_URL}${cityPath("/compare", city)}`, lastmod: now, changefreq: "monthly", priority: 0.4 });
  }

  return entries;
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now();
  console.log("Generating static sitemaps...");

  // Clean and recreate output dir
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const now = new Date().toISOString();
  const indexEntries: { name: string; lastmod: string }[] = [];

  // ── Static sitemap (0.xml) ──
  console.log("  [0.xml] static pages...");
  const staticEntries = await generateStaticSitemap();
  writeFileSync(`${OUT_DIR}/0.xml`, buildSitemapXml(staticEntries));
  indexEntries.push({ name: "0.xml", lastmod: now });
  console.log(`  [0.xml] ${staticEntries.length} URLs`);

  // ── Landlord sitemaps ──
  // Discover max batch from cursor table
  const [maxLandlordBatch] = await supabaseFetch<{ batch_index: number }[]>(
    "sitemap_landlord_cursors?select=batch_index&order=batch_index.desc&limit=1"
  );
  const landlordBatches = maxLandlordBatch ? maxLandlordBatch.batch_index + 1 : 0;
  console.log(`  Generating ${landlordBatches} landlord sitemaps...`);

  let landlordUrls = 0;
  const landlordTasks = Array.from({ length: landlordBatches }, (_, i) => async () => {
    const landlords = await rpcFetch<{ slug: string; updated_at: string | null }[]>(
      "sitemap_landlord_batch",
      { p_batch_index: i }
    );
    if (landlords.length === 0) return;

    const entries: SitemapEntry[] = landlords.map((l) => ({
      url: `${BASE_URL}/nyc/landlord/${l.slug}`,
      lastmod: l.updated_at ? new Date(l.updated_at).toISOString() : undefined,
      changefreq: "monthly",
      priority: 0.5,
    }));

    writeFileSync(`${OUT_DIR}/l-${i}.xml`, buildSitemapXml(entries));
    indexEntries.push({ name: `l-${i}.xml`, lastmod: now });
    landlordUrls += entries.length;
  });
  await runBatches(landlordTasks, CONCURRENCY);
  console.log(`  Landlords: ${landlordUrls.toLocaleString()} URLs across ${landlordBatches} files`);

  // ── Building sitemaps ──
  const [maxBuildingBatch] = await supabaseFetch<{ batch_index: number }[]>(
    "sitemap_building_cursors?select=batch_index&order=batch_index.desc&limit=1"
  );
  const buildingBatches = maxBuildingBatch ? maxBuildingBatch.batch_index + 1 : 0;
  console.log(`  Generating ${buildingBatches} building sitemaps...`);

  let buildingUrls = 0;
  const buildingTasks = Array.from({ length: buildingBatches }, (_, i) => async () => {
    const buildings = await rpcFetch<
      { slug: string; borough: string; metro: string; updated_at: string | null }[]
    >("sitemap_building_batch", { p_batch_index: i });
    if (buildings.length === 0) return;

    const entries: SitemapEntry[] = buildings.map((b) => ({
      url: `${BASE_URL}${buildingUrl(b, metroToCity(b.metro))}`,
      lastmod: b.updated_at ? new Date(b.updated_at).toISOString() : undefined,
      changefreq: "weekly",
      priority: 0.6,
    }));

    writeFileSync(`${OUT_DIR}/b-${i}.xml`, buildSitemapXml(entries));
    indexEntries.push({ name: `b-${i}.xml`, lastmod: now });
    buildingUrls += entries.length;
  });
  await runBatches(buildingTasks, CONCURRENCY);
  console.log(`  Buildings: ${buildingUrls.toLocaleString()} URLs across ${buildingBatches} files`);

  // ── Sitemap index ──
  // Sort: 0.xml first, then l- sorted numerically, then b- sorted numerically
  indexEntries.sort((a, b) => {
    const order = (n: string) => {
      if (n === "0.xml") return "0-0";
      if (n.startsWith("l-")) return `1-${n.slice(2).replace(".xml", "").padStart(6, "0")}`;
      if (n.startsWith("b-")) return `2-${n.slice(2).replace(".xml", "").padStart(6, "0")}`;
      return n;
    };
    return order(a.name).localeCompare(order(b.name));
  });

  // Write sitemap index as index.xml inside the directory
  writeFileSync(`${OUT_DIR}/index.xml`, buildSitemapIndex(indexEntries));

  const totalUrls = staticEntries.length + landlordUrls + buildingUrls;
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `\nDone in ${elapsed}s — ${indexEntries.length} sitemap files, ${totalUrls.toLocaleString()} total URLs`
  );
}

main().catch((err) => {
  console.error("Sitemap generation failed:", err);
  process.exit(1);
});
