import type { Detector, SignalCandidate } from "./types";

/**
 * Miami-only. Fires during Atlantic hurricane season (Jun 1 – Nov 30) when
 * storm-season tenant rights / flood-insurance context is most relevant.
 * Uses `miami_storm_damage` / `miami_flood_claims` if recent filings exist.
 */
export const detectHurricaneWatch: Detector = async ({ city, cfg, supabase, today }) => {
  if (city !== "miami") return [];
  const d = new Date(today + "T00:00:00Z");
  const month = d.getUTCMonth() + 1;
  if (month < 6 || month > 11) return [];

  // Pull recent storm / flood activity for context (best-effort)
  const since = new Date(d.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [storm, flood] = await Promise.all([
    supabase.from("miami_storm_damage").select("id", { count: "exact", head: true }).gte("reported_at", since),
    supabase.from("miami_flood_claims").select("id", { count: "exact", head: true }).gte("claimed_at", since),
  ]);
  const stormN = storm.count ?? 0;
  const floodN = flood.count ?? 0;

  return [{
    type: "hurricane-watch",
    score: 2.5 + Math.log(1 + stormN + floodN) * 0.3,
    headline_seed: "Hurricane season: what renters need to check now",
    metadata: { season_month: month, storm_damage_last_30d: stormN, flood_claims_last_30d: floodN, agencies: cfg.agencies },
    image_hint: "Miami hurricane prep",
  }];
};
