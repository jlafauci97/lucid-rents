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

  // Primary: match by slug
  const bySlug = await supabase
    .from("landlord_stats")
    .select("name, slug, building_count, total_violations, total_dob_violations, total_complaints")
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
      .select("name, slug, building_count, total_violations, total_dob_violations, total_complaints")
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
  };
});
