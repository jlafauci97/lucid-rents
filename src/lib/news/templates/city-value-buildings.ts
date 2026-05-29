import type { Detector } from "./types";
import { neighborhoodOf, buildingLink } from "./_helpers";

/**
 * City-wide "value" roundup: the best-rated rent-stabilized buildings —
 * affordable and well-reviewed at once. Distinct from the single-building
 * stabilized-gem feature; this is a list. Treated as a rotating topic.
 */
export const detectCityValueBuildings: Detector = async ({ city, supabase }) => {
  const { data, error } = await supabase
    .from("buildings")
    .select("id, full_address, borough, slug, zip_code, overall_score, review_count, stabilized_units")
    .eq("metro", city)
    .eq("is_rent_stabilized", true)
    .gte("overall_score", 3.8)
    .gte("review_count", 5)
    .order("overall_score", { ascending: false })
    .limit(12);

  if (error || !data || data.length < 3) return [];

  return [
    {
      type: "city-value-buildings",
      score: 2.6,
      headline_seed: `${city.toUpperCase()}'s best-rated rent-stabilized buildings right now`,
      metadata: {
        ranking: "stabilized-value",
        buildings: data.map((b) => ({
          ...buildingLink(b, city),
          score: Number((b.overall_score ?? 0).toFixed(1)),
          neighborhood: neighborhoodOf(b.zip_code, b.borough, city),
        })),
      },
      image_hint: `${city} rent stabilized apartments`,
    },
  ];
};
