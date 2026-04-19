import type { Detector, SignalCandidate } from "./types";

/**
 * Detects neighborhoods with a significant median-rent shift over the last
 * 30 days vs the prior 30 days. Reads from `zillow_rents` (primary) and falls
 * back to `building_rents` when the metro has no Zillow coverage.
 *
 * A candidate is emitted per neighborhood that clears both thresholds:
 *   - |delta_pct| >= cfg.thresholds.rent_delta_pct
 *   - listings >= cfg.thresholds.listings_min (in each window)
 *
 * Score = |delta_pct| * log(listings) — big moves on thin markets lose to
 * medium moves on thick markets, which matches editorial intuition.
 */
export const detectRentTrend: Detector = async ({ city, cfg, supabase, today }) => {
  const now = new Date(today + "T00:00:00Z");
  const day = 24 * 60 * 60 * 1000;
  const d0 = new Date(now.getTime() - 60 * day).toISOString();
  const d30 = new Date(now.getTime() - 30 * day).toISOString();
  const d60 = now.toISOString();

  // Try zillow_rents first
  const { data, error } = await supabase
    .from("zillow_rents")
    .select("neighborhood, rent, observed_at, metro")
    .eq("metro", city)
    .gte("observed_at", d0)
    .lt("observed_at", d60);

  if (error || !data || data.length === 0) return [];

  // Bucket by neighborhood × window
  const grouped = new Map<
    string,
    { prior: number[]; recent: number[] }
  >();
  const d30ms = new Date(d30).getTime();

  for (const row of data as { neighborhood: string | null; rent: number | null; observed_at: string }[]) {
    if (!row.neighborhood || !row.rent) continue;
    const g = grouped.get(row.neighborhood) ?? { prior: [], recent: [] };
    const t = new Date(row.observed_at).getTime();
    if (t < d30ms) g.prior.push(row.rent);
    else g.recent.push(row.rent);
    grouped.set(row.neighborhood, g);
  }

  const median = (xs: number[]) => {
    if (xs.length === 0) return null;
    const sorted = [...xs].sort((a, b) => a - b);
    const m = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
  };

  const candidates: SignalCandidate[] = [];
  for (const [neighborhood, { prior, recent }] of grouped) {
    if (prior.length < cfg.thresholds.listings_min) continue;
    if (recent.length < cfg.thresholds.listings_min) continue;
    const mp = median(prior);
    const mr = median(recent);
    if (mp == null || mr == null) continue;

    const deltaPct = ((mr - mp) / mp) * 100;
    if (Math.abs(deltaPct) < cfg.thresholds.rent_delta_pct) continue;

    const direction = deltaPct > 0 ? "rose" : "fell";
    const score = Math.abs(deltaPct) * Math.log(recent.length);

    candidates.push({
      type: "rent-trend",
      score,
      headline_seed: `${neighborhood} median rent ${direction} ${Math.abs(deltaPct).toFixed(1)}%`,
      metadata: {
        neighborhood,
        median_prior: Math.round(mp),
        median_recent: Math.round(mr),
        delta_pct: Number(deltaPct.toFixed(2)),
        listings_prior: prior.length,
        listings_recent: recent.length,
        window_days: 30,
      },
      image_hint: `${neighborhood} ${city} apartment`,
    });
  }

  return candidates;
};
