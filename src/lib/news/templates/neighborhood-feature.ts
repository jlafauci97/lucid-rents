import type { Detector, SignalCandidate } from "./types";
import { neighborhoodOf } from "./_helpers";

/**
 * Fallback feature — always emits a candidate so there's never a "no news
 * today" state. Picks the neighborhood with the highest review-weighted LucidIQ
 * average among buildings with enough reviews. Neighborhood is derived from ZIP.
 */
export const detectNeighborhoodFeature: Detector = async ({ city, cfg, supabase }) => {
  const { data, error } = await supabase
    .from("buildings")
    .select("zip_code, borough, overall_score, review_count")
    .eq("metro", city)
    .gte("review_count", 5)
    .not("overall_score", "is", null);

  const fallback = (): SignalCandidate[] => {
    const hood = cfg.landmark_neighborhoods[0];
    return [
      {
        type: "neighborhood-feature",
        score: 1,
        headline_seed: `A closer look at ${hood}`,
        metadata: { neighborhood: hood, fallback_reason: "no building data" },
        image_hint: `${hood} ${city}`,
      },
    ];
  };

  if (error || !data || data.length === 0) return fallback();

  const stats = new Map<string, { sum: number; weight: number; n: number }>();
  for (const r of data as {
    zip_code: string | null;
    borough: string | null;
    overall_score: number | null;
    review_count: number | null;
  }[]) {
    if (r.overall_score == null) continue;
    const hood = neighborhoodOf(r.zip_code, r.borough, city);
    const w = r.review_count ?? 1;
    const cur = stats.get(hood) ?? { sum: 0, weight: 0, n: 0 };
    cur.sum += r.overall_score * w;
    cur.weight += w;
    cur.n += 1;
    stats.set(hood, cur);
  }

  const sorted = [...stats.entries()]
    .filter(([, v]) => v.n >= 5)
    .sort((a, b) => b[1].sum / b[1].weight - a[1].sum / a[1].weight);

  if (sorted.length === 0) return fallback();

  const [neighborhood, s] = sorted[0];
  const avg = s.sum / s.weight;
  return [
    {
      type: "neighborhood-feature",
      score: 1.5,
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
