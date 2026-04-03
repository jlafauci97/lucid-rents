import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ buildingId: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { buildingId } = await context.params;
  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get("type") || "hpd";
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const supabase = await createClient();

  if (type === "dob") {
    const { data, error } = await supabase
      .from("dob_violations")
      .select("*")
      .eq("building_id", buildingId)
      .order("issue_date", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ violations: data || [], type: "dob" });
  }

  // Default: HPD
  const { data, error } = await supabase
    .from("hpd_violations")
    .select("*")
    .eq("building_id", buildingId)
    .order("inspection_date", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ violations: data || [], type: "hpd" });
}
