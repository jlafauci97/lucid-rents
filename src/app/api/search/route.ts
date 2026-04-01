import { isValidCity } from "@/lib/cities";
import { normalizeAddressQuery } from "@/lib/address-normalization";
import { createClient } from "@/lib/supabase/server";
import { searchSchema } from "@/lib/validators";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

function applySortOrder(
  query: ReturnType<ReturnType<Awaited<ReturnType<typeof createClient>>["from"]>["select"]>,
  sort: string
) {
  switch (sort) {
    case "score-desc":
      return query.order("overall_score", { ascending: false, nullsFirst: false });
    case "score-asc":
      return query.order("overall_score", { ascending: true, nullsFirst: false });
    case "violations-desc":
      return query.order("violation_count", { ascending: false });
    case "reviews-desc":
      return query.order("review_count", { ascending: false });
    case "relevance":
    default:
      return query.order("review_count", { ascending: false });
  }
}

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

  const supabase = await createClient();

  // Use ranked search function for text queries to get proper relevance ordering
  if (q) {
    const { abbreviated, expanded } = normalizeAddressQuery(q);
    const { data, error } = await supabase.rpc("search_buildings_ranked", {
      search_query: abbreviated,
      search_query_alt: abbreviated !== expanded ? expanded : null,
      city_filter: cityParam || null,
      borough_filter: borough || null,
      zip_filter: zip || null,
      sort_by: sort || "relevance",
      page_offset: offset,
      page_limit: limit,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const buildings = (data || []).map((row: Record<string, unknown>) => {
      const { total_count, ...building } = row;
      return building;
    });
    const total = data?.[0]?.total_count ?? 0;

    return NextResponse.json({ buildings, total, page });
  }

  // Non-text queries: browse by filters only
  let query = supabase
    .from("buildings")
    .select("*", { count: "exact" })
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
