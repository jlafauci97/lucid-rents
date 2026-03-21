import { isValidCity } from "@/lib/cities";
import { createClient } from "@/lib/supabase/server";
import { searchSchema } from "@/lib/validators";
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

  let query = supabase
    .from("buildings")
    .select("*", { count: "exact" })
    .range(offset, offset + limit - 1);

  if (cityParam) {
    query = query.eq("metro", cityParam);
  }
  if (q) {
    query = query.textSearch("search_vector", q, { type: "websearch", config: "english" });
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
