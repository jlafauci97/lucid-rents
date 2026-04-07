import { isValidCity } from "@/lib/cities";
import { normalizeAddressQuery } from "@/lib/address-normalization";
import { createClient } from "@/lib/supabase/server";
import { searchSchema } from "@/lib/validators";
import { checkRateLimit } from "@/lib/rate-limit";
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

  const supabase = await createClient();

  // Use ranked search function for text queries to get proper relevance ordering
  if (q) {
    const { abbreviated } = normalizeAddressQuery(q);
    // Address queries (start with digit) use fast btree index path;
    // name/owner queries fall back to GIN full-text search
    const isAddressQuery = /^\d/.test(abbreviated.trim());

    const { data, error } = isAddressQuery
      ? await supabase.rpc("search_buildings_fast", {
          search_query: abbreviated,
          city_filter: cityParam || null,
          borough_filter: borough || null,
          zip_filter: zip || null,
          sort_by: sort || "relevance",
          page_offset: offset,
          page_limit: limit,
        })
      : await supabase.rpc("search_buildings_ranked", {
          search_query: abbreviated,
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

    return NextResponse.json({ buildings, total, page }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  }

  // Non-text queries: browse by filters only — select only fields used by BuildingCard
  let query = supabase
    .from("buildings")
    .select("id,metro,borough,slug,full_address,name,zip_code,year_built,total_units,review_count,violation_count,complaint_count,overall_score,is_rent_stabilized,latitude,longitude", { count: "exact" })
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

  // Inline sort to avoid type mismatch with partial column select
  switch (sort) {
    case "score-desc":
      query = query.order("overall_score", { ascending: false, nullsFirst: false }); break;
    case "score-asc":
      query = query.order("overall_score", { ascending: true, nullsFirst: false }); break;
    case "violations-desc":
      query = query.order("violation_count", { ascending: false }); break;
    case "reviews-desc":
      query = query.order("review_count", { ascending: false }); break;
    default:
      query = query.order("review_count", { ascending: false }); break;
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    buildings: data || [],
    total: count || 0,
    page,
  }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
