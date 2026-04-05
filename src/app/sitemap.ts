import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { VALID_CITIES, CITY_META, type City } from "@/lib/cities";

/**
 * Dynamic sitemap — queries Supabase on demand (not at build time).
 *
 * Uses a fixed number of sitemap IDs (100) to avoid needing to query
 * counts at build time. Each sitemap fetches its page of buildings/landlords
 * on demand. Vercel caches the SSG output.
 */

const BASE = "https://lucidrents.com";

// Fixed sitemap allocation: 0=static, 1-80=buildings, 81-99=landlords
const BUILDING_SITEMAPS = 80;
const LANDLORD_SITEMAPS = 20;
const TOTAL_SITEMAPS = 1 + BUILDING_SITEMAPS + LANDLORD_SITEMAPS;
const PAGE_SIZE = 50_000; // Max URLs per sitemap (Google limit)

function regionSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function cityPath(path: string, city: City) {
  return `/${CITY_META[city].urlPrefix}${path}`;
}

function metroToCity(metro: string | null): City {
  if (metro && VALID_CITIES.includes(metro as City)) return metro as City;
  return "nyc";
}

export async function generateSitemaps() {
  return Array.from({ length: TOTAL_SITEMAPS }, (_, i) => ({ id: i }));
}

export default async function sitemap(
  props: { id: number | Promise<number> }
): Promise<MetadataRoute.Sitemap> {
  const id = await Promise.resolve(props.id);

  if (id === 0) return staticPages();

  if (id <= BUILDING_SITEMAPS) {
    return buildingPage(id - 1);
  }

  return landlordPage(id - 1 - BUILDING_SITEMAPS);
}

// ─── Static pages ─────────────────────────────────────────────

function staticPages(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();
  const entries: MetadataRoute.Sitemap = [];

  entries.push({ url: BASE, lastModified: now, changeFrequency: "daily", priority: 1.0 });

  for (const p of [
    { path: "/about", freq: "monthly" as const, pri: 0.5 },
    { path: "/contact", freq: "monthly" as const, pri: 0.5 },
    { path: "/privacy", freq: "monthly" as const, pri: 0.3 },
    { path: "/terms", freq: "monthly" as const, pri: 0.3 },
    { path: "/guides/nyc-tenant-rights", freq: "monthly" as const, pri: 0.7 },
  ]) {
    entries.push({ url: `${BASE}${p.path}`, lastModified: now, changeFrequency: p.freq, priority: p.pri });
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

// ─── Building pages ───────────────────────────────────────────

async function buildingPage(page: number): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient();
  const from = page * PAGE_SIZE;
  const { data } = await supabase
    .from("buildings")
    .select("slug, borough, metro, updated_at")
    .not("slug", "is", null)
    .not("borough", "is", null)
    .order("id")
    .range(from, from + PAGE_SIZE - 1);

  return (data ?? []).map((b) => ({
    url: `${BASE}/${CITY_META[metroToCity(b.metro)].urlPrefix}/building/${regionSlug(b.borough)}/${b.slug}`,
    lastModified: b.updated_at ? new Date(b.updated_at).toISOString() : undefined,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));
}

// ─── Landlord pages ───────────────────────────────────────────

async function landlordPage(page: number): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient();
  const from = page * PAGE_SIZE;
  const { data } = await supabase
    .from("landlord_stats")
    .select("slug, metro, updated_at")
    .not("slug", "is", null)
    .order("name")
    .range(from, from + PAGE_SIZE - 1);

  return (data ?? []).map((l) => ({
    url: `${BASE}/${CITY_META[metroToCity(l.metro)].urlPrefix}/landlord/${l.slug}`,
    lastModified: l.updated_at ? new Date(l.updated_at).toISOString() : undefined,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));
}
