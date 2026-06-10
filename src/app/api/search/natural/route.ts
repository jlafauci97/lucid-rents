import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { createCacheClient } from "@/lib/supabase/cache-client";
import { DEFAULT_CITY, isValidCity, type City } from "@/lib/cities";
import { parseNaturalQuery, type ParsedNaturalQuery } from "@/lib/search/natural";
import {
  applySortOrder,
  searchBuildingsRanked,
  SEARCH_BUILDING_COLUMNS,
} from "@/lib/search/query";

/**
 * Natural-language building search.
 *
 * POST { q, city? } → { interpretation, buildings, total }
 *
 * Costs money (one Claude call per uncached request), so:
 *   - rate-limited FIRST,
 *   - query capped at 200 chars,
 *   - response cached at the edge (same NL query → same answer is fine).
 * If parsing fails for any reason, falls back to plain ranked text search.
 */

const bodySchema = z.object({
  q: z.string().trim().min(1).max(200),
  city: z.string().optional(),
});

const RESULT_LIMIT = 20;
/** Over-fetch factor when structured filters are applied in-memory on top of the ranked RPC. */
const FILTERED_FETCH_LIMIT = 50;
/** "low" violations threshold — matches the spirit of the no-violations chip. */
const LOW_VIOLATIONS_MAX = 5;
const CACHE_CONTROL = "public, s-maxage=3600";

type Filters = ParsedNaturalQuery["filters"];

function hasStructuredFilters(filters: Filters): boolean {
  return (
    filters.rentStabilized === true ||
    filters.maxViolations !== null ||
    filters.minScore !== null
  );
}

function matchesFilters(row: Record<string, unknown>, filters: Filters): boolean {
  if (filters.rentStabilized === true && row.is_rent_stabilized !== true) {
    return false;
  }
  if (filters.maxViolations !== null) {
    const v = typeof row.violation_count === "number" ? row.violation_count : 0;
    const max = filters.maxViolations === "none" ? 0 : LOW_VIOLATIONS_MAX;
    if (v > max) return false;
  }
  if (filters.minScore !== null) {
    const s = typeof row.overall_score === "number" ? row.overall_score : null;
    if (s === null || s < filters.minScore) return false;
  }
  return true;
}

function jsonWithCache(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": CACHE_CONTROL },
  });
}

export async function POST(req: NextRequest) {
  // This endpoint costs money — rate limit before doing anything else.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "anonymous";
  const rl = await checkRateLimit(`nlsearch:${ip}`);
  if (rl.limited) return rl.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsedBody.error.flatten() },
      { status: 400 }
    );
  }

  const { q } = parsedBody.data;
  const defaultCity: City =
    parsedBody.data.city && isValidCity(parsedBody.data.city)
      ? parsedBody.data.city
      : DEFAULT_CITY;

  const supabase = createCacheClient();
  const parsed = await parseNaturalQuery(q, defaultCity);

  // Fallback: plain ranked text search, same shape as GET /api/search.
  if (!parsed) {
    const { buildings, total, error } = await searchBuildingsRanked(supabase, {
      q,
      city: defaultCity,
      sort: "relevance",
      limit: RESULT_LIMIT,
    });
    if (error) return NextResponse.json({ error }, { status: 500 });
    return jsonWithCache({ interpretation: null, buildings, total });
  }

  const filtered = hasStructuredFilters(parsed.filters);
  let buildings: Record<string, unknown>[];
  let total: number;

  if (parsed.keywords) {
    // Keywords present → ranked full-text RPC (city/borough/zip/sort applied
    // server-side), then structured filters applied to the returned page.
    const result = await searchBuildingsRanked(supabase, {
      q: parsed.keywords,
      city: parsed.city,
      borough: parsed.borough,
      zip: parsed.zip,
      sort: parsed.sort,
      limit: filtered ? FILTERED_FETCH_LIMIT : RESULT_LIMIT,
    });
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    if (filtered) {
      const kept = result.buildings.filter((b) => matchesFilters(b, parsed.filters));
      buildings = kept.slice(0, RESULT_LIMIT);
      total = kept.length;
    } else {
      buildings = result.buildings;
      total = result.total;
    }
  } else {
    // No free-text remainder → direct buildings query, same pattern as the
    // browse path of GET /api/search, plus the structured filters.
    let query = supabase
      .from("buildings")
      .select(SEARCH_BUILDING_COLUMNS, { count: "planned" })
      .eq("metro", parsed.city)
      .range(0, RESULT_LIMIT - 1);

    if (parsed.borough) query = query.eq("borough", parsed.borough);
    if (parsed.zip) query = query.eq("zip_code", parsed.zip);
    if (parsed.filters.rentStabilized === true) {
      query = query.eq("is_rent_stabilized", true);
    }
    if (parsed.filters.maxViolations === "none") {
      query = query.eq("violation_count", 0);
    } else if (parsed.filters.maxViolations === "low") {
      query = query.lte("violation_count", LOW_VIOLATIONS_MAX);
    }
    if (parsed.filters.minScore !== null) {
      query = query.gte("overall_score", parsed.filters.minScore);
    }

    query = applySortOrder(query, parsed.sort);

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    buildings = data || [];
    total = count || 0;
  }

  return jsonWithCache({ interpretation: parsed, buildings, total });
}
