import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ buildings: [] });
  }

  try {
    const supabase = await createClient();

    // Use the search_vector tsvector column (indexed, fast)
    const { data } = await supabase
      .from("buildings")
      .select("id, full_address, borough, zip_code, slug, overall_score, violation_count, complaint_count, total_units")
      .eq("metro", "nyc")
      .textSearch("search_vector", q, { type: "plain", config: "english" })
      .order("review_count", { ascending: false })
      .limit(8);

    return NextResponse.json({ buildings: data ?? [] });
  } catch {
    return NextResponse.json({ buildings: [] });
  }
}
