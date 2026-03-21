import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidCity } from "@/lib/cities";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const borough = searchParams.get("borough");
  const sortBy = searchParams.get("sort") || "violations";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = 25;
  const cityParam = searchParams.get("city");
  if (cityParam && !isValidCity(cityParam)) {
    return NextResponse.json({ error: "Invalid city" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const sortColumn = sortBy === "complaints" ? "complaint_count" : "violation_count";

  let query = supabase
    .from("buildings")
    .select(
      "id, full_address, borough, zip_code, year_built, total_units, num_floors, owner_name, overall_score, review_count, violation_count, complaint_count"
    )
    .gt(sortColumn, 0)
    .order(sortColumn, { ascending: false });

  if (cityParam) {
    query = query.eq("metro", cityParam);
  }

  if (borough && borough !== "all") {
    query = query.eq("borough", borough);
  }

  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    if (error.message.includes("timeout")) {
      return NextResponse.json({
        buildings: [],
        total: 0,
        page,
        totalPages: 0,
        message: "Data is still being processed. Please try again in a few minutes.",
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const hasMore = (data?.length || 0) === limit;

  return NextResponse.json({
    buildings: data || [],
    total: hasMore ? (page * limit) + 1 : offset + (data?.length || 0),
    page,
    totalPages: hasMore ? page + 1 : page,
  });
}
