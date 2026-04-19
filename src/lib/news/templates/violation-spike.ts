import type { Detector, SignalCandidate } from "./types";

/**
 * Detects landlords (ownerships) that added an unusual number of code/housing
 * violations in the last 7 days. Reads from the city's primary violation
 * table: hpd_violations (NYC), lahd_violation_summary (LA),
 * chicago_rlto_violations (Chicago), miami_unsafe_structures (Miami),
 * houston_dangerous_buildings (Houston).
 *
 * The detector normalizes all of them to a common shape and picks the top
 * landlord by new-violation count in the window.
 */
export const detectViolationSpike: Detector = async ({ city, cfg, supabase, today }) => {
  const now = new Date(today + "T00:00:00Z");
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const tableByCity: Record<string, string> = {
    nyc: "hpd_violations",
    "los-angeles": "lahd_violation_summary",
    chicago: "chicago_rlto_violations",
    miami: "miami_unsafe_structures",
    houston: "houston_dangerous_buildings",
  };
  const table = tableByCity[city];
  if (!table) return [];

  // We select a superset of fields; individual tables may have some nulls.
  const { data, error } = await supabase
    .from(table)
    .select("building_id, landlord, severity, issued_at, created_at")
    .gte("created_at", d7);

  if (error || !data) return [];

  // Count per landlord
  const counts = new Map<string, { n: number; sample_building: string }>();
  for (const row of data as {
    building_id: string | null;
    landlord: string | null;
    created_at: string;
  }[]) {
    const key = row.landlord ?? "unknown";
    if (key === "unknown") continue;
    const prev = counts.get(key) ?? { n: 0, sample_building: row.building_id ?? "" };
    prev.n += 1;
    counts.set(key, prev);
  }

  const top = [...counts.entries()]
    .filter(([, v]) => v.n >= cfg.thresholds.violations_spike_n)
    .sort((a, b) => b[1].n - a[1].n);

  if (top.length === 0) return [];

  return top.slice(0, 3).map<SignalCandidate>(([landlord, { n, sample_building }]) => ({
    type: "violation-spike",
    score: n, // raw count, fine for picking within this template
    headline_seed: `${landlord} cited for ${n} new violations this week`,
    metadata: {
      landlord,
      violations_7d: n,
      sample_building_id: sample_building,
      source_table: table,
    },
    image_hint: `${cfg.agencies[0]} inspector apartment`,
  }));
};
