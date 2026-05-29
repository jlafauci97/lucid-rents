import type { Detector, SignalCandidate } from "./types";

/**
 * Landlords whose portfolio earns genuinely high tenant scores with a low
 * violation rate — a positive "good landlord" feature. The bar is high (≥4.7
 * on a 0–5 scale, portfolio mean is ~4.5) plus <3 violations per building.
 */
export const detectLandlordGoodActor: Detector = async ({ city, supabase }) => {
  const { data, error } = await supabase
    .from("landlord_stats")
    .select("name, building_count, total_violations, avg_score, total_units")
    .eq("metro", city)
    .gte("building_count", 5)
    .gte("avg_score", 4.7)
    .order("avg_score", { ascending: false })
    .limit(40);

  if (error || !data || data.length === 0) return [];

  const ranked = data
    .map((l) => ({
      ...l,
      vpb: l.building_count ? (l.total_violations ?? 0) / l.building_count : 999,
    }))
    .filter((l) => l.vpb < 3)
    .sort((a, b) => (b.avg_score ?? 0) - (a.avg_score ?? 0))
    .slice(0, 10);
  if (ranked.length === 0) return [];

  return ranked.map<SignalCandidate>((l) => ({
    type: "landlord-good-actor",
    score: 2.5 + (l.avg_score ?? 0),
    headline_seed: `${l.name} runs ${l.building_count} buildings tenants rate ${(l.avg_score ?? 0).toFixed(1)}/5`,
    metadata: {
      landlord: l.name,
      buildings: l.building_count,
      avg_score: Number((l.avg_score ?? 0).toFixed(1)),
      total_violations: l.total_violations,
      violations_per_building: Number(l.vpb.toFixed(1)),
      units: l.total_units,
    },
    image_hint: `${city} well-kept apartment building`,
  }));
};
