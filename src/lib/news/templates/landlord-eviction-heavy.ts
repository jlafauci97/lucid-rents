import type { Detector, SignalCandidate } from "./types";

/**
 * Owners filing the most evictions across their portfolio. Aggregates
 * `buildings.eviction_count` by owner — bounded by a top-N building fetch so it
 * never scans the whole table. Eviction data is densest in NYC/LA; other metros
 * simply return nothing.
 */
export const detectLandlordEvictionHeavy: Detector = async ({ city, supabase }) => {
  const { data, error } = await supabase
    .from("buildings")
    .select("owner_name, eviction_count")
    .eq("metro", city)
    .gte("eviction_count", 2)
    .order("eviction_count", { ascending: false })
    .limit(400);

  if (error || !data || data.length === 0) return [];

  const agg = new Map<string, { evictions: number; buildings: number }>();
  for (const b of data as { owner_name: string | null; eviction_count: number | null }[]) {
    if (!b.owner_name || !b.eviction_count) continue;
    const cur = agg.get(b.owner_name) ?? { evictions: 0, buildings: 0 };
    cur.evictions += b.eviction_count;
    cur.buildings += 1;
    agg.set(b.owner_name, cur);
  }

  const top = [...agg.entries()]
    .filter(([, v]) => v.evictions >= 5)
    .sort((a, b) => b[1].evictions - a[1].evictions)
    .slice(0, 8);
  if (top.length === 0) return [];

  return top.map<SignalCandidate>(([landlord, v]) => ({
    type: "landlord-eviction-heavy",
    score: 2.5 + Math.log(v.evictions + 1),
    headline_seed: `${landlord} filed ${v.evictions} evictions across ${v.buildings} buildings`,
    metadata: {
      landlord,
      evictions: v.evictions,
      buildings: v.buildings,
    },
    image_hint: `${city} housing court eviction`,
  }));
};
