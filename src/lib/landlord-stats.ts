import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { City } from "@/lib/cities";

export interface LandlordStats {
  name: string;
  slug: string;
  buildingCount: number;
  totalIssues: number;
  totalViolations: number;
  totalComplaints: number;
  /** Portfolio-level LucidIQ average (0-5). Null when the landlord has no
   *  scoreable buildings yet. Used by the wayfinder rail's grade badge. */
  avgScore: number | null;
  /** Most-cited building in the portfolio (landlord_stats column).
   *  Used by the SEO title cascade to fire the "Most-Cited Building?" template. */
  worstBuildingAddress: string | null;
  worstBuildingViolations: number | null;
}

/**
 * Fetch aggregated stats for a landlord by slug + metro.
 * Wrapped in React `cache()` so repeated calls within the same render
 * (e.g. generateMetadata + page body) are deduplicated automatically.
 *
 * Metro dispatch: NYC/LA use total_violations (HPD), alt-metros use
 * total_dob_violations so the "issues filed" count is meaningful on every
 * city.
 */
export const getLandlordStats = cache(async (
  slugOrName: string,
  city: City
): Promise<LandlordStats | null> => {
  const supabase = await createClient();

  const SELECT_COLS =
    "name, slug, building_count, total_violations, total_dob_violations, total_complaints, avg_score, worst_building_address, worst_building_violations";

  // Primary: match by slug
  const bySlug = await supabase
    .from("landlord_stats")
    .select(SELECT_COLS)
    .eq("slug", slugOrName)
    .eq("metro", city)
    .limit(1)
    .maybeSingle();

  let row = bySlug.data;

  // Fallback: legacy URL format — resolve by ilike name match
  if (!row && !bySlug.error) {
    const decoded = decodeURIComponent(slugOrName);
    const byName = await supabase
      .from("landlord_stats")
      .select(SELECT_COLS)
      .ilike("name", decoded)
      .eq("metro", city)
      .limit(1)
      .maybeSingle();
    row = byName.data;
  }

  if (!row) return null;

  const isAltMetro = city === "chicago" || city === "miami" || city === "houston";
  const totalViolations = (isAltMetro ? row.total_dob_violations : row.total_violations) ?? 0;
  const totalComplaints = row.total_complaints ?? 0;

  return {
    name: row.name,
    slug: row.slug,
    buildingCount: row.building_count ?? 0,
    totalIssues: totalViolations + totalComplaints,
    totalViolations,
    totalComplaints,
    avgScore: typeof row.avg_score === "number" ? row.avg_score : null,
    worstBuildingAddress:
      typeof row.worst_building_address === "string" ? row.worst_building_address : null,
    worstBuildingViolations:
      typeof row.worst_building_violations === "number" ? row.worst_building_violations : null,
  };
});
