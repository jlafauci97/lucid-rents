import { isValidCity } from "@/lib/cities";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") || "";
  const sort = searchParams.get("sort") || "violations";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = 25;

  const cityParam = searchParams.get("city");
  if (cityParam && !isValidCity(cityParam)) {
    return NextResponse.json({ error: `Invalid city: ${cityParam}` }, { status: 400 });
  }

  const supabase = await createClient();

  // Determine sort column
  const sortColumns: Record<string, string> = {
    violations: "total_violations",
    complaints: "total_complaints",
    litigations: "total_litigations",
    dob: "total_dob_violations",
    buildings: "building_count",
  };
  const sortCol = sortColumns[sort] || "total_violations";

  // Count total matching landlords
  let countQuery = supabase
    .from("landlord_stats")
    .select("id", { count: "exact", head: true });

  if (search) {
    countQuery = countQuery.ilike("name", `%${search}%`);
  }

  const { count: total, error: countError } = await countQuery;
  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  // Fetch paginated results
  const offset = (page - 1) * limit;
  let query = supabase
    .from("landlord_stats")
    .select("name,slug,building_count,total_violations,total_complaints,total_litigations,total_dob_violations,avg_score,worst_building_id,worst_building_address,worst_building_violations")
    .order(sortCol, { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data: landlords, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Map to expected format
  const mapped = (landlords || []).map((l) => ({
    name: l.name,
    buildingCount: l.building_count,
    totalViolations: l.total_violations,
    totalComplaints: l.total_complaints,
    totalLitigations: l.total_litigations,
    totalDobViolations: l.total_dob_violations,
    avgScore: l.avg_score,
    worstBuilding: {
      id: l.worst_building_id,
      address: l.worst_building_address,
      violations: l.worst_building_violations,
    },
  }));

  return NextResponse.json({
    landlords: mapped,
    total: total || 0,
    page,
  });
}
