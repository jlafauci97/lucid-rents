import type { Detector, SignalCandidate } from "./types";

/**
 * Buildings that crossed into A-grade (LucidIQ >= 4.0) in the last 7 days,
 * driven by new reviews. Groups by neighborhood to emit one candidate per
 * cluster — "3 buildings hit A in Williamsburg this week" reads better than
 * five individual stories.
 */
export const detectNewTopRated: Detector = async ({ city, cfg, supabase, today }) => {
  const now = new Date(today + "T00:00:00Z");
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("buildings")
    .select("id, full_address, borough, neighborhood, overall_score, metro, review_count, updated_at")
    .eq("metro", city)
    .gte("overall_score", 4.0)
    .gte("updated_at", d7)
    .gte("review_count", 10);

  if (error || !data || data.length === 0) return [];

  const byNeighborhood = new Map<string, typeof data>();
  for (const row of data) {
    const key = row.neighborhood ?? row.borough ?? "other";
    const arr = byNeighborhood.get(key) ?? [];
    arr.push(row);
    byNeighborhood.set(key, arr);
  }

  const candidates: SignalCandidate[] = [];
  for (const [neighborhood, rows] of byNeighborhood) {
    if (rows.length < 2) continue; // one building alone isn't a trend piece
    const top = rows
      .sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0))
      .slice(0, 5);

    candidates.push({
      type: "new-top-rated",
      score: rows.length,
      headline_seed: `${rows.length} new A-grade buildings in ${neighborhood} this week`,
      metadata: {
        neighborhood,
        count: rows.length,
        top_buildings: top.map((b) => ({
          address: b.full_address,
          score: b.overall_score,
          reviews: b.review_count,
        })),
      },
      image_hint: `${neighborhood} ${city} residential`,
    });
  }

  return candidates;
};
