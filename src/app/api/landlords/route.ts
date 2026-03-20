import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface BuildingRow {
  id: string;
  full_address: string;
  borough: string;
  owner_name: string;
  violation_count: number;
  complaint_count: number;
  litigation_count: number;
  dob_violation_count: number;
  overall_score: number | null;
}

interface LandlordAggregation {
  name: string;
  buildingCount: number;
  totalViolations: number;
  totalComplaints: number;
  totalLitigations: number;
  totalDobViolations: number;
  avgScore: number | null;
  worstBuilding: {
    id: string;
    address: string;
    violations: number;
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") || "";
  const sort = searchParams.get("sort") || "violations";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = 25;

  const supabase = await createClient();

  // Query ALL buildings with owner_name in paginated batches to bypass Supabase row limits
  const allBuildings: BuildingRow[] = [];
  const DB_BATCH = 10000;
  let dbOffset = 0;
  let fetchError: string | null = null;

  while (true) {
    let query = supabase
      .from("buildings")
      .select("id, full_address, borough, owner_name, violation_count, complaint_count, litigation_count, dob_violation_count, overall_score")
      .not("owner_name", "is", null)
      .or("violation_count.gt.0,complaint_count.gt.0")
      .order("id", { ascending: true })
      .range(dbOffset, dbOffset + DB_BATCH - 1);

    if (search) {
      query = query.ilike("owner_name", `%${search}%`);
    }

    const { data, error: batchError } = await query;
    if (batchError) {
      fetchError = batchError.message;
      break;
    }
    if (!data || data.length === 0) break;
    allBuildings.push(...(data as BuildingRow[]));
    if (data.length < DB_BATCH) break; // last page
    dbOffset += DB_BATCH;
  }

  const buildings = allBuildings;
  const error = fetchError;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate by owner_name in JS
  const landlordMap = new Map<string, LandlordAggregation>();

  for (const building of (buildings || []) as BuildingRow[]) {
    const name = building.owner_name;
    if (!name) continue;

    const existing = landlordMap.get(name);
    if (existing) {
      existing.buildingCount++;
      existing.totalViolations += building.violation_count || 0;
      existing.totalComplaints += building.complaint_count || 0;
      existing.totalLitigations += building.litigation_count || 0;
      existing.totalDobViolations += building.dob_violation_count || 0;
      if (building.overall_score !== null) {
        // Track scores for averaging
        const scores = (existing as LandlordAggregation & { _scores?: number[] })._scores || [];
        scores.push(building.overall_score);
        (existing as LandlordAggregation & { _scores?: number[] })._scores = scores;
        existing.avgScore =
          scores.reduce((a, b) => a + b, 0) / scores.length;
      }
      // Track worst building
      if (
        (building.violation_count || 0) >
        existing.worstBuilding.violations
      ) {
        existing.worstBuilding = {
          id: building.id,
          address: building.full_address,
          violations: building.violation_count || 0,
        };
      }
    } else {
      const scores: number[] = building.overall_score !== null ? [building.overall_score] : [];
      const entry: LandlordAggregation & { _scores?: number[] } = {
        name,
        buildingCount: 1,
        totalViolations: building.violation_count || 0,
        totalComplaints: building.complaint_count || 0,
        totalLitigations: building.litigation_count || 0,
        totalDobViolations: building.dob_violation_count || 0,
        avgScore: building.overall_score,
        worstBuilding: {
          id: building.id,
          address: building.full_address,
          violations: building.violation_count || 0,
        },
        _scores: scores,
      };
      landlordMap.set(name, entry);
    }
  }

  // Convert to array and remove internal _scores field
  let landlords: LandlordAggregation[] = Array.from(landlordMap.values()).map(
    ({ ...rest }) => {
      const { _scores, ...landlord } = rest as LandlordAggregation & { _scores?: number[] };
      void _scores;
      return landlord;
    }
  );

  // Sort
  if (sort === "violations") {
    landlords.sort((a, b) => b.totalViolations - a.totalViolations);
  } else if (sort === "complaints") {
    landlords.sort((a, b) => b.totalComplaints - a.totalComplaints);
  } else if (sort === "litigations") {
    landlords.sort((a, b) => b.totalLitigations - a.totalLitigations);
  } else if (sort === "dob") {
    landlords.sort((a, b) => b.totalDobViolations - a.totalDobViolations);
  } else if (sort === "buildings") {
    landlords.sort((a, b) => b.buildingCount - a.buildingCount);
  }

  // Paginate
  const total = landlords.length;
  const start = (page - 1) * limit;
  const paginatedLandlords = landlords.slice(start, start + limit);

  return NextResponse.json({
    landlords: paginatedLandlords,
    total,
    page,
  });
}
