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

  let q = supabase
    .from("buildings")
    .select(SELECT_COLS, { count: "planned" })
    .eq("metro", city)
    .gt(sortCol, 0)
    .order(sortCol, { ascending: false })
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
