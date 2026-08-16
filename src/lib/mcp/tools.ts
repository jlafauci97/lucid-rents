import { createCacheClient } from "@/lib/supabase/cache-client";
import { normalizeAddressQuery } from "@/lib/address-normalization";
import { VALID_CITIES, type City } from "@/lib/cities";
import {
  buildingUrl,
  canonicalUrl,
  landlordSlug,
  landlordUrl,
  neighborhoodUrl,
} from "@/lib/seo";
import { getNeighborhoodNameByCity } from "@/lib/neighborhoods";
import { scoreToGrade } from "@/app/[city]/building/[borough]/[slug]/_data";

/**
 * MCP tool implementations. Each returns a plain JSON payload (serialized to
 * text by the handler) and follows the traffic design in
 * docs/superpowers/plans/2026-08-16-mcp-server-scope.md:
 *
 *  - `url`: canonical lucidrents.com page URL, UTM-tagged per tool, so agent
 *    click-through is measurable (utm_source=mcp, utm_medium=<tool>).
 *  - `data_as_of`: ISO date of the data snapshot.
 *  - `more`: what the linked page has that this payload doesn't — assistants
 *    relay that to users ("summary, not substitute").
 *
 * Hard budget: ≤3 Supabase round trips per tool call, every query bounded.
 * Sections fail soft — a broken sub-query nulls its section, never the call.
 */

/** Thrown for user-correctable problems (bad slug, no match). The handler
 * maps it to an MCP tool error result rather than a protocol error. */
export class ToolUserError extends Error {}

type Json = Record<string, unknown>;

const today = () => new Date().toISOString().slice(0, 10);

/** UTM-tag a site path and make it absolute. */
function tagged(path: string, tool: string, anchor?: string): string {
  return `${canonicalUrl(path)}?utm_source=mcp&utm_medium=${tool}${anchor ? `#${anchor}` : ""}`;
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn("[mcp] section query failed (fail-soft):", err);
    return fallback;
  }
}

// Copy of the private helper in src/app/[city]/building/[borough]/[slug]/_data.ts
// (categorizeHpdViolation) — keep the two in sync if the taxonomy changes.
function categorizeHpdViolation(desc: string): string {
  const d = (desc ?? "").toUpperCase();
  if (/MICE|ROACH|INFESTATION|PEST|BED\s?BUG/.test(d)) return "Pest Infestation";
  if (/PAINT|PLASTER/.test(d)) return "Paint/Plaster";
  if (/LEAK|WATER\s+(LEAK|SUPPLY)/.test(d)) return "Water Leak";
  if (/WINDOW|GUARD/.test(d)) return "Window/Guard";
  if (/SMOKE|CARBON|DETECTOR/.test(d)) return "Smoke/CO Detector";
  if (/DOOR|LOCK/.test(d)) return "Door/Lock";
  if (/FLOOR|TILE/.test(d)) return "Flooring";
  if (/HEAT|HOT WATER|BOILER/.test(d)) return "Heat/Hot Water";
  if (/LEAD/.test(d)) return "Lead Paint";
  if (/ELECTRIC|OUTLET|WIRING/.test(d)) return "Electrical";
  if (/ROOF|CEILING/.test(d)) return "Roof/Ceiling";
  if (/MOLD|MILDEW/.test(d)) return "Mold/Mildew";
  if (/ELEVATOR/.test(d)) return "Elevator";
  if (/FIRE\s?ESCAPE|STAIR/.test(d)) return "Fire Escape/Stairs";
  return "Other";
}

// ──────────────────────────────────────────────────────────────
// search_buildings
// ──────────────────────────────────────────────────────────────

