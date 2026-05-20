import type { SupabaseClient } from "@supabase/supabase-js";
import { batchUpsert } from "shared/batch-upsert.ts";
import {
  buildConcernRow,
  recordSyncRun,
  softDeleteUnseen,
  type ConcernInput,
} from "shared/nearby-concerns-helpers.ts";

const DATASET_ID = "xw3j-2yxf";
const ENDPOINT = `https://data.cityofnewyork.us/resource/${DATASET_ID}.json?$limit=10000`;
const SOURCE = "nyc_open_data_dsny_garages";
const SOURCE_URL = `https://data.cityofnewyork.us/Environment/DSNY-Garages/${DATASET_ID}`;

interface DsnyRecord {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  type?: string;
  city?: string;
  zip?: string;
}

/**
 * Pure transform: Socrata DSNY row -> ConcernInput. Accepts lat/lng as either
 * number or numeric string (Socrata varies depending on column type).
 */
export function normalizeDsnyGarage(r: DsnyRecord): ConcernInput | null {
  if (!r.name?.trim()) return null;
  const lat = typeof r.latitude === "number" ? r.latitude : Number(r.latitude);
  const lng = typeof r.longitude === "number" ? r.longitude : Number(r.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    metro: "nyc",
    category: "environmental",
    sub_category: "dsny_garage",
    name: `DSNY ${r.name.trim()}`,
    address: r.address?.trim() ?? null,
    borough: r.city?.trim() ?? null,
    lat,
    lng,
    source: SOURCE,
    source_url: SOURCE_URL,
    source_record_id: r.name.trim(),
    metadata: {
      type: r.type ?? null,
      zip: r.zip ?? null,
    },
  };
}

export async function syncDsnyGarages(
  supabase: SupabaseClient,
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  try {
    const res = await fetch(ENDPOINT);
    if (!res.ok) throw new Error(`Socrata fetch failed: ${res.status} for ${DATASET_ID}`);
    const raw = (await res.json()) as DsnyRecord[];

    const normalized: ConcernInput[] = [];
    for (const r of raw) {
      const input = normalizeDsnyGarage(r);
      if (input) normalized.push(input);
    }

    const rows = normalized.map((input) => buildConcernRow(input));
    const seen = new Set(normalized.map((input) => input.source_record_id));

    const count = await batchUpsert(
      supabase,
      "nearby_concerns",
      rows,
      "source,source_record_id",
      errors,
      "dsny-garages",
    );

    await softDeleteUnseen(supabase, SOURCE, seen);
    await recordSyncRun(supabase, SOURCE, count, "completed");

    return { synced: count, errors };
  } catch (e) {
    const msg = (e as Error).message;
    await recordSyncRun(supabase, SOURCE, 0, "failed", msg);
    return { synced: 0, errors: [...errors, msg] };
  }
}
