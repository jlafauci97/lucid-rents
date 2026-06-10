export const runtime = "edge";

import { isValidCity } from "@/lib/cities";
import { createCacheClient } from "@/lib/supabase/cache-client";
import { searchSchema } from "@/lib/validators";
import { checkRateLimit } from "@/lib/rate-limit";
import { applySortOrder, searchBuildingsRanked } from "@/lib/search/query";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "anonymous";
  const rl = await checkRateLimit(`search:${ip}`);
  if (rl.limited) return rl.response;

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = searchSchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid search parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { q, borough, zip, sort, page, limit } = parsed.data;
  const cityParam = req.nextUrl.searchParams.get("city");
  if (cityParam && !isValidCity(cityParam)) {
    return NextResponse.json({ error: "Invalid city" }, { status: 400 });
  }
  const offset = (page - 1) * limit;

  const supabase = createCacheClient();

  // Use ranked search function for text queries to get proper relevance ordering
  if (q) {
    const { buildings, total, error } = await searchBuildingsRanked(supabase, {
      q,
      city: cityParam,
      borough,
      zip,
      sort,
      offset,
      limit,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ buildings, total, page });
  }

  // Non-text queries: browse by filters only.
  // Explicit column list (matches what BuildingCard & the typeahead
  // consumers read; see BUILDING_COLUMNS in src/lib/building-list/query.ts)
  // and `count: "planned"` — `exact` does a full COUNT(*) that times out on
  // the >1M-row buildings table.
  let query = supabase
    .from("buildings")
    .select(
      `id, metro, borough, full_address, name, slug, year_built, total_units,
       residential_units, overall_score, review_count, violation_count,
       complaint_count, is_rent_stabilized, zip_code`,
      { count: "planned" }
    )
    .range(offset, offset + limit - 1);

  if (cityParam) {
    query = query.eq("metro", cityParam);
  }
  if (borough) {
    query = query.eq("borough", borough);
  }
  if (zip) {
    query = query.eq("zip_code", zip);
  }

  query = applySortOrder(query, sort);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    buildings: data || [],
    total: count || 0,
    page,
  });
}
