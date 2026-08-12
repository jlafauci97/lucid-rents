import { isValidCity, VALID_CITIES } from "@/lib/cities";
import { createCacheClient } from "@/lib/supabase/cache-client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") || "";
  const sort = searchParams.get("sort") || "violations";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = 25;

  const cityParam = searchParams.get("city");
  if (cityParam && !isValidCity(cityParam)) {
    return NextResponse.json({ error: `Invalid city: ${cityParam}` }, { status: 400 });
  }

  // Non-cookies client so next.config.ts Cache-Control headers apply.
  // Landlord directory is fully public data.
  const supabase = createCacheClient();

  // Determine sort column
  const sortColumns: Record<string, string> = {
    violations: "total_violations",
    complaints: "total_complaints",
    litigations: "total_litigations",
    dob: "total_dob_violations",
    buildings: "building_count",
  };
  const sortCol = sortColumns[sort] || "total_violations";

  // Search goes through an RPC. The old PostgREST path (`ilike %q%` +
  // `count: "planned"` on top of the ordered metro index) seq-scanned 631K
  // rows for 1-2 char queries and timed out — every common search returned
  // HTTP 500. The RPC branches: <3 chars → prefix match served index-only by
  // idx_landlord_stats_search_cover; >=3 chars → trigram substring match
  // hard-capped so cold-cache heap I/O stays bounded.
  if (search) {
    const { data, error } = await supabase.rpc("search_landlord_stats", {
      city_filter: cityParam || null,
      search_query: search,
      sort_by: sortColumns[sort] ? sort : "violations",
      page_offset: (page - 1) * limit,
      page_limit: limit,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const rows = (data || []) as Record<string, unknown>[];
    const landlordsMapped = rows.map((l) => ({
      name: l.name,
      buildingCount: l.building_count,
      totalViolations: l.total_violations,
      totalComplaints: l.total_complaints,
      totalLitigations: l.total_litigations,
      totalDobViolations: l.total_dob_violations,
      avgScore: l.avg_score,
      worstBuilding: {
        id: l.worst_building_id,
        address: l.worst_building_address,
        violations: l.worst_building_violations,
      },
    }));
    // Vercel's CDN only caches based on headers the function itself emits
    // (the next.config.ts rule is applied after the cache decision), so set
    // Cache-Control here to let the CDN absorb repeated queries from the
    // header search modal.
    return NextResponse.json(
      {
        landlords: landlordsMapped,
        total: Number(rows[0]?.total_count ?? 0),
        page,
      },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
    );
  }

  // One indexed page fetch with a PLANNED count folded in. The previous code
  // ran a separate `count: "exact"` head query first, which forced a full
  // count over ~631K NYC rows (EXPLAIN cost ~11K) on every request and was
  // the entire latency cost here — the ordered page itself is an indexed
  // range scan (EXPLAIN cost ~2) via idx_landlord_stats_metro_<col>_desc.
  // The directory UI renders its "of N total" copy from a server-provided
  // fallback (totalFallback) and never reads this count; the search callers
  // use only the results. So a planner estimate is plenty, and folding it
  // into the data query also drops a full cross-region round-trip.
  const offset = (page - 1) * limit;
  let query = supabase
    .from("landlord_stats")
    .select(
      "name,slug,building_count,total_violations,total_complaints,total_litigations,total_dob_violations,avg_score,worst_building_id,worst_building_address,worst_building_violations",
      { count: "planned" },
    )
    .order(sortCol, { ascending: false })
    .range(offset, offset + limit - 1);

  if (cityParam) {
    query = query.eq("metro", cityParam);
  } else {
    query = query.in("metro", VALID_CITIES);
  }

  const { data: landlords, count: total, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Map to expected format
  const mapped = (landlords || []).map((l) => ({
    name: l.name,
    buildingCount: l.building_count,
    totalViolations: l.total_violations,
    totalComplaints: l.total_complaints,
    totalLitigations: l.total_litigations,
    totalDobViolations: l.total_dob_violations,
    avgScore: l.avg_score,
    worstBuilding: {
      id: l.worst_building_id,
      address: l.worst_building_address,
      violations: l.worst_building_violations,
    },
  }));

  return NextResponse.json(
    {
      landlords: mapped,
      total: total || 0,
      page,
    },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
  );
}
