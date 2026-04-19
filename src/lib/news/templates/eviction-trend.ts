import type { Detector, SignalCandidate } from "./types";

/**
 * Eviction filing volume shift over the last 7 days vs the prior 7 days.
 * Reads from `evictions` for NYC and `lahd_evictions` for LA. Chicago, Miami,
 * Houston use their native eviction-like tables (see below).
 */
export const detectEvictionTrend: Detector = async ({ city, cfg, supabase, today }) => {
  const now = new Date(today + "T00:00:00Z").getTime();
  const day = 24 * 60 * 60 * 1000;
  const d14 = new Date(now - 14 * day).toISOString();
  const d7  = new Date(now - 7  * day).toISOString();
  const d0  = new Date(now).toISOString();

  const tableByCity: Record<string, string> = {
    nyc: "evictions",
    "los-angeles": "lahd_evictions",
  };
  const table = tableByCity[city];
  if (!table) return [];

  const { data, error } = await supabase
    .from(table)
    .select("filed_at")
    .gte("filed_at", d14)
    .lt("filed_at", d0);
  if (error || !data) return [];

  const d7ms = new Date(d7).getTime();
  let prior = 0, recent = 0;
  for (const row of data as { filed_at: string }[]) {
    if (new Date(row.filed_at).getTime() < d7ms) prior += 1;
    else recent += 1;
  }
  if (recent < 10 || prior < 5) return [];

  const deltaPct = ((recent - prior) / prior) * 100;
  if (Math.abs(deltaPct) < 15) return [];

  const dir = deltaPct > 0 ? "rose" : "fell";
  return [{
    type: "eviction-trend",
    score: Math.abs(deltaPct) + Math.log(recent),
    headline_seed: `Eviction filings ${dir} ${Math.abs(deltaPct).toFixed(0)}% this week`,
    metadata: { filings_recent: recent, filings_prior: prior, delta_pct: Number(deltaPct.toFixed(1)), source_table: table },
    image_hint: `${cfg.agencies[0]} court filings`,
  }];
};
