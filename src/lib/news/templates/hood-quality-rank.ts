import type { Detector } from "./types";
import { neighborhoodOf } from "./_helpers";

/**
 * Ranks neighborhoods by review-weighted average LucidIQ. Buildings has no
 * neighborhood column, so we aggregate by ZIP → neighborhood. Filtered to
 * buildings with >=5 reviews to keep the averages meaningful (and the scan
 * bounded).
 */
export const detectHoodQualityRank: Detector = async ({ city, supabase }) => {
  const { data, error } = await supabase
    .from("buildings")
    .select("zip_code, borough, overall_score, review_count")
    .eq("metro", city)
    .gte("review_count", 5)
    .not("overall_score", "is", null)
    .limit(5000);

  if (error || !data || data.length === 0) return [];

  const agg = new Map<string, { sum: number; w: number; n: number }>();
  for (const b of data as {
    zip_code: string | null;
    borough: string | null;
    overall_score: number | null;
    review_count: number | null;
  }[]) {
    if (b.overall_score == null) continue;
    const name = neighborhoodOf(b.zip_code, b.borough, city);
    const w = b.review_count ?? 1;
    const cur = agg.get(name) ?? { sum: 0, w: 0, n: 0 };
    cur.sum += b.overall_score * w;
    cur.w += w;
    cur.n += 1;
    agg.set(name, cur);
  }

  const ranked = [...agg.entries()]
    .filter(([, v]) => v.n >= 4)
    .map(([name, v]) => ({ name, avg: v.sum / v.w, n: v.n }))
    .sort((a, b) => b.avg - a.avg);
  if (ranked.length < 5) return [];

  const best = ranked.slice(0, 6);
  return [
    {
      type: "hood-quality-rank",
      score: 2.5,
      headline_seed: `The ${city.toUpperCase()} neighborhoods with the highest-rated buildings`,
      metadata: {
        neighborhood: best[0].name,
        ranking: "highest-quality",
        neighborhoods: best.map((b) => ({
          name: b.name,
          avg_score: Number(b.avg.toFixed(2)),
          buildings_scored: b.n,
        })),
      },
      image_hint: `${best[0].name} ${city} desirable street`,
    },
  ];
};
