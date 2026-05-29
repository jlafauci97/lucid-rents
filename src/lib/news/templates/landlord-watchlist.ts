import type { Detector, SignalCandidate } from "./types";

/**
 * Landlords carrying the heaviest violation load across their portfolio.
 * Reads the precomputed `landlord_stats` rollup (fast, small table). Several
 * candidates so the round-robin rotates which owner gets the watchdog feature.
 */
export const detectLandlordWatchlist: Detector = async ({ city, supabase }) => {
  const { data, error } = await supabase
    .from("landlord_stats")
    .select("name, building_count, total_violations, total_complaints, total_units, avg_score, worst_building_address")
    .eq("metro", city)
    .gte("building_count", 3)
    .gte("total_violations", 50)
    .order("total_violations", { ascending: false })
    .limit(25);

  if (error || !data || data.length === 0) return [];

  return data.slice(0, 10).map<SignalCandidate>((l) => {
    const perBuilding = l.building_count ? (l.total_violations ?? 0) / l.building_count : (l.total_violations ?? 0);
    return {
      type: "landlord-watchlist",
      score: 3 + Math.log((l.total_violations ?? 0) + 1),
      headline_seed: `${l.name}: ${(l.total_violations ?? 0).toLocaleString("en-US")} violations across ${l.building_count} buildings`,
      metadata: {
        landlord: l.name,
        buildings: l.building_count,
        total_violations: l.total_violations,
        total_complaints: l.total_complaints,
        violations_per_building: Number(perBuilding.toFixed(1)),
        units: l.total_units,
        avg_score: l.avg_score != null ? Number(l.avg_score.toFixed(1)) : null,
        worst_building_address: l.worst_building_address,
      },
      image_hint: `${city} apartment building exterior`,
    };
  });
};
