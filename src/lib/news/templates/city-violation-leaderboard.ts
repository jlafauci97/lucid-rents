import type { Detector } from "./types";

/**
 * City-wide watchdog roundup: the landlords with the most open violations.
 * Reads the precomputed `landlord_stats` rollup. No single entity key — the
 * selector treats this as a "topic" with a short cooldown so it rotates.
 */
export const detectCityViolationLeaderboard: Detector = async ({ city, supabase }) => {
  const { data, error } = await supabase
    .from("landlord_stats")
    .select("name, slug, building_count, total_violations")
    .eq("metro", city)
    .gte("building_count", 3)
    .gte("total_violations", 30)
    .order("total_violations", { ascending: false })
    .limit(10);

  if (error || !data || data.length < 3) return [];

  return [
    {
      type: "city-violation-leaderboard",
      score: 2.8,
      headline_seed: `The ${city.toUpperCase()} landlords with the most open violations right now`,
      metadata: {
        ranking: "violations",
        landlords: data.map((l) => ({
          name: l.name,
          buildings: l.building_count,
          violations: l.total_violations,
        })),
      },
      image_hint: `${city} housing code inspection`,
    },
  ];
};