export async function searchBuildings(query: string, city?: City): Promise<Json> {
  const supabase = createCacheClient();
  const { abbreviated, expanded } = normalizeAddressQuery(query);
  // Same call shape and bounds as /api/search (src/app/api/search/route.ts).
  const { data, error } = await supabase.rpc("search_buildings_ranked", {
    search_query: abbreviated,
    search_query_alt: abbreviated !== expanded ? expanded : null,
    city_filter: city || null,
    borough_filter: null,
    zip_filter: null,
    sort_by: "relevance",
    page_offset: 0,
    page_limit: 10,
  });
  if (error) throw new Error(`search failed: ${error.message}`);

  type Row = {
    metro: string;
    slug: string;
    borough: string | null;
    full_address: string | null;
    overall_score: number | null;
    violation_count: number | null;
    review_count: number | null;
    total_count?: number;
  };
  let rows = (data ?? []) as Row[];
  // Unscoped searches post-filter hidden metros, like /api/search does.
  if (!city) {
    rows = rows.filter((r) => (VALID_CITIES as string[]).includes(String(r.metro)));
  }

  return {
    query,
    city: city ?? "all",
    result_count: rows.length,
    results: rows.map((r) => ({
      address: r.full_address,
      slug: r.slug,
      city: r.metro,
      borough: r.borough,
      score: r.overall_score,
      grade: scoreToGrade(r.overall_score),
      violation_count: r.violation_count ?? 0,
      review_count: r.review_count ?? 0,
      url: tagged(
        buildingUrl({ borough: r.borough ?? "", slug: r.slug }, r.metro as City),
        "search_buildings"
      ),
    })),
    data_as_of: today(),
    more: [
      "Each building URL has the full report: violation timeline, all tenant reviews, rent history, landlord portfolio, crime and neighborhood data.",
      "Call get_building_report with a result's city and slug for the structured report card.",
    ],
  };
}

// ──────────────────────────────────────────────────────────────
// get_building_report
// ──────────────────────────────────────────────────────────────

type BuildingRow = {
  id: string;
  metro: City;
  full_address: string;
  borough: string;
  zip_code: string | null;
  slug: string;
  year_built: number | null;
  total_units: number | null;
  overall_score: number | null;
  review_count: number;
  violation_count: number;
  dob_violation_count: number;
  complaint_count: number;
  litigation_count: number;
  eviction_count: number;
  is_rent_stabilized: boolean;
  stabilized_units: number | null;
  owner_name: string | null;
  management_company: string | null;
  building_rents?: Array<{
    bedrooms: number | null;
    min_rent: number | null;
    max_rent: number | null;
    median_rent: number | null;
    listing_count: number | null;
    source: string | null;
  }>;
  reviews?: Array<{ overall_rating: number | null }>;
};

const BUILDING_REPORT_COLUMNS =
  "id, metro, full_address, borough, zip_code, slug, year_built, total_units, overall_score, review_count, violation_count, dob_violation_count, complaint_count, litigation_count, eviction_count, is_rent_stabilized, stabilized_units, owner_name, management_company";

