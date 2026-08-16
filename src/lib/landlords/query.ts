import { createCacheClient } from "@/lib/supabase/cache-client";
import { VALID_CITIES, type City } from "@/lib/cities";

/** Sort keys accepted by the landlord directory (API + pages). */
export const LANDLORD_SORT_COLUMNS: Record<string, string> = {
  violations: "total_violations",
  complaints: "total_complaints",
  litigations: "total_litigations",
  dob: "total_dob_violations",
  buildings: "building_count",
};

export const LANDLORD_PAGE_SIZE = 25;

export interface LandlordDirectoryRow {
  name: string | null;
  slug: string | null;
  buildingCount: number | null;
  totalViolations: number | null;
  totalComplaints: number | null;
  totalLitigations: number | null;
  totalDobViolations: number | null;
  avgScore: number | null;
  worstBuilding: {
    id: string | null;
    address: string | null;
    violations: number | null;
  };
}

/**
 * One indexed page of the landlord directory with a PLANNED count folded in
 * (a real COUNT over ~631K NYC rows costs seconds and trips the anon role's
 * statement_timeout; the planner estimate is plenty for pagination copy).
 * Shared by /api/landlords (client directory) and the server-rendered
 * /landlords/page/[n] crawl pages.
 */
export async function fetchLandlordDirectoryPage({
  city,
  sort = "violations",
  page = 1,
}: {
  city?: City | null;
  sort?: string;
  page?: number;
}): Promise<{ landlords: LandlordDirectoryRow[]; total: number; page: number }> {
  const supabase = createCacheClient();
  const sortCol = LANDLORD_SORT_COLUMNS[sort] || "total_violations";
  const offset = (page - 1) * LANDLORD_PAGE_SIZE;

  let query = supabase
    .from("landlord_stats")
    .select(
      "name,slug,building_count,total_violations,total_complaints,total_litigations,total_dob_violations,avg_score,worst_building_id,worst_building_address,worst_building_violations",
      { count: "planned" },
    )
    .order(sortCol, { ascending: false })
    .range(offset, offset + LANDLORD_PAGE_SIZE - 1);

  if (city) {
    query = query.eq("metro", city);
  } else {
    query = query.in("metro", VALID_CITIES);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const landlords: LandlordDirectoryRow[] = (data || []).map((l) => ({
    name: l.name,
    slug: l.slug,
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

  return {
    landlords,
    total: Math.max(count || 0, offset + landlords.length),
    page,
  };
}
