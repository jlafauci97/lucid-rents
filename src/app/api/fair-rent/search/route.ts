import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 15;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ buildings: [] });
  }

  try {
    const supabase = await createClient();

    // Convert query to tsquery format: "122 west 97" -> "122 & west & 97"
    const tsQuery = q
      .replace(/[^\w\s]/g, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .join(" & ");

    // Use search_vector GIN index via PostgREST fts filter
    const { data } = await supabase
      .from("buildings")
      .select("id, full_address, borough, zip_code, slug, overall_score, violation_count, complaint_count, total_units")
      .eq("metro", "nyc")
      .filter("search_vector", "fts", tsQuery)
      .order("review_count", { ascending: false })
      .limit(8);

    return NextResponse.json({ buildings: data ?? [] });
  } catch {
    return NextResponse.json({ buildings: [] });
  }
}