export async function getBuildingReport(city: City, slug: string): Promise<Json> {
  const supabase = createCacheClient();
  const TOOL = "get_building_report";

  // Round trip 1 of 3: building row + embedded rent summary + embedded
  // published review ratings (one PostgREST request). Falls back to the plain
  // row if either embed is unavailable, so a missing FK can't 404 the tool.
  let building: BuildingRow | null = null;
  {
    const { data } = await supabase
      .from("buildings")
      .select(
        `${BUILDING_REPORT_COLUMNS}, building_rents(bedrooms, min_rent, max_rent, median_rent, listing_count, source), reviews(overall_rating)`
      )
      .eq("slug", slug)
      .eq("metro", city)
      .eq("reviews.status", "published")
      .limit(100, { referencedTable: "reviews" })
      .limit(1);
    building = (data?.[0] as BuildingRow | undefined) ?? null;
    if (!building) {
      const { data: plain } = await supabase
        .from("buildings")
        .select(BUILDING_REPORT_COLUMNS)
        .eq("slug", slug)
        .eq("metro", city)
        .limit(1);
      building = (plain?.[0] as BuildingRow | undefined) ?? null;
    }
  }
  if (!building) {
    throw new ToolUserError(
      `No building found for slug "${slug}" in ${city}. Use search_buildings to find the correct slug for an address.`
    );
  }

  // Round trips 2 + 3 of 3, in parallel: HPD violation categories (RPC over
  // grouped counts — same shape the building page's S02 loader uses) and 2-3
  // similar nearby buildings (same zip proxy as the page's S08 data).
  const [violationCategories, similar] = await Promise.all([
    safe(async () => {
      const { data } = await supabase.rpc("building_hpd_desc_counts", {
        _building_id: building.id,
      });
      const counts = new Map<string, number>();
      for (const row of (data ?? []) as Array<{ nov_description: string | null; cnt: number }>) {
        const desc = row.nov_description ?? "";
        if (!desc.trim()) continue;
        const cat = categorizeHpdViolation(desc);
        if (cat === "Other") continue;
        counts.set(cat, (counts.get(cat) ?? 0) + (Number(row.cnt) || 0));
      }
      return Array.from(counts.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    }, [] as Array<{ category: string; count: number }>),
    safe(async () => {
      if (!building.zip_code) return [];
      const { data } = await supabase
        .from("buildings")
        .select("full_address, slug, borough, overall_score, year_built, total_units")
        .eq("zip_code", building.zip_code)
        .eq("metro", city)
        .neq("id", building.id)
        .limit(3);
      return (data ?? []) as Array<{
        full_address: string;
        slug: string;
        borough: string;
        overall_score: number | null;
        year_built: number | null;
        total_units: number | null;
      }>;
    }, []),
  ]);

  const ratings = (building.reviews ?? [])
    .map((r) => r.overall_rating)
    .filter((n): n is number => typeof n === "number");
  const rents = (building.building_rents ?? []).sort(
    (a, b) => (a.bedrooms ?? 99) - (b.bedrooms ?? 99)
  );
  const landlordName = building.owner_name ?? building.management_company;
  const pageUrl = (anchor?: string) =>
    tagged(buildingUrl(building!, city), TOOL, anchor);

  return {
    address: building.full_address,
    city,
    borough: building.borough,
    zip: building.zip_code,
    slug: building.slug,
    score: building.overall_score,
    grade: scoreToGrade(building.overall_score),
    year_built: building.year_built,
    total_units: building.total_units,
    rent_stabilized: building.is_rent_stabilized
      ? { stabilized: true, stabilized_units: building.stabilized_units }
      : { stabilized: false },
    issues: {
      hpd_violations: building.violation_count,
      dob_violations: building.dob_violation_count,
      complaints_311: building.complaint_count,
      litigations: building.litigation_count,
      evictions_filed: building.eviction_count,
      top_violation_categories: violationCategories,
    },
    reviews: {
      count: building.review_count,
      avg_rating: ratings.length
        ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2))
        : null,
    },
    rent_summary: rents.map((r) => ({
      bedrooms: r.bedrooms,
      min_rent: r.min_rent,
      max_rent: r.max_rent,
      median_rent: r.median_rent,
      listing_count: r.listing_count,
      source: r.source,
    })),
    landlord: landlordName
      ? {
          name: landlordName,
          url: tagged(landlordUrl(landlordName, city), TOOL),
        }
      : null,
    similar_nearby: similar.map((s) => ({
      address: s.full_address,
      slug: s.slug,
      score: s.overall_score,
      grade: scoreToGrade(s.overall_score),
      year_built: s.year_built,
      total_units: s.total_units,
      url: tagged(buildingUrl({ borough: s.borough, slug: s.slug }, city), TOOL),
    })),
    url: pageUrl(),
    sections: {
      violations: pageUrl("violations"),
      reviews: pageUrl("reviews"),
      rent_intelligence: pageUrl("rent"),
      landlord: pageUrl("landlord"),
    },
    data_as_of: today(),
    more: [
      "Full violation timeline with dates, classes, and open/closed status per record.",
      "All tenant reviews with full text (this payload has only the count and average).",
      "311 complaint category breakdown, monthly issue trends, and unit-level violation detail.",
      "Rent history charts, neighborhood rent comparison, amenities, crime, transit, and schools.",
      "Use get_review_summary for pull quotes, or get_landlord_record for the owner's full portfolio record.",
    ],
  };
}

// ──────────────────────────────────────────────────────────────
// get_landlord_record
// ──────────────────────────────────────────────────────────────

type LandlordStatsRow = {
  name: string;
  slug: string;
  building_count: number | null;
  total_violations: number | null;
  total_dob_violations: number | null;
  total_complaints: number | null;
  avg_score: number | null;
};

