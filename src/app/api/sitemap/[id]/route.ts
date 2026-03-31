import { NextResponse } from "next/server";
import {
  buildingUrl,
  cityPath,
  neighborhoodUrl,
  regionSlug,
} from "@/lib/seo";
import { CITY_META, VALID_CITIES, type City } from "@/lib/cities";
import { NEWS_CATEGORIES } from "@/lib/news-sources";
import { SUBWAY_LINES, transitLineUrl } from "@/lib/subway-lines";

const BASE_URL = "https://lucidrents.com";

function metroToCity(metro: string): City {
  if (metro === "los-angeles") return "los-angeles";
  if (metro === "chicago") return "chicago";
  if (metro === "miami") return "miami";
  return "nyc";
}
const ITEMS_PER_SITEMAP = 10000;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Individual sitemap: /sitemap/[id].xml
 * id=0          → static pages (neighborhoods, crime, transit, news — NO landlords)
 * id=1..L       → landlords in batches of 10,000
 * id=L+1..L+B   → buildings in batches of 10,000
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const id = parseInt(rawId.replace(/\.xml$/, ""), 10);

  if (isNaN(id) || id < 0) {
    return new NextResponse("Not Found", { status: 404 });
  }

  let urls: SitemapEntry[];

  if (id === 0) {
    urls = await generateStaticSitemap();
  } else {
    // Determine landlord/building boundary
    const totalLandlords = await getCount("landlord_stats?select=name&limit=1&offset=0", "estimated");
    const landlordSitemapCount = Math.ceil(totalLandlords / ITEMS_PER_SITEMAP);

    if (id <= landlordSitemapCount) {
      urls = await generateLandlordSitemap(id - 1);
    } else {
      const buildingBatchIndex = id - 1 - landlordSitemapCount;
      urls = await generateBuildingSitemap(buildingBatchIndex);
    }
  }

  if (urls.length === 0) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const xml = buildSitemapXml(urls);

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=3600",
    },
  });
}

// --- Types ---

interface SitemapEntry {
  url: string;
  lastModified?: Date;
  changeFrequency?: string;
  priority?: number;
}

// --- XML builder ---

function buildSitemapXml(entries: SitemapEntry[]): string {
  const urlEntries = entries
    .map((e) => {
      let entry = `  <url>\n    <loc>${escapeXml(e.url)}</loc>`;
      if (e.lastModified) {
        entry += `\n    <lastmod>${e.lastModified.toISOString()}</lastmod>`;
      }
      if (e.changeFrequency) {
        entry += `\n    <changefreq>${e.changeFrequency}</changefreq>`;
      }
      if (e.priority !== undefined) {
        entry += `\n    <priority>${e.priority}</priority>`;
      }
      entry += "\n  </url>";
      return entry;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// --- Supabase helpers ---

async function supabaseFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_KEY },
      next: { revalidate: 21600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function getCount(path: string, mode: "exact" | "estimated" = "exact"): Promise<number> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_KEY, Prefer: `count=${mode}` },
      next: { revalidate: 21600 },
    });
    const range = res.headers.get("content-range");
    return range ? parseInt(range.split("/")[1] || "0", 10) : 0;
  } catch {
    return 0;
  }
}

// --- Static sitemap (id=0) ---

