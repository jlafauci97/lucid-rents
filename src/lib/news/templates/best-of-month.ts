import type { Detector, SignalCandidate } from "./types";

/**
 * End-of-month round-up of buildings that newly crossed into A-grade
 * (LucidIQ >= 4.0) in the last 30 days. Fires on the 1st–5th of the month.
 */
export const detectBestOfMonth: Detector = async ({ city, cfg, supabase, today }) => {
  const d = new Date(today + "T00:00:00Z");
  if (d.getUTCDate() > 5) return [];

  const d30 = new Date(d.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("buildings")
    .select("id, full_address, borough, neighborhood, overall_score, review_count, updated_at")
    .eq("metro", city)
    .gte("overall_score", 4.0)
    .gte("review_count", 10)
    .gte("updated_at", d30);
  if (error || !data || data.length < 3) return [];

  const top = data
    .sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0))
    .slice(0, 10);

  return [{
    type: "best-of-month",
    score: 2.5 + Math.log(data.length),
    headline_seed: `${data.length} new A-grade buildings added this month`,
    metadata: {
      count: data.length,
      top_buildings: top.map((b) => ({ address: b.full_address, score: b.overall_score, neighborhood: b.neighborhood })),
    },
    image_hint: `${cfg.landmark_neighborhoods[0]} A grade apartment`,
  }];
};
