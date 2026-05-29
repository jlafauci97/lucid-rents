import type { Detector, SignalCandidate } from "./types";
import { neighborhoodOf, buildingLink } from "./_helpers";

/**
 * Buildings carrying a heavy violation load with enough tenant reviews to
 * corroborate the record — a data-backed "read the file before you sign"
 * cautionary feature. Several candidates for round-robin variety.
 */
export const detectBuildingCautionary: Detector = async ({ city, supabase }) => {
  const { data, error } = await supabase
    .from("buildings")
    .select("id, full_address, borough, slug, zip_code, overall_score, review_count, violation_count, complaint_count, eviction_count")
    .eq("metro", city)
    .gte("violation_count", 20)
    .gte("review_count", 3)
    .order("violation_count", { ascending: false })
    .limit(25);

  if (error || !data || data.length === 0) return [];

  return data.slice(0, 10).map<SignalCandidate>((b) => {
    const link = buildingLink(b, city);
    const hood = neighborhoodOf(b.zip_code, b.borough, city);
    return {
      type: "building-cautionary",
      score: 2 + Math.log((b.violation_count ?? 0) + 1),
      headline_seed: `${link.address} carries ${b.violation_count} open violations — here's the record`,
      metadata: {
        sample_building_id: b.id,
        building_address: link.address,
        building_url: link.url,
        neighborhood: hood,
        violation_count: b.violation_count,
        complaint_count: b.complaint_count,
        eviction_count: b.eviction_count,
        review_count: b.review_count,
        overall_score: b.overall_score != null ? Number(b.overall_score.toFixed(1)) : null,
      },
      image_hint: `${hood} ${city} aging apartment building`,
    };
  });
};
