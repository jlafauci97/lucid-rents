import type { SupabaseClient } from "@supabase/supabase-js";
import type { City } from "@/lib/cities";
import type { Building } from "@/types";
import { CHIPS, type Chip, type ChipId } from "./chips";

const BUILDING_COLUMNS = `
  id, metro, borough, full_address, name, slug, year_built, total_units,
  residential_units, overall_score, review_count, violation_count,
  complaint_count, is_rent_stabilized, zip_code
`;

export async function countBuildingsForChip(
  supabase: SupabaseClient,
  city: City,
  chip: Chip,
): Promise<number> {
  let q = supabase.from("buildings").select("id", { count: "exact", head: true }).eq("metro", city);
  for (const f of chip.column_filters) {
    if (f.op === "eq") q = q.eq(f.column, f.value);
    else if (f.op === "gte") q = q.gte(f.column, f.value);
    else if (f.op === "lte") q = q.lte(f.column, f.value);
    else if (f.op === "gt") q = q.gt(f.column, f.value);
    else if (f.op === "lt") q = q.lt(f.column, f.value);
  }
  const { count } = await q;
  return count ?? 0;
}

export async function getBuildingsForChip(
  supabase: SupabaseClient,
  city: City,
  chip: Chip,
  opts: { offset?: number; limit?: number; sort?: string } = {},
): Promise<{ buildings: Building[]; count: number }> {
  const { offset = 0, limit = 30, sort } = opts;

  let q = supabase.from("buildings").select(BUILDING_COLUMNS, { count: "exact" }).eq("metro", city);

  for (const f of chip.column_filters) {
    if (f.op === "eq") q = q.eq(f.column, f.value);
    else if (f.op === "gte") q = q.gte(f.column, f.value);
    else if (f.op === "lte") q = q.lte(f.column, f.value);
    else if (f.op === "gt") q = q.gt(f.column, f.value);
    else if (f.op === "lt") q = q.lt(f.column, f.value);
  }

  const sortKey =
    sort && ["overall_score", "review_count", "year_built", "residential_units"].includes(sort)
      ? sort
      : chip.sort.column;
  const sortAsc = sort ? false : chip.sort.ascending;
  q = q.order(sortKey, { ascending: sortAsc, nullsFirst: false });

  q = q.range(offset, offset + limit - 1);

  const { data, count, error } = await q;
  if (error) {
    return { buildings: [], count: 0 };
  }
  return {
    buildings: (data ?? []) as unknown as Building[],
    count: count ?? 0,
  };
}

export async function getChipSummary(
  supabase: SupabaseClient,
  city: City,
  chipId: ChipId,
): Promise<{ count: number; avg_score: number | null }> {
  const chip = CHIPS[chipId];
  let q = supabase
    .from("buildings")
    .select("overall_score", { count: "exact" })
    .eq("metro", city);
  for (const f of chip.column_filters) {
    if (f.op === "eq") q = q.eq(f.column, f.value);
    else if (f.op === "gte") q = q.gte(f.column, f.value);
    else if (f.op === "lte") q = q.lte(f.column, f.value);
    else if (f.op === "gt") q = q.gt(f.column, f.value);
    else if (f.op === "lt") q = q.lt(f.column, f.value);
  }
  const { data, count } = await q.limit(1000);
  if (!data || data.length === 0) return { count: count ?? 0, avg_score: null };
  const scores = (data as { overall_score: number | null }[])
    .map((r) => r.overall_score)
    .filter((s): s is number => s !== null);
  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  return { count: count ?? 0, avg_score: avg };
}
