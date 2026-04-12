import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) {
    return NextResponse.json({ buildings: [] });
  }

  try {
    const supabase = await createClient();

    // Simple ilike search — fast, no RPC needed
    const { data } = await supabase
      .from("buildings")
      .select("id, full_address, borough, zip_code, slug, overall_score, violation_count, complaint_count, total_units")
      .eq("metro", "nyc")
      .ilike("full_address", `%${q}%`)
      .order("review_count", { ascending: false })
      .limit(8);

    return NextResponse.json({ buildings: data ?? [] });
  } catch {
    return NextResponse.json({ buildings: [] });
  }
}
