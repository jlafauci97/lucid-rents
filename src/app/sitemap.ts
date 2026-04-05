import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { VALID_CITIES, CITY_META, type City } from "@/lib/cities";

/**
 * Dynamic sitemap using Next.js conventions — queries Supabase at build time.
 *
 * Generates /sitemap.xml (index) + /sitemap/0.xml … /sitemap/N.xml as SSG.
 * This avoids Cloudflare bot-protection blocking static XML files and
 * avoids Vercel's 250MB function bundle limit from file tracing.
 */

const BASE = "https://lucidrents.com";
const URLS_PER_SITEMAP = 40_000;

function regionSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function cityPath(path: string, city: City) {
  return `/${CITY_META[city].urlPrefix}${path}`;
}

function buildingUrl(b: { slug: string; borough: string }, city: City) {
  return `/${CITY_META[city].urlPrefix}/building/${regionSlug(b.borough)}/${b.slug}`;
}

function metroToCity(metro: string | null): City {
  if (metro && VALID_CITIES.includes(metro as City)) return metro as City;
  return "nyc";
}

// ─── Count total buildings to calculate sitemap count ──────────

async function countBuildings(): Promise<number> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("buildings")
    .select("id", { count: "exact", head: true })
    .not("slug", "is", null)
    .not("borough", "is", null);
  return count ?? 0;
}

async function countLandlords(): Promise<number> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("landlord_stats")
    .select("slug", { count: "exact", head: true })
    .not("slug", "is", null);
  return count ?? 0;
}

// ─── Generate sitemap IDs ──────────────────────────────────────

export async function generateSitemaps() {
  const [buildingCount, landlordCount] = await Promise.all([
    countBuildings(),
    countLandlords(),
  ]);
  // ID 0 = static pages, then buildings, then landlords
  const buildingPages = Math.ceil(buildingCount / URLS_PER_SITEMAP);
  const landlordPages = Math.ceil(landlordCount / URLS_PER_SITEMAP);
  const total = 1 + buildingPages + landlordPages;
  console.log(
    `[sitemap] ${buildingCount} buildings (${buildingPages} pages), ${landlordCount} landlords (${landlordPages} pages) → ${total} sitemaps`
  );
  return Array.from({ length: total }, (_, i) => ({ id: i }));
}

// ─── Static pages sitemap (id=0) ──────────────────────────────

function staticPages(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();
  const entries: MetadataRoute.Sitemap = [];

  entries.push({ url: BASE, lastModified: now, changeFrequency: "daily", priority: 1.0 });

  for (const p of [
    { path: "/about", freq: "monthly" as const, priority: 0.5 },
    { path: "/contact", freq: "monthly" as const, priority: 0.5 },
    { path: "/privacy", freq: "monthly" as const, priority: 0.3 },
    { path: "/terms", freq: "monthly" as const, priority: 0.3 },
    { path: "/guides/nyc-tenant-rights", freq: "monthly" as const, priority: 0.7 },
  ]) {
    entries.push({ url: `${BASE}${p.path}`, lastModified: now, changeFrequency: p.freq, priority: p.priority });
  }

  const pages = ["/buildings", "/landlords", "/worst-rated-buildings", "/feed", "/crime", "/rent-stabilization", "/search", "/news", "/rent-data", "/scaffolding", "/permits", "/energy", "/transit", "/tenant-rights"];
  for (const city of VALID_CITIES) {
    for (const page of pages) {
      entries.push({ url: `${BASE}${cityPath(page, city)}`, lastModified: now, changeFrequency: page === "/news" ? "daily" : "weekly", priority: 0.8 });
    }
    for (const region of CITY_META[city].regions) {
      entries.push({ url: `${BASE}${cityPath(`/buildings/${regionSlug(region)}`, city)}`, changeFrequency: "weekly", priority: 0.8 });
    }
  }

  return entries;
}

// ─── Building/landlord pages ──────────────────────────────────

async function buildingPage(page: number): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient();
  const from = page * URLS_PER_SITEMAP;
  const { data } = await supabase
    .from("buildings")
    .select("slug, borough, metro, updated_at")
    .not("slug", "is", null)
    .not("borough", "is", null)
    .order("id")
    .range(from, from + URLS_PER_SITEMAP - 1);

  return (data ?? []).map((b) => ({
    url: `${BASE}${buildingUrl(b, metroToCity(b.metro))}`,
    lastModified: b.updated_at ? new Date(b.updated_at).toISOString() : undefined,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));
}

async function landlordPage(page: number): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient();
  const from = page * URLS_PER_SITEMAP;
  const { data } = await supabase
    .from("landlord_stats")
    .select("slug, metro, updated_at")
    .not("slug", "is", null)
    .order("name")
    .range(from, from + URLS_PER_SITEMAP - 1);

  return (data ?? []).map((l) => ({
    url: `${BASE}/${CITY_META[metroToCity(l.metro)].urlPrefix}/landlord/${l.slug}`,
    lastModified: l.updated_at ? new Date(l.updated_at).toISOString() : undefined,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));
}

// ─── Main sitemap export ──────────────────────────────────────

export default async function sitemap(
  props: { id: number | Promise<number> }
): Promise<MetadataRoute.Sitemap> {
  const id = await Promise.resolve(props.id);

  if (id === 0) return staticPages();

  const [buildingCount, landlordCount] = await Promise.all([
    countBuildings(),
    countLandlords(),
  ]);
  const buildingPages = Math.ceil(buildingCount / URLS_PER_SITEMAP);

  if (id <= buildingPages) {
    return buildingPage(id - 1);
  }

  const landlordPageIdx = id - 1 - buildingPages;
  if (landlordPageIdx < Math.ceil(landlordCount / URLS_PER_SITEMAP)) {
    return landlordPage(landlordPageIdx);
  }

  return [];
}
