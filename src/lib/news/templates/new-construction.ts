import type { Detector, SignalCandidate } from "./types";

/**
 * Big new-construction permits filed in the last 7 days. Reads from the
 * closest table per city. NYC has `dob_permits` with unit counts; other
 * cities use their own permit tables where available.
 */
export const detectNewConstruction: Detector = async ({ city, cfg, supabase, today }) => {
  const now = new Date(today + "T00:00:00Z");
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Currently only NYC's dob_permits is confirmed to have proposed_dwelling_units.
  // Other cities use the generic permits table once those normalize; for now
  // we only surface NYC construction stories here and other cities fall back
  // to neighborhood-feature.
  if (city !== "nyc") return [];

  const { data, error } = await supabase
    .from("dob_permits")
    .select("building_id, full_address, borough, job_type, proposed_dwelling_units, filed_at")
    .eq("job_type", "NB")
    .gte("proposed_dwelling_units", cfg.thresholds.new_construction_units_min)
    .gte("filed_at", d7);

  if (error || !data || data.length === 0) return [];

  const top = data
    .sort((a, b) => (b.proposed_dwelling_units ?? 0) - (a.proposed_dwelling_units ?? 0))
    .slice(0, 1);

  return top.map<SignalCandidate>((p) => ({
    type: "new-construction",
    score: (p.proposed_dwelling_units ?? 0) / 10,
    headline_seed: `${p.proposed_dwelling_units}-unit building filed in ${p.borough ?? "NYC"}`,
    metadata: {
      address: p.full_address,
      borough: p.borough,
      units: p.proposed_dwelling_units,
      job_type: p.job_type,
      building_id: p.building_id,
    },
    image_hint: `new construction ${p.borough ?? city}`,
  }));
};
