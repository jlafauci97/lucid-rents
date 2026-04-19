import type { Detector, SignalCandidate } from "./types";

/**
 * Construction-permit filing volume shift over 30 days vs prior 30 days.
 * NYC-only for now (dob_permits is the only confirmed permit table with
 * good coverage).
 */
export const detectPermitTrend: Detector = async ({ city, cfg, supabase, today }) => {
  if (city !== "nyc") return [];
  const now = new Date(today + "T00:00:00Z").getTime();
  const day = 24 * 60 * 60 * 1000;
  const d60 = new Date(now - 60 * day).toISOString();
  const d30 = new Date(now - 30 * day).toISOString();
  const d0  = new Date(now).toISOString();

  const { data, error } = await supabase
    .from("dob_permits")
    .select("filed_at, job_type, proposed_dwelling_units")
    .eq("job_type", "NB")
    .gte("filed_at", d60)
    .lt("filed_at", d0);
  if (error || !data) return [];

  const d30ms = new Date(d30).getTime();
  let prior = 0, recent = 0, recentUnits = 0;
  for (const row of data as { filed_at: string; proposed_dwelling_units: number | null }[]) {
    const units = row.proposed_dwelling_units ?? 0;
    if (new Date(row.filed_at).getTime() < d30ms) prior += 1;
    else { recent += 1; recentUnits += units; }
  }
  if (recent < 5 || prior < 5) return [];

  const deltaPct = ((recent - prior) / prior) * 100;
  if (Math.abs(deltaPct) < 20) return [];

  const dir = deltaPct > 0 ? "surged" : "cooled";
  return [{
    type: "permit-trend",
    score: Math.abs(deltaPct),
    headline_seed: `New-construction filings ${dir} ${Math.abs(deltaPct).toFixed(0)}% this month`,
    metadata: { permits_recent: recent, permits_prior: prior, units_recent: recentUnits, delta_pct: Number(deltaPct.toFixed(1)) },
    image_hint: "new construction site",
  }];
};
