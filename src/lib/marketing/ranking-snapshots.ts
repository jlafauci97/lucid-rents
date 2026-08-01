import { createAdminClient } from "@/lib/supabase/admin";
import { createCacheClient } from "@/lib/supabase/cache-client";
import { VALID_CITIES, type City } from "@/lib/cities";
import {
  worstBuildings,
  worstLandlords,
  worstNeighborhoods,
  type StoryMeta,
  type RankedBuilding,
  type RankedLandlord,
  type RankedNeighborhood,
} from "./data-stories";

export type SnapshotKind = "worst_buildings" | "worst_landlords" | "worst_neighborhoods";

export const SNAPSHOT_KINDS: SnapshotKind[] = [
  "worst_buildings",
  "worst_landlords",
  "worst_neighborhoods",
];

export type SnapshotRows = RankedBuilding[] | RankedLandlord[] | RankedNeighborhood[];

export interface RankingSnapshot {
  period: string;
  city: City;
  kind: SnapshotKind;
  rows: SnapshotRows;
  meta: StoryMeta;
}

/** Current period as YYYY-MM. */
export function currentPeriod(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isValidPeriod(period: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
}

export function periodLabel(period: string): string {
  const [year, month] = period.split("-");
  const monthName = new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleString(
    "en-US",
    { month: "long", timeZone: "UTC" }
  );
  return `${monthName} ${year}`;
}

async function buildRows(kind: SnapshotKind, city: City) {
  if (kind === "worst_buildings") return worstBuildings(city, { limit: 25 });
  if (kind === "worst_landlords") return worstLandlords(city, 25);
  return worstNeighborhoods(city, 25);
}

/**
 * Writes this period's snapshot for one city/kind.
 *
 * Never overwrites: a published ranking that silently changes is worse than no
 * ranking, because anything citing it becomes wrong without warning. A repeat
 * run for the same period is a no-op.
 */
export async function generateSnapshot(
  kind: SnapshotKind,
  city: City,
  period = currentPeriod()
): Promise<{ created: boolean; reason?: string }> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("marketing_ranking_snapshots")
    .select("id")
    .eq("period", period)
    .eq("city", city)
    .eq("kind", kind)
    .maybeSingle();

  if (existing) return { created: false, reason: "snapshot already exists for this period" };

  const { meta, rows } = await buildRows(kind, city);
  if (rows.length < 5) {
    return { created: false, reason: `only ${rows.length} ranked rows — not publishing` };
  }

  const { error } = await supabase.from("marketing_ranking_snapshots").insert({
    period,
    city,
    kind,
    rows,
    meta,
  });

  // Unique-index collision means a concurrent run won the race.
  if (error) {
    if (error.code === "23505") return { created: false, reason: "already exists" };
    throw error;
  }

  return { created: true };
}

/** Reads a published snapshot. Uses the cached client — these never change. */
export async function getSnapshot(
  city: City,
  period: string,
  kind: SnapshotKind
): Promise<RankingSnapshot | null> {
  if (!isValidPeriod(period) || !VALID_CITIES.includes(city)) return null;

  const supabase = createCacheClient();
  const { data, error } = await supabase
    .from("marketing_ranking_snapshots")
    .select("period, city, kind, rows, meta")
    .eq("city", city)
    .eq("period", period)
    .eq("kind", kind)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as RankingSnapshot;
}

/** Every period we have published for a city, newest first. */
export async function listPeriods(city: City): Promise<string[]> {
  const supabase = createCacheClient();
  const { data } = await supabase
    .from("marketing_ranking_snapshots")
    .select("period")
    .eq("city", city)
    .order("period", { ascending: false });

  return [...new Set((data ?? []).map((r) => r.period as string))];
}
