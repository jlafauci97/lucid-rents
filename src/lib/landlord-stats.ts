import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import type { City } from "@/lib/cities";

// Anon client without cookies — required because unstable_cache() forbids
// reading dynamic data (like cookies()) inside its scope. landlord_stats and
// city_avg_score are public reads that don't need user auth.
function createCacheClient() {
  return createAnonClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export interface LandlordStats {
  name: string;
  slug: string;
  buildingCount: number;
  totalIssues: number;
  totalViolations: number;
  totalComplaints: number;
  totalLitigations: number;
  totalDobViolations: number;
  totalUnits: number | null;
  avgScore: number | null;
}

const STATS_COLUMNS =
  "name, slug, building_count, total_violations, total_dob_violations, total_complaints, total_litigations, total_units, avg_score";

const fetchLandlordStats = unstable_cache(
  async (slugOrName: string, city: City): Promise<LandlordStats | null> => {
    const supabase = createCacheClient();

    const bySlug = await supabase
      .from("landlord_stats")
      .select(STATS_COLUMNS)
      .eq("slug", slugOrName)
      .eq("metro", city)
      .limit(1)
      .maybeSingle();

    let row = bySlug.data;

    if (!row && !bySlug.error) {
      const decoded = decodeURIComponent(slugOrName);
      const byName = await supabase
        .from("landlord_stats")
        .select(STATS_COLUMNS)
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
      totalLitigations: row.total_litigations ?? 0,
      totalDobViolations: row.total_dob_violations ?? 0,
      totalUnits: row.total_units ?? null,
      avgScore: row.avg_score != null ? Number(row.avg_score) : null,
    };
  },
  ["landlord-stats"],
  {
    revalidate: 3600,
    tags: ["landlord-stats"],
  }
);

/**
 * Fetch aggregated stats for a landlord by slug + metro.
 * Two-layer cache: React.cache() for per-render dedup, unstable_cache for
 * cross-request (1h) reuse so repeat hits don't touch Supabase.
 *
 * Metro dispatch: NYC/LA use total_violations (HPD), alt-metros use
 * total_dob_violations so the "issues filed" count is meaningful on every
 * city.
 */
export const getLandlordStats = cache(
  (slugOrName: string, city: City): Promise<LandlordStats | null> =>
    fetchLandlordStats(slugOrName, city)
);

const fetchCityAvgScore = unstable_cache(
  async (city: City): Promise<number | null> => {
    const supabase = createCacheClient();
    const { data } = await supabase.rpc("city_avg_score", { p_metro: city });
    return typeof data === "number" ? data : null;
  },
  ["city-avg-score"],
  { revalidate: 3600, tags: ["city-avg-score"] }
);

export const getCityAvgScore = cache(
  (city: City): Promise<number | null> => fetchCityAvgScore(city)
);
