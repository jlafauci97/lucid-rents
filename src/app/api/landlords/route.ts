import { isValidCity } from "@/lib/cities";
import { GARBAGE_NOT_IN } from "@/lib/landlord-garbage-names";
import { createCacheClient } from "@/lib/supabase/cache-client";
import { NextRequest, NextResponse } from "next/server";

// Sort key → column on landlord_stats_canonical. The table has plain
// (metro, <col> DESC) composite indexes for every column below, which match
// supabase-js's default `.order(col, { ascending: false })` (DESC NULLS
// FIRST) exactly — so each sort is an indexed range scan with no Sort node,
// page 1 or page 100. Do NOT add `.gt(col, 0)` + `nullsFirst: false` to
// "use the partial index": canonical has no total_violations partial index,
// so that variant full-scans + sorts ~629K nyc rows and trips the anon
// role's 8s statement_timeout. (See /api/building-rankings — the buildings
// table is where the partial DESC-NULLS-LAST indexes actually exist.)
const SORT_COLUMNS: Record<string, string> = {
  violations: "total_violations",
  complaints: "total_complaints",
  litigations: "total_litigations",
  dob: "total_dob_violations",
  buildings: "building_count",
};

// worst_building_id is intentionally absent — canonical has no such column,
// and no consumer reads worstBuilding.id (DirectoryClient renders only the
// address). The response keeps `id: null` for shape stability.
const SELECT_COLS =
  "name,slug,building_count,total_violations,total_complaints,total_litigations,total_dob_violations,avg_score,worst_building_address,worst_building_violations";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") || "";
  const sort = searchParams.get("sort") || "violations";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = 25;

  const cityParam = searchParams.get("city");
  if (cityParam && !isValidCity(cityParam)) {
    return NextResponse.json({ error: `Invalid city: ${cityParam}` }, { status: 400 });
  }

  const sortCol = SORT_COLUMNS[sort] || SORT_COLUMNS.violations;
  const offset = (page - 1) * limit;

  // Non-cookies client so next.config.ts Cache-Control headers apply.
  // Landlord directory is fully public data.
  const supabase = createCacheClient();

  // Query the deduped canonical rollup with the SAME garbage filter and
  // ordering as the directory's server-rendered first page (DirectorySection).
  // The route previously queried landlord_stats, which is NOT slug-deduped —
  // so once the user sorted/paged past the SSR page, the same landlord
  // reappeared under name-variant rows. Canonical fixes that and is the table
  // the rest of the directory (SSR list + count RPC) already trusts.
  let dataQuery = supabase
    .from("landlord_stats_canonical")
    .select(SELECT_COLS)
    .not("name", "in", GARBAGE_NOT_IN)
    .order(sortCol, { ascending: false })
    .range(offset, offset + limit - 1);

  if (cityParam) {
    dataQuery = dataQuery.eq("metro", cityParam);
  }
  if (search) {
    dataQuery = dataQuery.ilike("name", `%${search}%`);
  }

  // The old `count: "exact"` ran a full COUNT(*) over ~629K nyc rows on every
  // request — it tripped the anon 8s statement_timeout (→ HTTP 500) and was
  // the dominant cost, yet no consumer uses it (DirectoryClient takes its
  // total from the SSR shell; the search type-aheads ignore it). Use the same
  // planner-estimate RPC the directory page uses (~100ms) and run it in
  // PARALLEL with the data query. Skip it on search (the RPC is metro-wide,
  // not search-filtered) and when no city is given.
  const countPromise: PromiseLike<number> =
    cityParam && !search
      ? supabase
          .rpc("get_landlord_directory_count", { p_metro: cityParam })
          .then((r) => (typeof r.data === "number" ? r.data : 0))
      : Promise.resolve(0);

  const [{ data: landlords, error }, total] = await Promise.all([
    dataQuery,
    countPromise,
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Map to the response shape DirectoryClient / search type-aheads expect.
  const mapped = (landlords || []).map((l) => ({
    name: l.name,
    buildingCount: l.building_count,
    totalViolations: l.total_violations,
    totalComplaints: l.total_complaints,
    totalLitigations: l.total_litigations,
    totalDobViolations: l.total_dob_violations,
    avgScore: l.avg_score,
    worstBuilding: {
      id: null,
      address: l.worst_building_address,
      violations: l.worst_building_violations,
    },
  }));

  return NextResponse.json({
    landlords: mapped,
    total,
    page,
  });
}
