import type { Detector, SignalCandidate } from "./types";

/**
 * Rental-listings volume shift vs prior week. Uses building_listings if it
 * has a city/metro column; falls back silently if schema differs.
 */
export const detectListingsTrend: Detector = async ({ city, cfg, supabase, today }) => {
  const now = new Date(today + "T00:00:00Z").getTime();
  const day = 24 * 60 * 60 * 1000;
  const d14 = new Date(now - 14 * day).toISOString();
  const d7  = new Date(now - 7  * day).toISOString();
  const d0  = new Date(now).toISOString();

  const { data, error } = await supabase
    .from("building_listings")
    .select("first_seen_at, metro")
    .eq("metro", city)
    .gte("first_seen_at", d14)
    .lt("first_seen_at", d0);
  if (error || !data) return [];

  const d7ms = new Date(d7).getTime();
  let prior = 0, recent = 0;
  for (const row of data as { first_seen_at: string }[]) {
    if (new Date(row.first_seen_at).getTime() < d7ms) prior += 1;
    else recent += 1;
  }
  if (recent < 50 || prior < 50) return [];

  const deltaPct = ((recent - prior) / prior) * 100;
  if (Math.abs(deltaPct) < 10) return [];

  const dir = deltaPct > 0 ? "up" : "down";
  return [{
    type: "listings-trend",
    score: Math.abs(deltaPct) + Math.log(recent),
    headline_seed: `New rental listings ${dir} ${Math.abs(deltaPct).toFixed(0)}% this week`,
    metadata: { listings_recent: recent, listings_prior: prior, delta_pct: Number(deltaPct.toFixed(1)) },
    image_hint: `${cfg.landmark_neighborhoods[0]} apartment`,
  }];
};
