import type { MetadataRoute } from "next";
import { BOROUGH_SLUGS, buildingUrl, landlordSlug, cityPath, neighborhoodUrl } from "@/lib/seo";
import { NEWS_CATEGORIES } from "@/lib/news-sources";
import { SUBWAY_LINES, transitLineUrl } from "@/lib/subway-lines";

// Revalidate every 6 hours — fast responses for crawlers, stays reasonably fresh
export const revalidate = 21600;

const BASE_URL = "https://lucidrents.com";
const BUILDINGS_PER_SITEMAP = 45000;

/**
 * Generate sitemap index entries. Next.js calls this to determine
 * how many sub-sitemaps exist (accessed as /sitemap/0.xml, /sitemap/1.xml, etc.)
 *
 * Sitemap 0: static pages, borough directories, neighborhoods, crime, top landlords
 * Sitemap 1+: building pages in batches of 45,000
 */
export async function generateSitemaps() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buildings?select=id&limit=1&offset=0`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Prefer: "count=exact",
      },
    }
  );

  const countHeader = res.headers.get("content-range");
  const totalBuildings = countHeader
    ? parseInt(countHeader.split("/")[1] || "0", 10)
    : 50000;

  const buildingSitemapCount = Math.ceil(totalBuildings / BUILDINGS_PER_SITEMAP);

  // Sitemap 0 = static + directories, sitemaps 1..N = buildings
  return Array.from({ length: 1 + buildingSitemapCount }, (_, i) => ({ id: i }));
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
  return generateBuildingSitemap(numId - 1);
}

async function generateStaticSitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // Homepage (stays at root)
  entries.push({
    url: BASE_URL,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 1.0,
  });

  // Static root pages (not city-specific)
  const rootPages = [
    { path: "/about", freq: "monthly" as const, priority: 0.5 },
    { path: "/contact", freq: "monthly" as const, priority: 0.5 },
    { path: "/privacy", freq: "monthly" as const, priority: 0.3 },
    { path: "/terms", freq: "monthly" as const, priority: 0.3 },
    { path: "/guides/nyc-tenant-rights", freq: "monthly" as const, priority: 0.7 },
  ];
  for (const page of rootPages) {
    entries.push({
      url: `${BASE_URL}${page.path}`,
      lastModified: new Date(),
      changeFrequency: page.freq,
      priority: page.priority,
    });
  }

  // Static city-specific pages
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
  ];
  for (const page of staticPages) {
    entries.push({
      url: `${BASE_URL}${cityPath(page)}`,
      lastModified: new Date(),
      changeFrequency: page === "/news" ? "daily" : "weekly",
      priority: 0.8,
    });
  }

  // News category pages
  for (const category of Object.keys(NEWS_CATEGORIES)) {
    entries.push({
      url: `${BASE_URL}${cityPath(`/news/${category}`)}`,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  // Transit line pages (all 23 subway lines)
  for (const line of SUBWAY_LINES) {
    entries.push({
      url: `${BASE_URL}${transitLineUrl(line.slug)}`,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  // Borough directory pages
  for (const slug of Object.values(BOROUGH_SLUGS)) {
    entries.push({
      url: `${BASE_URL}${cityPath(`/buildings/${slug}`)}`,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // Neighborhood + crime zip pages — include updated_at for accurate lastmod
  const zipRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buildings?select=zip_code,updated_at&limit=1000`,
    {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    }
  );
  if (zipRes.ok) {
    const zipData = (await zipRes.json()) as { zip_code: string; updated_at: string | null }[];
    // Group by zip code and find most recent updated_at per zip
    const zipLastMod = new Map<string, Date>();
    for (const b of zipData) {
      if (!b.zip_code) continue;
      if (b.updated_at) {
        const d = new Date(b.updated_at);
        const existing = zipLastMod.get(b.zip_code);
        if (!existing || d > existing) zipLastMod.set(b.zip_code, d);
      } else if (!zipLastMod.has(b.zip_code)) {
        zipLastMod.set(b.zip_code, new Date());
      }
    }

    for (const [zip, lastMod] of zipLastMod) {
      entries.push({
        url: `${BASE_URL}${neighborhoodUrl(zip)}`,
        lastModified: lastMod,
        changeFrequency: "weekly",
        priority: 0.7,
      });
      entries.push({
        url: `${BASE_URL}${cityPath(`/crime/${zip}`)}`,
        lastModified: lastMod,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }

  // Top landlords — fetch distinct owner names with most recent update
  const landlordRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buildings?select=owner_name,updated_at&owner_name=not.is.null&order=owner_name.asc&limit=2000`,
    {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    }
  );
  if (landlordRes.ok) {
    const landlordData = (await landlordRes.json()) as { owner_name: string; updated_at: string | null }[];
    // Group by owner and find most recent updated_at
    const landlordLastMod = new Map<string, Date>();
    for (const b of landlordData) {
      if (b.updated_at) {
        const d = new Date(b.updated_at);
        const existing = landlordLastMod.get(b.owner_name);
        if (!existing || d > existing) landlordLastMod.set(b.owner_name, d);
      } else if (!landlordLastMod.has(b.owner_name)) {
        landlordLastMod.set(b.owner_name, new Date());
      }
    }

    for (const [name, lastMod] of landlordLastMod) {
      entries.push({
        url: `${BASE_URL}${cityPath(`/landlord/${landlordSlug(name)}`)}`,
        lastModified: lastMod,
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  }

  // Individual news articles
  const newsRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/news_articles?select=slug,published_at&order=published_at.desc&limit=500`,
    {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    }
  );
  if (newsRes.ok) {
    const articles = (await newsRes.json()) as { slug: string; published_at: string }[];
    for (const article of articles) {
      entries.push({
        url: `${BASE_URL}${cityPath(`/news/${article.slug}`)}`,
        lastModified: new Date(article.published_at),
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  }

  // Compare page
  entries.push({
    url: `${BASE_URL}${cityPath("/compare")}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.4,
  });

  return entries;
}

async function generateBuildingSitemap(
  batchIndex: number
): Promise<MetadataRoute.Sitemap> {
  const offset = batchIndex * BUILDINGS_PER_SITEMAP;

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buildings?select=slug,borough,updated_at&order=id.asc&offset=${offset}&limit=${BUILDINGS_PER_SITEMAP}`,
    {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    }
  );

  if (!res.ok) return [];

  const buildings = (await res.json()) as {
    slug: string;
    borough: string;
    updated_at: string | null;
  }[];

  return buildings.map((b) => ({
    url: `${BASE_URL}${buildingUrl(b)}`,
    lastModified: b.updated_at ? new Date(b.updated_at) : undefined,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));
}
