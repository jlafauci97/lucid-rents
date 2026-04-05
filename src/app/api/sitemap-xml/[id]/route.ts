import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { VALID_CITIES, CITY_META, type City } from "@/lib/cities";

/**
 * Child sitemap — serves building/landlord/static URLs on demand.
 * Served at /sitemap/:id.xml via rewrite in next.config.ts.
 * Cached at the edge for 24h.
 */

const BASE = "https://lucidrents.com";
const BUILDING_SITEMAPS = 80;
const PAGE_SIZE = 50_000;

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

function toXml(entries: { url: string; lastmod?: string; changefreq?: string; priority?: number }[]) {
  const urls = entries
    .map((e) => {
      let xml = `  <url>\n    <loc>${e.url}</loc>`;
      if (e.lastmod) xml += `\n    <lastmod>${e.lastmod}</lastmod>`;
      if (e.changefreq) xml += `\n    <changefreq>${e.changefreq}</changefreq>`;
      if (e.priority !== undefined) xml += `\n    <priority>${e.priority}</priority>`;
      return xml + "\n  </url>";
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

// ─── Static pages (id=0) ──────────────────────────────────────

function staticEntries() {
  const now = new Date().toISOString();
  const entries: { url: string; lastmod?: string; changefreq?: string; priority?: number }[] = [];

  entries.push({ url: BASE, lastmod: now, changefreq: "daily", priority: 1.0 });
  for (const p of [
    { path: "/about", freq: "monthly", pri: 0.5 },
    { path: "/contact", freq: "monthly", pri: 0.5 },
    { path: "/privacy", freq: "monthly", pri: 0.3 },
    { path: "/terms", freq: "monthly", pri: 0.3 },
    { path: "/guides/nyc-tenant-rights", freq: "monthly", pri: 0.7 },
  ]) {
    entries.push({ url: `${BASE}${p.path}`, lastmod: now, changefreq: p.freq, priority: p.pri });
  }

  const pages = ["/buildings", "/landlords", "/worst-rated-buildings", "/feed", "/crime", "/rent-stabilization", "/search", "/news", "/rent-data", "/scaffolding", "/permits", "/energy", "/transit", "/tenant-rights"];
  for (const city of VALID_CITIES) {
    for (const page of pages) {
      entries.push({ url: `${BASE}${cityPath(page, city)}`, lastmod: now, changefreq: page === "/news" ? "daily" : "weekly", priority: 0.8 });
    }
    for (const region of CITY_META[city].regions) {
      entries.push({ url: `${BASE}${cityPath(`/buildings/${regionSlug(region)}`, city)}`, changefreq: "weekly", priority: 0.8 });
    }
  }

  return entries;
}

// ─── Building/landlord pages ──────────────────────────────────

async function buildingEntries(page: number) {
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
    lastmod: b.updated_at ? new Date(b.updated_at).toISOString() : undefined,
    changefreq: "weekly",
    priority: 0.6,
  }));
}

async function landlordEntries(page: number) {
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
    lastmod: l.updated_at ? new Date(l.updated_at).toISOString() : undefined,
    changefreq: "monthly",
    priority: 0.5,
  }));
}

// ─── Handler ──────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id) || id < 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  let entries: { url: string; lastmod?: string; changefreq?: string; priority?: number }[];

  if (id === 0) {
    entries = staticEntries();
  } else if (id <= BUILDING_SITEMAPS) {
    entries = await buildingEntries(id - 1);
  } else {
    entries = await landlordEntries(id - 1 - BUILDING_SITEMAPS);
  }

  return new NextResponse(toXml(entries), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
    },
  });
}
