import type { Detector, SignalCandidate } from "./types";
import { neighborhoodOf, buildingLink } from "./_helpers";

/**
 * The most-discussed buildings — those with the most tenant reviews on record.
 * (Reviews are bulk-imported rather than a live feed, so we rank by total
 * review_count, not recent activity.) Emits several candidates so the
 * featured-history round-robin surfaces a different well-reviewed building each
 * time instead of always the single most-reviewed one.
 */
export const detectBuildingMostReviewed: Detector = async ({ city, supabase }) => {
  const { data, error } = await supabase
    .from("buildings")
    .select("id, full_address, borough, slug, zip_code, overall_score, review_count")
    .eq("metro", city)
    .gte("review_count", 15)
    .order("review_count", { ascending: false })
    .limit(30);

  if (error || !data || data.length === 0) return [];

  return data.slice(0, 12).map<SignalCandidate>((b) => {
    const link = buildingLink(b, city);
    const hood = neighborhoodOf(b.zip_code, b.borough, city);
    return {
      type: "building-most-reviewed",
      score: 2 + Math.log((b.review_count ?? 0) + 1),
      headline_seed: `${link.address} is one of ${hood}'s most-reviewed rentals — here's the verdict`,
      metadata: {
        sample_building_id: b.id,
        building_address: link.address,
        building_url: link.url,
        neighborhood: hood,
        total_reviews: b.review_count,
        overall_score: b.overall_score != null ? Number(b.overall_score.toFixed(1)) : null,
      },
      image_hint: `${hood} ${city} apartment building`,
    };
  });
};
