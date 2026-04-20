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
 */
export const getLandlordStats = cache(async (
  slug: string,
  city: City
): Promise<LandlordStats | null> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("landlord_stats")
    .select("name, slug, building_count, total_violations, total_complaints")
    .eq("slug", slug)
    .eq("metro", city)
    .limit(1)
    .single();

  if (error || !data) return null;

  const totalViolations = data.total_violations ?? 0;
  const totalComplaints = data.total_complaints ?? 0;

  return {
    name: data.name,
    slug: data.slug,
    buildingCount: data.building_count ?? 0,
    totalIssues: totalViolations + totalComplaints,
    totalViolations,
    totalComplaints,
  };
});
