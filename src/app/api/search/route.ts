import { createClient } from "@supabase/supabase-js";
import { isValidCity } from "@/lib/cities";
import { normalizeAddressQuery } from "@/lib/address-normalization";
import { searchSchema } from "@/lib/validators";
import { checkRateLimit } from "@/lib/rate-limit";
import { cached } from "@/lib/kv-cache";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
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

  const supabase = getSupabase();

  if (q) {
    const { abbreviated } = normalizeAddressQuery(q);
    const isAddressQuery = /^\d/.test(abbreviated.trim());
    const isAutocomplete = limit <= 5;
    const cacheKey = isAutocomplete ? `search:${cityParam || "all"}:${abbreviated}:${borough || ""}:${zip || ""}` : null;

    // Fast path: check Redis cache first (edge-native, <50ms)
    if (cacheKey) {
      const { Redis } = await import("@upstash/redis");
      try {
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        });
        const hit = await redis.get<{ buildings: unknown[]; total: number }>(cacheKey);
        if (hit) {
          return NextResponse.json({ ...hit, page }, {
            headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
          });
        }
      } catch {
        // Cache miss or Redis down — fall through
      }
    }

    // For autocomplete address queries: use lightweight search_index table (0.1ms)
    // instead of the heavy buildings table (5GB, slow under load)
    if (isAutocomplete && isAddressQuery) {
      const upperQuery = abbreviated.toUpperCase();
      let searchQuery = supabase
        .from("search_index")
        .select("id,full_address,borough,slug,name,zip_code,overall_score,review_count,violation_count,complaint_count,metro")
        .like("full_address", `${upperQuery}%`)
        .order("review_count", { ascending: false })
        .limit(limit);

      if (cityParam) searchQuery = searchQuery.eq("metro", cityParam);
      if (borough) searchQuery = searchQuery.eq("borough", borough);

      const { data, error } = await searchQuery;

      if (!error && data) {
        const result = { buildings: data, total: data.length };
        // Cache for 5 min
        if (cacheKey) {
          try {
            const { Redis } = await import("@upstash/redis");
            const redis = new Redis({
              url: process.env.UPSTASH_REDIS_REST_URL!,
              token: process.env.UPSTASH_REDIS_REST_TOKEN!,
            });
            await redis.set(cacheKey, JSON.stringify(result), { ex: 300 });
          } catch { /* best effort */ }
        }
        return NextResponse.json({ ...result, page }, {
          headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
        });
      }
      // Fall through to RPC on error
    }

    // Full search results page or non-address queries: use RPC
    const result = await cached(
      cacheKey,
      300,
      async () => {
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

        if (error) return { error: error.message };

        const buildings = (data || []).map((row: Record<string, unknown>) => {
          const { total_count, ...building } = row;
          return building;
        });
        const total = (data?.[0] as Record<string, unknown>)?.total_count ?? 0;
        return { buildings, total };
      }
    );

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      });
    }

    return NextResponse.json({ ...result, page }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  }

  // Non-text queries: browse by filters only
  let query = supabase
    .from("buildings")
    .select("id,metro,borough,slug,full_address,name,zip_code,year_built,total_units,review_count,violation_count,complaint_count,overall_score,is_rent_stabilized,latitude,longitude", { count: "exact" })
    .range(offset, offset + limit - 1);

  if (cityParam) query = query.eq("metro", cityParam);
  if (borough) query = query.eq("borough", borough);
  if (zip) query = query.eq("zip_code", zip);

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
