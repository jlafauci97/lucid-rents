import { NextResponse } from "next/server";
import { createCacheClient } from "@/lib/supabase/cache-client";
import { isValidCity } from "@/lib/cities";

// Edge runtime — pure I/O Supabase read for the city news listing.
export const runtime = "edge";

const PER_PAGE = 20;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city");
  const category = searchParams.get("category");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  // Either city OR category must be provided. Both are accepted (filter
  // by both); neither means bad request.
  if (!city && !category) {
    return NextResponse.json({ error: "city or category required" }, { status: 400 });
  }
  if (city && !isValidCity(city)) {
    return NextResponse.json({ error: "Invalid city" }, { status: 400 });
  }

  const offset = (page - 1) * PER_PAGE;
  const supabase = createCacheClient();

  let countQ = supabase
    .from("news_articles")
    .select("id", { count: "exact", head: true });
  if (city) countQ = countQ.eq("metro", city);
  if (category) countQ = countQ.eq("category", category);
  const { count } = await countQ;

  let listQ = supabase
    .from("news_articles")
    .select("*")
    .order("published_at", { ascending: false })
    .range(offset, offset + PER_PAGE - 1);
  if (city) listQ = listQ.eq("metro", city);
  if (category) listQ = listQ.eq("category", category);
  const { data: articles, error } = await listQ;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    articles: articles || [],
    page,
    perPage: PER_PAGE,
    totalCount: count || 0,
    totalPages: Math.max(1, Math.ceil((count || 0) / PER_PAGE)),
  });
}
