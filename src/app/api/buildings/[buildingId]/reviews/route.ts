import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ buildingId: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { buildingId } = await context.params;
  const searchParams = req.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const sort = searchParams.get("sort") || "recent";
  const limit = 10;
  const offset = (page - 1) * limit;

  const supabase = await createClient();

  let query = supabase
    .from("reviews")
    .select(
      `*, profile:profiles(id, display_name, avatar_url), category_ratings:review_category_ratings(*, category:review_categories(slug, name, icon)), unit:units(unit_number)`,
      { count: "exact" }
    )
    .eq("building_id", buildingId)
    .eq("status", "published")
    .range(offset, offset + limit - 1);

  if (sort === "helpful") {
    query = query.order("helpful_count", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    reviews: data || [],
    total: count || 0,
    page,
  });
}
