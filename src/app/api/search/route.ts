import { isValidCity } from "@/lib/cities";
import { createClient } from "@/lib/supabase/server";
import { searchSchema } from "@/lib/validators";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = searchSchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid search parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { q, borough, zip, page, limit } = parsed.data;
  const cityParam = req.nextUrl.searchParams.get("city");
  if (cityParam && !isValidCity(cityParam)) {
    return NextResponse.json({ error: "Invalid city" }, { status: 400 });
  }
  const offset = (page - 1) * limit;

  const supabase = await createClient();

  let query = supabase
    .from("buildings")
    .select("*", { count: "exact" })
    .range(offset, offset + limit - 1)
    .order("review_count", { ascending: false });

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
