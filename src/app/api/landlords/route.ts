import { isValidCity } from "@/lib/cities";
import { createCacheClient } from "@/lib/supabase/cache-client";
import { fetchLandlordDirectoryPage, LANDLORD_SORT_COLUMNS } from "@/lib/landlords/query";
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
      sort_by: LANDLORD_SORT_COLUMNS[sort] ? sort : "violations",
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

  // Non-search branch: shared with the server-rendered /landlords/page/[n]
  // crawl pages (see src/lib/landlords/query.ts for the planned-count
  // rationale).
  try {
    const { landlords, total } = await fetchLandlordDirectoryPage({
      city: (cityParam as import("@/lib/cities").City) || null,
      sort,
      page,
    });
    return NextResponse.json(
      { landlords, total, page },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
