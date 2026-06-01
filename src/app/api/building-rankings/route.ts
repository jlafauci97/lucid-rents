import { NextResponse } from "next/server";
import { createCacheClient } from "@/lib/supabase/cache-client";
import { isValidCity } from "@/lib/cities";

// Edge runtime — pure I/O read.
export const runtime = "edge";

const PER_PAGE = 25;

const SORT_COLUMNS: Record<string, string> = {
  violations: "violation_count",
  complaints: "complaint_count",
  evictions: "eviction_count",
  lawsuits: "litigation_count",
  "per-unit": "violation_count", // re-sorted in-app
  bedbug: "bedbug_report_count",
};

const SELECT_COLS =
  "id, full_address, borough, zip_code, slug, year_built, total_units, owner_name, violation_count, complaint_count, eviction_count, litigation_count, bedbug_report_count, overall_score, review_count";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city");
  const sortKey = searchParams.get("sort") || "violations";
  const borough = searchParams.get("borough") || "all";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  if (!city || !isValidCity(city)) {
    return NextResponse.json({ error: "Invalid city" }, { status: 400 });
  }

  const sortCol = SORT_COLUMNS[sortKey] ?? SORT_COLUMNS.violations;
  const offset = (page - 1) * PER_PAGE;
  const supabase = createCacheClient();

  // The query's NULLS ordering must match the chosen index's, or Postgres
  // can't use the index to satisfy ORDER BY and falls back to a full
  // scan + sort — which blows past the 8s anon statement_timeout (→ HTTP
  // 500) on high-cardinality columns like complaint_count (~194K NYC rows).
  // The partial indexes from migration 20260428300000 are `DESC NULLS LAST`
  // for every count column EXCEPT violation_count, whose index
  // (idx_buildings_metro_violations) is plain `DESC` (i.e. NULLS FIRST).
  // supabase-js `.order(col,{ascending:false})` defaults to NULLS FIRST, so
  // only violation_count matched its index; complaints / evictions /
  // lawsuits / bedbug full-scanned and timed out. `.gt(sortCol, 0)` means
  // no NULLs ever appear in the result, so this only steers index
  // selection — it never changes the output.
  const nullsFirst = sortCol === "violation_count";

  let q = supabase
    .from("buildings")
    .select(SELECT_COLS, { count: "planned" })
    .eq("metro", city)
    .gt(sortCol, 0)
    .order(sortCol, { ascending: false, nullsFirst })
    .range(offset, offset + PER_PAGE - 1);

  if (borough !== "all") {
    q = q.eq("borough", borough);
  }

  const { data, count, error } = await q;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    buildings: data ?? [],
    page,
    perPage: PER_PAGE,
    count: count ?? 0,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / PER_PAGE)),
  });
}
