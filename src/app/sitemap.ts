import type { MetadataRoute } from "next";
import {
  buildingUrl,
  landlordSlug,
  cityPath,
  neighborhoodUrl,
  regionSlug,
} from "@/lib/seo";
import { CITY_META, VALID_CITIES, type City } from "@/lib/cities";
import { NEWS_CATEGORIES } from "@/lib/news-sources";
import { SUBWAY_LINES, transitLineUrl } from "@/lib/subway-lines";

export const dynamic = "force-dynamic";

const BASE_URL = "https://lucidrents.com";
const BUILDINGS_PER_SITEMAP = 10000;
const LANDLORDS_PER_SITEMAP = 10000;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// --- Supabase helper ---

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

async function supabaseFetchWithCount(path: string): Promise<number> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_KEY, Prefer: "count=exact" },
    });
    const range = res.headers.get("content-range");
    return range ? parseInt(range.split("/")[1] || "0", 10) : 0;
  } catch {
    return 0;
  }
}

// Upper bounds for sitemap index generation.
// generateSitemaps() runs at build time when DB env vars may not be available,
// so we use generous upper bounds. The sitemap() function returns [] for
// IDs beyond actual data, which search engines handle gracefully.
const MAX_LANDLORD_SITEMAPS = 70; // ~700k landlords / 10k per sitemap
const MAX_BUILDING_SITEMAPS = 120; // ~1.2M buildings / 10k per sitemap

/**
 * Sitemap index layout:
 *   0           = static pages, neighborhoods, crime zips, transit, news
 *   1..70       = landlord pages in batches of 10,000
 *   71..190     = building pages in batches of 10,000
 */
export async function generateSitemaps() {
  const total = 1 + MAX_LANDLORD_SITEMAPS + MAX_BUILDING_SITEMAPS;
  return Array.from({ length: total }, (_, i) => ({ id: i }));
}

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  const numId = Number(id);

  if (numId === 0) {
    return generateStaticSitemap();
  }

  // Sitemaps 1..MAX_LANDLORD_SITEMAPS = landlords
  // Sitemaps MAX_LANDLORD_SITEMAPS+1.. = buildings
  if (numId <= MAX_LANDLORD_SITEMAPS) {
    return generateLandlordSitemap(numId - 1);
  }

  const buildingBatchIndex = numId - 1 - MAX_LANDLORD_SITEMAPS;
  return generateBuildingSitemap(buildingBatchIndex);
}

// --- Static sitemap (id=0) ---

async function generateStaticSitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // Homepage
  entries.push({
    url: BASE_URL,
    changeFrequency: "daily",
    priority: 1.0,
  });

  // Static root pages
  const rootPages = [
    { path: "/about", freq: "monthly" as const, priority: 0.5 },
    { path: "/contact", freq: "monthly" as const, priority: 0.5 },
    { path: "/privacy", freq: "monthly" as const, priority: 0.3 },
    { path: "/terms", freq: "monthly" as const, priority: 0.3 },
    { path: "/guides/nyc-tenant-rights", freq: "monthly" as const, priority: 0.7 },
    { path: "/guides/la-tenant-rights", freq: "monthly" as const, priority: 0.7 },
    { path: "/rent-calculator", freq: "weekly" as const, priority: 0.8 },
  ];
  for (const page of rootPages) {
    entries.push({
      url: `${BASE_URL}${page.path}`,
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

  // Neighborhood + crime pages by zip code
  const zipData = await supabaseFetch<
    { zip_code: string }[]
  >("buildings?select=zip_code&zip_code=not.is.null&limit=10000");

  if (zipData) {
    const uniqueZips = [...new Set(zipData.map((b) => b.zip_code).filter(Boolean))];
    for (const zip of uniqueZips) {
      entries.push({
        url: `${BASE_URL}${neighborhoodUrl(zip)}`,
        changeFrequency: "weekly",
        priority: 0.7,
      });
      entries.push({
        url: `${BASE_URL}${cityPath(`/crime/${zip}`)}`,
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
      changeFrequency: "monthly",
      priority: 0.4,
    });
  }

  return entries;
}

// --- Landlord sitemaps (id=1..L) ---

async function generateLandlordSitemap(
  batchIndex: number
): Promise<MetadataRoute.Sitemap> {
  const offset = batchIndex * LANDLORDS_PER_SITEMAP;

  const landlords = await supabaseFetch<
    { slug: string }[]
  >(
    `landlord_stats?select=slug&order=name.asc&offset=${offset}&limit=${LANDLORDS_PER_SITEMAP}`
  );

  if (!landlords || landlords.length === 0) return [];

  return landlords.map((l) => ({
    url: `${BASE_URL}/nyc/landlord/${l.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));
}

// --- Building sitemaps (id=L+1..L+B) ---

async function generateBuildingSitemap(
  batchIndex: number
): Promise<MetadataRoute.Sitemap> {
  const offset = batchIndex * BUILDINGS_PER_SITEMAP;

  const buildings = await supabaseFetch<
    { slug: string; borough: string; metro: string; updated_at: string | null }[]
  >(
    `buildings?select=slug,borough,metro,updated_at&order=id.asc&offset=${offset}&limit=${BUILDINGS_PER_SITEMAP}`
  );

  if (!buildings || buildings.length === 0) return [];

  return buildings.map((b) => ({
    url: `${BASE_URL}${buildingUrl(b, (b.metro === "los-angeles" ? "los-angeles" : b.metro === "chicago" ? "chicago" : b.metro === "miami" ? "miami" : b.metro === "houston" ? "houston" : "nyc") as City)}`,
    lastModified: b.updated_at ? new Date(b.updated_at) : undefined,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));
}
