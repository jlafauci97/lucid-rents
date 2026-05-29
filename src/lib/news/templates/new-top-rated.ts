import type { Detector, SignalCandidate } from "./types";
import { neighborhoodOf, buildingLink } from "./_helpers";

/**
 * Buildings that crossed into A-grade (LucidIQ >= 4.0) recently, clustered by
 * neighborhood. "3 buildings hit A in Williamsburg this week" reads better than
 * five separate stories. Neighborhood is derived from the ZIP (buildings has no
 * neighborhood column).
 */
export const detectNewTopRated: Detector = async ({ city, supabase, today }) => {
  const now = new Date(today + "T00:00:00Z");
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("buildings")
    .select("id, full_address, borough, slug, zip_code, overall_score, metro, review_count, updated_at")
    .eq("metro", city)
    .gte("overall_score", 4.0)
    .gte("updated_at", d7)
    .gte("review_count", 8);

  if (error || !data || data.length === 0) return [];

  type Row = (typeof data)[number];
  const byHood = new Map<string, Row[]>();
  for (const row of data) {
    const hood = neighborhoodOf(row.zip_code, row.borough, city);
    const arr = byHood.get(hood) ?? [];
    arr.push(row);
    byHood.set(hood, arr);
  }

  const candidates: SignalCandidate[] = [];
  for (const [neighborhood, rows] of byHood) {
    if (rows.length < 2) continue; // one building alone isn't a cluster
    const top = rows
      .sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0))
      .slice(0, 5);
    const lead = top[0];

    candidates.push({
      type: "new-top-rated",
      score: 2 + rows.length,
      headline_seed: `${rows.length} new A-grade buildings in ${neighborhood} this week`,
      metadata: {
        neighborhood,
        count: rows.length,
        sample_building_id: lead.id,
        building_url: buildingLink(lead, city).url,
        top_buildings: top.map((b) => ({
          ...buildingLink(b, city),
          score: Number((b.overall_score ?? 0).toFixed(1)),
          reviews: b.review_count,
        })),
      },
      image_hint: `${neighborhood} ${city} residential`,
    });
  }

  return candidates;
};
