import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) {
    return NextResponse.json({ buildings: [] });
  }

  try {
    const supabase = await createClient();

    // Try text search first (uses tsvector index, fast)
    const tsQuery = q.replace(/\s+/g, " & ");
    const { data, error } = await supabase
      .from("buildings")
      .select("id, full_address, borough, zip_code, slug, overall_score, violation_count, complaint_count, total_units")
      .eq("metro", "nyc")
      .textSearch("full_address", tsQuery, { type: "plain" })
      .order("review_count", { ascending: false })
      .limit(8);

    if (error || !data || data.length === 0) {
      // Fallback: prefix match on the first word (uses btree index)
      const firstWord = q.split(/\s+/)[0].toUpperCase();
      const { data: fallback } = await supabase
        .from("buildings")
        .select("id, full_address, borough, zip_code, slug, overall_score, violation_count, complaint_count, total_units")
        .eq("metro", "nyc")
        .ilike("full_address", `${firstWord}%`)
        .order("review_count", { ascending: false })
        .limit(8);

      return NextResponse.json({ buildings: fallback ?? [] });
    }

    return NextResponse.json({ buildings: data });
  } catch {
    return NextResponse.json({ buildings: [] });
  }
}
