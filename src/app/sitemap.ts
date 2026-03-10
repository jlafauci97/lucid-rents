import type { MetadataRoute } from "next";
import { BOROUGH_SLUGS, buildingUrl, landlordSlug, cityPath } from "@/lib/seo";
import { NEWS_CATEGORIES } from "@/lib/news-sources";

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
    changeFrequency: "daily",
    priority: 1.0,
  });

  // Static city-specific pages
  const staticPages = [
    "/buildings",
    "/landlords",
    "/rankings",
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
  ];
  for (const page of staticPages) {
    entries.push({
      url: `${BASE_URL}${cityPath(page)}`,
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

  // Borough directory pages
  for (const slug of Object.values(BOROUGH_SLUGS)) {
    entries.push({
      url: `${BASE_URL}${cityPath(`/buildings/${slug}`)}`,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // Neighborhood + crime zip pages
  const zipRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buildings?select=zip_code&limit=1000`,
    {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    }
  );
  if (zipRes.ok) {
    const zipData = await zipRes.json();
    const zipCodes = [
      ...new Set(
        (zipData as { zip_code: string }[])
          .map((b) => b.zip_code)
          .filter(Boolean)
      ),
    ] as string[];

    for (const zip of zipCodes) {
      entries.push({
        url: `${BASE_URL}${cityPath(`/neighborhood/${zip}`)}`,
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

  // Top landlords — fetch distinct owner names
  const landlordRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buildings?select=owner_name&owner_name=not.is.null&order=owner_name.asc&limit=2000`,
    {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    }
  );
  if (landlordRes.ok) {
    const landlordData = await landlordRes.json();
    const uniqueNames = [
      ...new Set(
        (landlordData as { owner_name: string }[]).map((b) => b.owner_name)
      ),
    ];
    for (const name of uniqueNames) {
      entries.push({
        url: `${BASE_URL}${cityPath(`/landlord/${landlordSlug(name)}`)}`,
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  }

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