export async function getLandlordRecord(city: City, slugOrName: string): Promise<Json> {
  const supabase = createCacheClient();
  const TOOL = "get_landlord_record";

  // Round trip 1: try the input as a slug (normalized the same way landlord
  // URLs are generated), matching the landlord page's resolveOwnerName shape.
  const asSlug = landlordSlug(slugOrName);
  const { data: bySlug } = await supabase
    .from("landlord_stats")
    .select(
      "name, slug, building_count, total_violations, total_dob_violations, total_complaints, avg_score"
    )
    .eq("slug", asSlug)
    .eq("metro", city)
    .limit(1)
    .maybeSingle();

  let stats = (bySlug as LandlordStatsRow | null) ?? null;
  let worstBuilding: { address: string | null; violations: number | null } | null = null;

  // Round trip 2 (only when the slug misses): resolve by name via the
  // search_landlord_stats RPC — same call shape as /api/landlords.
  if (!stats) {
    const { data, error } = await supabase.rpc("search_landlord_stats", {
      city_filter: city,
      search_query: slugOrName,
      sort_by: "violations",
      page_offset: 0,
      page_limit: 1,
    });
    if (error) throw new Error(`landlord search failed: ${error.message}`);
    const row = (data as Array<Record<string, unknown>> | null)?.[0];
    if (row) {
      stats = {
        name: String(row.name),
        slug: landlordSlug(String(row.name)),
        building_count: (row.building_count as number | null) ?? null,
        total_violations: (row.total_violations as number | null) ?? null,
        total_dob_violations: (row.total_dob_violations as number | null) ?? null,
        total_complaints: (row.total_complaints as number | null) ?? null,
        avg_score: (row.avg_score as number | null) ?? null,
      };
      worstBuilding = {
        address: (row.worst_building_address as string | null) ?? null,
        violations: (row.worst_building_violations as number | null) ?? null,
      };
    }
  }

  if (!stats) {
    throw new ToolUserError(
      `No landlord matching "${slugOrName}" found in ${city}. Try the owner name exactly as it appears on a building report (get_building_report returns it).`
    );
  }

  // NYC/LA lead with HPD-style violations; other metros track DOB-style
  // counts as primary (mirrors the landlord page's dispatch).
  const isAltMetro = city === "chicago";
  return {
    name: stats.name,
    city,
    portfolio_size: stats.building_count ?? 0,
    total_violations: (isAltMetro ? stats.total_dob_violations : stats.total_violations) ?? 0,
    total_dob_violations: stats.total_dob_violations ?? 0,
    total_complaints: stats.total_complaints ?? 0,
    avg_building_score: stats.avg_score,
    avg_building_grade: scoreToGrade(stats.avg_score),
    worst_building: worstBuilding,
    url: tagged(landlordUrl(stats.name, city), TOOL),
    data_as_of: today(),
    more: [
      "Full building-by-building portfolio list with per-building scores and violation counts.",
      "Litigation history, OATH hearings and unpaid penalties (NYC), tenant review excerpts across the portfolio.",
      "Grade distribution, neighborhood concentration map, and comparable landlords.",
    ],
  };
}

// ──────────────────────────────────────────────────────────────
// get_neighborhood_stats
// ──────────────────────────────────────────────────────────────

export async function getNeighborhoodStats(city: City, zip: string): Promise<Json> {
  const supabase = createCacheClient();
  const TOOL = "get_neighborhood_stats";

  // Cache-table reads only (≤3 round trips, in parallel): median rents by
  // bedroom count, plus the pre-aggregated crime caches.
  const [rents, crimeCache, crimeAgg] = await Promise.all([
    safe(async () => {
      const { data } = await supabase
        .from("neighborhood_median_rents")
        .select("bedrooms, median_rent")
        .eq("zip_code", zip)
        .order("bedrooms", { ascending: true })
        .limit(10);
      return (data ?? []) as Array<{ bedrooms: number | null; median_rent: number | null }>;
    }, []),
    safe(async () => {
      const { data } = await supabase
        .from("crime_by_zip_cache")
        .select(
          "total, violent, property, quality_of_life, current_year_total, prior_year_total, refreshed_at"
        )
        .eq("metro", city)
        .eq("zip_code", zip)
        .limit(1);
      return (data?.[0] as {
        total: number | null;
        violent: number | null;
        property: number | null;
        quality_of_life: number | null;
        current_year_total: number | null;
        prior_year_total: number | null;
        refreshed_at: string | null;
      } | undefined) ?? null;
    }, null),
    safe(async () => {
      const { data } = await supabase
        .from("crime_zip_aggregates")
        .select("total_12mo, violent, property, qol")
        .eq("zip", zip)
        .eq("metro", city)
        .limit(1);
      return (data?.[0] as {
        total_12mo: number | null;
        violent: number | null;
        property: number | null;
        qol: number | null;
      } | undefined) ?? null;
    }, null),
  ]);

  if (rents.length === 0 && !crimeCache && !crimeAgg) {
    throw new ToolUserError(
      `No neighborhood data for zip ${zip} in ${city}. Check that the zip code belongs to this city.`
    );
  }

  const crime = crimeCache
    ? {
        total: crimeCache.total,
        violent: crimeCache.violent,
        property: crimeCache.property,
        quality_of_life: crimeCache.quality_of_life,
        current_year_total: crimeCache.current_year_total,
        prior_year_total: crimeCache.prior_year_total,
        refreshed_at: crimeCache.refreshed_at,
      }
    : crimeAgg
      ? {
          total_12mo: crimeAgg.total_12mo,
          violent: crimeAgg.violent,
          property: crimeAgg.property,
          quality_of_life: crimeAgg.qol,
        }
      : null;

  return {
    city,
    zip,
    neighborhood: getNeighborhoodNameByCity(zip, city),
    median_rents_by_bedrooms: rents.map((r) => ({
      bedrooms: r.bedrooms,
      median_rent: r.median_rent,
    })),
    crime,
    url: tagged(neighborhoodUrl(zip, city), TOOL),
    data_as_of: today(),
    more: [
      "Building directory for the neighborhood with scores, violations, and reviews per building.",
      "Rent trend charts over time, demographics, transit access, and school listings.",
      "Use search_buildings with a specific address to drill into any building here.",
    ],
  };
}

