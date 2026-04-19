import type { Detector, SignalCandidate } from "./types";

/**
 * Fallback template — always emits a candidate so there's never a "no news
 * today" state for any city. Picks the landmark neighborhood with the highest
 * LucidIQ average among buildings with enough reviews.
 */
export const detectNeighborhoodFeature: Detector = async ({ city, cfg, supabase }) => {
  const { data, error } = await supabase
    .from("buildings")
    .select("neighborhood, overall_score, review_count")
    .eq("metro", city)
    .gte("review_count", 5)
    .in("neighborhood", cfg.landmark_neighborhoods);

  if (error || !data || data.length === 0) {
    // Even without DB data, emit a static candidate so the drafter has something.
    const fallback = cfg.landmark_neighborhoods[0];
    return [
      {
        type: "neighborhood-feature",
        score: 1, // low — only wins if nothing else triggered
        headline_seed: `A closer look at ${fallback}`,
        metadata: { neighborhood: fallback, fallback_reason: "no building data" },
        image_hint: `${fallback} ${city}`,
      },
    ];
  }

  // Group by neighborhood, compute weighted average
  const stats = new Map<string, { sum: number; weight: number; n: number }>();
  for (const r of data as { neighborhood: string | null; overall_score: number | null; review_count: number | null }[]) {
    if (!r.neighborhood || r.overall_score == null) continue;
    const w = r.review_count ?? 1;
    const cur = stats.get(r.neighborhood) ?? { sum: 0, weight: 0, n: 0 };
    cur.sum += r.overall_score * w;
    cur.weight += w;
    cur.n += 1;
    stats.set(r.neighborhood, cur);
  }

  const sorted = [...stats.entries()]
    .filter(([, v]) => v.n >= 5)
    .sort((a, b) => b[1].sum / b[1].weight - a[1].sum / a[1].weight);

  if (sorted.length === 0) {
    const fallback = cfg.landmark_neighborhoods[0];
    return [
      {
        type: "neighborhood-feature",
        score: 1,
        headline_seed: `A closer look at ${fallback}`,
        metadata: { neighborhood: fallback },
        image_hint: `${fallback} ${city}`,
      },
    ];
  }

  const [neighborhood, s] = sorted[0];
  const avg = s.sum / s.weight;
  return [
    {
      type: "neighborhood-feature",
      score: 1.5, // baseline fallback — beaten by any real signal
      headline_seed: `Why ${neighborhood} leads ${city.toUpperCase()} in LucidIQ scores`,
      metadata: {
        neighborhood,
        avg_score: Number(avg.toFixed(2)),
        buildings_scored: s.n,
      },
      image_hint: `${neighborhood} ${city} skyline`,
    },
  ];
};
