import type { Detector, SignalCandidate } from "./types";
import { median, neighborhoodOf } from "./_helpers";

/**
 * Neighborhoods with a significant median-rent shift over the last ~30 days vs
 * the prior ~30 days. Reads `zillow_rents`, which is keyed by ZIP + month
 * (`zip_code`, `date`, `median_rent`, `borough`, `metro`). We roll ZIPs up into
 * neighborhoods so the story reads "Astoria rent rose 4%" not "11106 rose 4%".
 *
 * Score = |delta_pct| * log(samples) — big moves on thin data lose to medium
 * moves on thick data, matching editorial intuition.
 */
export const detectRentTrend: Detector = async ({ city, cfg, supabase, today }) => {
  const now = new Date(today + "T00:00:00Z");
  const day = 24 * 60 * 60 * 1000;
  const d60 = new Date(now.getTime() - 60 * day).toISOString().slice(0, 10);
  const d30 = new Date(now.getTime() - 30 * day).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("zillow_rents")
    .select("zip_code, borough, median_rent, date")
    .eq("metro", city)
    .gte("date", d60);

  if (error || !data || data.length === 0) return [];

  const grouped = new Map<string, { prior: number[]; recent: number[] }>();
  for (const row of data as {
    zip_code: string | null;
    borough: string | null;
    median_rent: number | null;
    date: string;
  }[]) {
    if (!row.median_rent || row.median_rent <= 0) continue;
    const hood = neighborhoodOf(row.zip_code, row.borough, city);
    const g = grouped.get(hood) ?? { prior: [], recent: [] };
    if (row.date >= d30) g.recent.push(row.median_rent);
    else g.prior.push(row.median_rent);
    grouped.set(hood, g);
  }

  const candidates: SignalCandidate[] = [];
  for (const [neighborhood, { prior, recent }] of grouped) {
    if (prior.length < 2 || recent.length < 2) continue;
    const mp = median(prior);
    const mr = median(recent);
    if (mp == null || mr == null) continue;

    const deltaPct = ((mr - mp) / mp) * 100;
    if (Math.abs(deltaPct) < cfg.thresholds.rent_delta_pct) continue;

    const direction = deltaPct > 0 ? "rose" : "fell";
    candidates.push({
      type: "rent-trend",
      score: Math.abs(deltaPct) * Math.log(recent.length + prior.length + 1),
      headline_seed: `${neighborhood} median rent ${direction} ${Math.abs(deltaPct).toFixed(1)}%`,
      metadata: {
        neighborhood,
        median_prior: Math.round(mp),
        median_recent: Math.round(mr),
        delta_pct: Number(deltaPct.toFixed(2)),
        samples: prior.length + recent.length,
        window_days: 30,
      },
      image_hint: `${neighborhood} ${city} apartment`,
    });
  }

  return candidates;
};
