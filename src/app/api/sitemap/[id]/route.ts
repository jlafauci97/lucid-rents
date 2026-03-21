import { NextResponse } from "next/server";
import {
  BOROUGH_SLUGS,
  buildingUrl,
  landlordSlug,
  cityPath,
  neighborhoodUrl,
} from "@/lib/seo";
import { NEWS_CATEGORIES } from "@/lib/news-sources";
import { SUBWAY_LINES, transitLineUrl } from "@/lib/subway-lines";

const BASE_URL = "https://lucidrents.com";
const BUILDINGS_PER_SITEMAP = 25000;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Individual sitemap: /sitemap/[id].xml
 * id=0 → static pages (homepage, boroughs, neighborhoods, landlords, news, transit)
 * id=1+ → buildings in batches of 25,000
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  // Strip .xml suffix if present (rewrite sends "0.xml")
  const id = parseInt(rawId.replace(/\.xml$/, ""), 10);

  if (isNaN(id) || id < 0) {
    return new NextResponse("Not Found", { status: 404 });
  }

  let urls: SitemapEntry[];

  if (id === 0) {
    urls = await generateStaticSitemap();
  } else {
    urls = await generateBuildingSitemap(id - 1);
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
  ];
  for (const page of staticPages) {
    entries.push({
      url: `${BASE_URL}${cityPath(page)}`,
      lastModified: now,
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

  // Transit line pages
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

  // Neighborhood + crime pages by zip code
  const zipData = await supabaseFetch<
    { zip_code: string; updated_at: string | null }[]
  >("buildings?select=zip_code,updated_at&zip_code=not.is.null&limit=10000");

  if (zipData) {
    const zipLastMod = new Map<string, Date>();
    for (const b of zipData) {
      if (!b.zip_code) continue;
      const d = b.updated_at ? new Date(b.updated_at) : now;
      const existing = zipLastMod.get(b.zip_code);
      if (!existing || d > existing) zipLastMod.set(b.zip_code, d);
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

  // Top landlords
  const landlordData = await supabaseFetch<
    { owner_name: string; updated_at: string | null }[]
  >(
    "buildings?select=owner_name,updated_at&owner_name=not.is.null&order=owner_name.asc&limit=5000"
  );

  if (landlordData) {
    const landlordLastMod = new Map<string, Date>();
    for (const b of landlordData) {
      const d = b.updated_at ? new Date(b.updated_at) : now;
      const existing = landlordLastMod.get(b.owner_name);
      if (!existing || d > existing)
        landlordLastMod.set(b.owner_name, d);
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

  // News articles
  const articles = await supabaseFetch<
    { slug: string; published_at: string }[]
  >(
    "news_articles?select=slug,published_at&order=published_at.desc&limit=1000"
  );

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

  // Compare page
  entries.push({
    url: `${BASE_URL}${cityPath("/compare")}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.4,
  });

  return entries;
}

// --- Building sitemap (id=1+) ---

async function generateBuildingSitemap(
  batchIndex: number
): Promise<SitemapEntry[]> {
  const offset = batchIndex * BUILDINGS_PER_SITEMAP;

  const buildings = await supabaseFetch<
    { slug: string; borough: string; updated_at: string | null }[]
  >(
    `buildings?select=slug,borough,updated_at&order=id.asc&offset=${offset}&limit=${BUILDINGS_PER_SITEMAP}`
  );

  if (!buildings || buildings.length === 0) return [];

  return buildings.map((b) => ({
    url: `${BASE_URL}${buildingUrl(b)}`,
    lastModified: b.updated_at ? new Date(b.updated_at) : undefined,
    changeFrequency: "weekly",
    priority: 0.6,
  }));
}