// ──────────────────────────────────────────────────────────────
// get_review_summary
// ──────────────────────────────────────────────────────────────

export async function getReviewSummary(city: City, slug: string): Promise<Json> {
  const supabase = createCacheClient();
  const TOOL = "get_review_summary";

  // Round trip 1: resolve the building (unique slug+metro index).
  const { data: buildings } = await supabase
    .from("buildings")
    .select("id, full_address, borough, slug, review_count, overall_score")
    .eq("slug", slug)
    .eq("metro", city)
    .limit(1);
  const building = buildings?.[0] as {
    id: string;
    full_address: string;
    borough: string;
    slug: string;
    review_count: number;
    overall_score: number | null;
  } | undefined;
  if (!building) {
    throw new ToolUserError(
      `No building found for slug "${slug}" in ${city}. Use search_buildings to find the correct slug for an address.`
    );
  }

  // Round trips 2 + 3, in parallel — same query shapes as the building
  // page's S03 loader (_loadReviewsData in the building _data.ts).
  const [aggregate, pullQuotes] = await Promise.all([
    safe(async () => {
      const { data } = await supabase
        .from("reviews")
        .select("overall_rating")
        .eq("building_id", building.id)
        .eq("status", "published");
      const ratings = ((data ?? []) as Array<{ overall_rating: number | null }>)
        .map((r) => r.overall_rating)
        .filter((n): n is number => typeof n === "number");
      const total = ratings.length;
      const avg = total ? ratings.reduce((a, b) => a + b, 0) / total : 0;
      const buckets = [0, 0, 0, 0, 0];
      for (const r of ratings) {
        buckets[Math.max(1, Math.min(5, Math.round(r))) - 1]++;
      }
      return {
        total,
        avg,
        distribution: [5, 4, 3, 2, 1].map((s) => ({ stars: s, count: buckets[s - 1] })),
      };
    }, { total: 0, avg: 0, distribution: [] as Array<{ stars: number; count: number }> }),
    safe(async () => {
      const { data } = await supabase
        .from("reviews")
        .select("body, overall_rating, created_at")
        .eq("building_id", building.id)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(3);
      return ((data ?? []) as Array<{
        body: string | null;
        overall_rating: number | null;
        created_at: string | null;
      }>)
        .filter((r) => (r.body ?? "").trim().length > 0)
        .map((r) => ({
          rating: r.overall_rating,
          date: (r.created_at ?? "").slice(0, 10),
          excerpt:
            (r.body ?? "").length > 280
              ? `${(r.body ?? "").slice(0, 280).trim()}…`
              : (r.body ?? ""),
        }));
    }, []),
  ]);

  return {
    address: building.full_address,
    city,
    slug: building.slug,
    review_count: aggregate.total,
    avg_rating: aggregate.total ? Number(aggregate.avg.toFixed(2)) : null,
    rating_distribution: aggregate.distribution,
    building_score: building.overall_score,
    building_grade: scoreToGrade(building.overall_score),
    pull_quotes: pullQuotes,
    url: tagged(buildingUrl(building, city), TOOL, "reviews"),
    data_as_of: today(),
    more: [
      "All reviews in full text with per-category ratings (noise, pests, management, maintenance).",
      "The building's full report card: violations, 311 complaints, rent data, landlord record.",
      "Use get_building_report for the structured report of this building.",
    ],
  };
}
