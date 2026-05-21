import type { SupabaseClient } from "@supabase/supabase-js";

export type ConcernCategory = "public_safety" | "noise" | "environmental";

export interface ConcernInput {
  metro: string;
  category: ConcernCategory;
  sub_category: string;
  name: string;
  address?: string | null;
  borough?: string | null;
  neighborhood?: string | null;
  lat: number;
  lng: number;
  source: string;
  source_url?: string | null;
  source_record_id: string;
  metadata?: Record<string, unknown>;
}

const VALID_CATEGORIES: ConcernCategory[] = ["public_safety", "noise", "environmental"];

export function buildConcernRow(input: ConcernInput): Record<string, unknown> {
  if (!VALID_CATEGORIES.includes(input.category)) {
    throw new Error(`Invalid category: ${input.category}`);
  }
  if (!input.name?.trim()) {
    throw new Error("name is required");
  }
  if (!input.source_record_id?.trim()) {
    throw new Error("source_record_id is required");
  }
  if (typeof input.lat !== "number" || typeof input.lng !== "number") {
    throw new Error("lat/lng must be numbers");
  }
  return {
    metro: input.metro,
    category: input.category,
    sub_category: input.sub_category,
    name: input.name.trim(),
    address: input.address ?? null,
    borough: input.borough ?? null,
    neighborhood: input.neighborhood ?? null,
    geom: `SRID=4326;POINT(${input.lng} ${input.lat})`,
    lat: input.lat,
    lng: input.lng,
    source: input.source,
    source_url: input.source_url ?? null,
    source_record_id: input.source_record_id,
    metadata: input.metadata ?? {},
    active: true,
    last_synced: new Date().toISOString(),
  };
}

export function normalizeSubCategory(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * Soft-delete: mark rows from `source` not seen in this run as inactive.
 * Call after the upsert phase, passing the set of source_record_ids that WERE seen.
 */
export async function softDeleteUnseen(
  supabase: SupabaseClient,
  source: string,
  seenSourceRecordIds: Set<string>,
): Promise<number> {
  if (seenSourceRecordIds.size === 0) return 0;
  const seen = Array.from(seenSourceRecordIds);
  const { error, count } = await supabase
    .from("nearby_concerns")
    .update(
      { active: false, last_synced: new Date().toISOString() },
      { count: "exact" },
    )
    .eq("source", source)
    .eq("active", true)
    .not("source_record_id", "in", `(${seen.map((s) => `"${s}"`).join(",")})`);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Logs to the existing `sync_log` table (already used by sync-energy, sync orchestrator).
 */
export async function recordSyncRun(
  supabase: SupabaseClient,
  source: string,
  records_synced: number,
  status: "completed" | "failed",
  error_message?: string,
): Promise<void> {
  await supabase.from("sync_log").insert({
    source,
    records_synced,
    completed_at: new Date().toISOString(),
    status,
    error: error_message ?? null,
  });
}
