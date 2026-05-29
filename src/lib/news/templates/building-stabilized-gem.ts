import type { Detector, SignalCandidate } from "./types";
import { neighborhoodOf, buildingLink } from "./_helpers";

/**
 * Rent-stabilized buildings that also score well with tenants — the rare
 * "affordable AND good" find. Emits several candidates so the round-robin can
 * surface a different gem each time rather than always the #1.
 */
export const detectBuildingStabilizedGem: Detector = async ({ city, supabase }) => {
  const { data, error } = await supabase
    .from("buildings")
    .select("id, full_address, borough, slug, zip_code, overall_score, review_count, stabilized_units, total_units, year_built")
    .eq("metro", city)
    .eq("is_rent_stabilized", true)
    .gte("overall_score", 3.8)
    .gte("review_count", 5)
    .order("overall_score", { ascending: false })
    .limit(20);

  if (error || !data || data.length === 0) return [];

  return data.slice(0, 8).map<SignalCandidate>((b) => {
    const link = buildingLink(b, city);
    const hood = neighborhoodOf(b.zip_code, b.borough, city);
    return {
      type: "building-stabilized-gem",
      score: 2 + (b.overall_score ?? 0),
      headline_seed: `${link.address}: a rent-stabilized building renters actually rate`,
      metadata: {
        sample_building_id: b.id,
        building_address: link.address,
        building_url: link.url,
        neighborhood: hood,
        overall_score: Number((b.overall_score ?? 0).toFixed(1)),
        review_count: b.review_count,
        stabilized_units: b.stabilized_units,
        total_units: b.total_units,
        year_built: b.year_built,
      },
      image_hint: `${hood} ${city} prewar apartment`,
    };
  });
};