async function generateStaticSitemap(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];
  const now = new Date();

  // Homepage
  entries.push({
    url: BASE_URL,
    lastModified: now,
    changeFrequency: "daily",
    priority: 1.0,
  });

  // Static root pages
  const rootPages = [
    { path: "/about", freq: "monthly", priority: 0.5 },
    { path: "/contact", freq: "monthly", priority: 0.5 },
    { path: "/privacy", freq: "monthly", priority: 0.3 },
    { path: "/terms", freq: "monthly", priority: 0.3 },
    { path: "/guides/nyc-tenant-rights", freq: "monthly", priority: 0.7 },
    { path: "/guides/la-tenant-rights", freq: "monthly", priority: 0.7 },
  ];
  for (const page of rootPages) {
    entries.push({
      url: `${BASE_URL}${page.path}`,
      lastModified: now,
      changeFrequency: page.freq,
      priority: page.priority,
    });
  }

  // City-specific static pages
  const staticPages = [
    "/buildings",
    "/landlords",
    "/worst-rated-buildings",
    "/feed",
    "/crime",
    "/rent-stabilization",
    "/map",
    "/search",
    "/news",
    "/rent-data",
    "/scaffolding",
    "/permits",
    "/energy",
    "/transit",
    "/tenant-rights",
  ];
  for (const cityKey of VALID_CITIES) {
    for (const page of staticPages) {
      entries.push({
        url: `${BASE_URL}${cityPath(page, cityKey)}`,
        lastModified: now,
        changeFrequency: page === "/news" ? "daily" : "weekly",
        priority: 0.8,
      });
    }
  }

  // News category pages
  for (const cityKey of VALID_CITIES) {
    for (const category of Object.keys(NEWS_CATEGORIES)) {
      entries.push({
        url: `${BASE_URL}${cityPath(`/news/${category}`, cityKey)}`,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  }

  // Transit line pages
  for (const line of SUBWAY_LINES) {
    entries.push({
      url: `${BASE_URL}${transitLineUrl(line.slug)}`,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  // Region directory pages (boroughs for NYC, areas for LA)
  for (const cityKey of VALID_CITIES) {
    const meta = CITY_META[cityKey];
    for (const region of meta.regions) {
      entries.push({
        url: `${BASE_URL}${cityPath(`/buildings/${regionSlug(region)}`, cityKey)}`,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  }

  // Neighborhood + crime pages by zip code (per city)
  const zipData = await supabaseFetch<
    { zip_code: string; metro: string; updated_at: string | null }[]
  >("buildings?select=zip_code,metro,updated_at&zip_code=not.is.null&limit=10000");

  if (zipData) {
    // Track latest update per (zip, city) pair
    const zipCityLastMod = new Map<string, Date>();
    for (const b of zipData) {
      if (!b.zip_code) continue;
      const city = metroToCity(b.metro);
      const key = `${city}:${b.zip_code}`;
      const d = b.updated_at ? new Date(b.updated_at) : now;
      const existing = zipCityLastMod.get(key);
      if (!existing || d > existing) zipCityLastMod.set(key, d);
    }

    for (const [key, lastMod] of zipCityLastMod) {
      const [city, zip] = key.split(":") as [City, string];
      entries.push({
        url: `${BASE_URL}${neighborhoodUrl(zip, city)}`,
        lastModified: lastMod,
        changeFrequency: "weekly",
        priority: 0.7,
      });
      entries.push({
        url: `${BASE_URL}${cityPath(`/crime/${zip}`, city)}`,
        lastModified: lastMod,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }

  // News articles
  const articles = await supabaseFetch<
    { slug: string; published_at: string }[]
  >("news_articles?select=slug,published_at&order=published_at.desc&limit=1000");

  if (articles) {
    for (const article of articles) {
      entries.push({
        url: `${BASE_URL}${cityPath(`/news/${article.slug}`)}`,
        lastModified: new Date(article.published_at),
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  }

  // Compare page per city
  for (const cityKey of VALID_CITIES) {
    entries.push({
      url: `${BASE_URL}${cityPath("/compare", cityKey)}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    });
  }

  return entries;
}

// --- Landlord sitemaps ---

async function generateLandlordSitemap(
  batchIndex: number
): Promise<SitemapEntry[]> {
  // Use two-step keyset pagination: fetch 1 row at offset to get cursor,
  // then fetch the full batch from that cursor. Avoids timeout on large offsets.
  const skipCount = batchIndex * ITEMS_PER_SITEMAP;
  const startRow = await supabaseFetch<{ name: string }[]>(
    `landlord_stats?select=name&order=name.asc&offset=${skipCount}&limit=1`
  );

  if (!startRow || startRow.length === 0) return [];

  const startName = encodeURIComponent(startRow[0].name);
  const landlords = await supabaseFetch<
    { slug: string; updated_at: string | null }[]
  >(
    `landlord_stats?select=slug,updated_at&name=gte.${startName}&order=name.asc&limit=${ITEMS_PER_SITEMAP}`
  );

  if (!landlords || landlords.length === 0) return [];

  return landlords.map((l) => ({
    url: `${BASE_URL}/nyc/landlord/${l.slug}`,
    lastModified: l.updated_at ? new Date(l.updated_at) : undefined,
    changeFrequency: "monthly",
    priority: 0.5,
  }));
}

// --- Building sitemaps ---

async function generateBuildingSitemap(
  batchIndex: number
): Promise<SitemapEntry[]> {
  // OFFSET on multi-column SELECTs times out for large tables on Supabase.
  // Two-step keyset pagination:
  // 1. Fetch just the UUID at the target offset (single column = fast)
  // 2. Fetch the full batch starting from that UUID
  const skipCount = batchIndex * ITEMS_PER_SITEMAP;
  const cursorRow = await supabaseFetch<{ id: string }[]>(
    `buildings?select=id&order=id.asc&offset=${skipCount}&limit=1`
  );

  if (!cursorRow || cursorRow.length === 0) return [];

  const cursorId = cursorRow[0].id;
  const buildings = await supabaseFetch<
    { slug: string; borough: string; metro: string; updated_at: string | null }[]
  >(
    `buildings?select=slug,borough,metro,updated_at&id=gte.${cursorId}&order=id.asc&limit=${ITEMS_PER_SITEMAP}`
  );

  if (!buildings || buildings.length === 0) return [];

  return buildings.map((b) => ({
    url: `${BASE_URL}${buildingUrl(b, metroToCity(b.metro))}`,
    lastModified: b.updated_at ? new Date(b.updated_at) : undefined,
    changeFrequency: "weekly",
    priority: 0.6,
  }));
}
