import type { SupabaseClient } from "@supabase/supabase-js";
import type { City } from "@/lib/cities";
import type { Building } from "@/types";
import { CHIPS, type Chip, type ChipId } from "./chips";

const BUILDING_COLUMNS = `
  id, metro, borough, full_address, name, slug, year_built, total_units,
  residential_units, overall_score, review_count, violation_count,
  complaint_count, is_rent_stabilized, zip_code
`;

// `count: 'exact'` does a full COUNT(*) over the filtered rows, which times
// out on this buildings table (>1M rows, PostgREST ~8s statement_timeout).
// `count: 'planned'` uses the planner's row-estimate — ~instant, approximate
// but plenty accurate for "N buildings" UI and for pagination pages.
const COUNT_MODE = "planned" as const;

export async function countBuildingsForChip(
  supabase: SupabaseClient,
  city: City,
  chip: Chip,
): Promise<number> {
  let q = supabase.from("buildings").select("id", { count: COUNT_MODE, head: true }).eq("metro", city);
  for (const f of chip.column_filters) {
    if (f.op === "eq") q = q.eq(f.column, f.value);
    else if (f.op === "gte") q = q.gte(f.column, f.value);
    else if (f.op === "lte") q = q.lte(f.column, f.value);
    else if (f.op === "gt") q = q.gt(f.column, f.value);
    else if (f.op === "lt") q = q.lt(f.column, f.value);
  }
  const { count, error } = await q;
  if (error) {
    console.error("[building-list] countBuildingsForChip failed", { city, chip: chip.id, error });
    return 0;
  }
  return count ?? 0;
}

export async function getBuildingsForChip(
  supabase: SupabaseClient,
  city: City,
  chip: Chip,
  opts: { offset?: number; limit?: number; sort?: string } = {},
): Promise<{ buildings: Building[]; count: number }> {
  const { offset = 0, limit = 30, sort } = opts;

  let q = supabase.from("buildings").select(BUILDING_COLUMNS, { count: COUNT_MODE }).eq("metro", city);
  for (const f of chip.column_filters) {
    if (f.op === "eq") q = q.eq(f.column, f.value);
    else if (f.op === "gte") q = q.gte(f.column, f.value);
    else if (f.op === "lte") q = q.lte(f.column, f.value);
    else if (f.op === "gt") q = q.gt(f.column, f.value);
    else if (f.op === "lt") q = q.lt(f.column, f.value);
  }

  const sortKey = sort && ["overall_score", "review_count", "year_built", "residential_units"].includes(sort)
    ? sort
    : chip.sort.column;
  const sortAsc = sort ? false : chip.sort.ascending;
  q = q.order(sortKey, { ascending: sortAsc, nullsFirst: false });

  q = q.range(offset, offset + limit - 1);

  const { data, count, error } = await q;
  if (error) {
    console.error("[building-list] getBuildingsForChip failed", { city, chip: chip.id, error });
    return { buildings: [], count: 0 };
  }
  const rows = (data ?? []) as unknown as Building[];
  // Floor the count by (offset + rows returned) so pagination never reports
  // fewer pages than we've already proven to exist, even if the planner's
  // row-estimate comes back low.
  const floor = offset + rows.length;
  return {
    buildings: rows,
    count: Math.max(count ?? 0, floor),
  };
}

/** Summary stats for the index page — count + avg score per chip. */
export async function getChipSummary(
  supabase: SupabaseClient,
  city: City,
  chipId: ChipId,
): Promise<{ count: number; avg_score: number | null }> {
  const chip = CHIPS[chipId];
  let q = supabase
    .from("buildings")
    .select("overall_score", { count: COUNT_MODE })
    .eq("metro", city);
  for (const f of chip.column_filters) {
    if (f.op === "eq") q = q.eq(f.column, f.value);
    else if (f.op === "gte") q = q.gte(f.column, f.value);
    else if (f.op === "lte") q = q.lte(f.column, f.value);
    else if (f.op === "gt") q = q.gt(f.column, f.value);
    else if (f.op === "lt") q = q.lt(f.column, f.value);
  }
  const { data, count, error } = await q.limit(1000);
  if (error) {
    console.error("[building-list] getChipSummary failed", { city, chip: chipId, error });
    return { count: 0, avg_score: null };
  }
  // Treat any returned rows as proof the category is non-empty, even if the
  // planner's count estimate rounds to 0.
  const rowsSeen = data?.length ?? 0;
  const reportedCount = Math.max(count ?? 0, rowsSeen);
  if (!data || data.length === 0) return { count: reportedCount, avg_score: null };
  const scores = (data as { overall_score: number | null }[])
    .map((r) => r.overall_score)
    .filter((s): s is number => s !== null);
  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  return { count: reportedCount, avg_score: avg };
}
