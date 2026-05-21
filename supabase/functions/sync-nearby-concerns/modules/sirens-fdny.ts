import type { SupabaseClient } from "@supabase/supabase-js";
import { batchUpsert } from "shared/batch-upsert.ts";
import {
  buildConcernRow,
  recordSyncRun,
  softDeleteUnseen,
  type ConcernInput,
} from "shared/nearby-concerns-helpers.ts";

const DATASET_ID = "hc8x-tcnd";
const ENDPOINT = `https://data.cityofnewyork.us/resource/${DATASET_ID}.json?$limit=10000`;
const SOURCE = "nyc_open_data_fdny_firehouses";
const SOURCE_URL = `https://data.cityofnewyork.us/Public-Safety/FDNY-Firehouse-Listing/${DATASET_ID}`;

interface FirehouseRecord {
  facilityname?: string;
  facilityaddress?: string;
  borough?: string;
  latitude?: string;
  longitude?: string;
  bin?: string;
  bbl?: string;
  nta?: string;
}

/**
 * Pure transform: Socrata FDNY row -> ConcernInput. Returns null on rows that
 * fail validation (missing name, invalid coordinates) so the caller can drop them.
 */
export function normalizeFirehouse(r: FirehouseRecord): ConcernInput | null {
  if (!r.facilityname?.trim()) return null;
  const lat = r.latitude !== undefined ? Number(r.latitude) : NaN;
  const lng = r.longitude !== undefined ? Number(r.longitude) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const sourceRecordId = (r.bin?.trim() || r.facilityname.trim());
  if (!sourceRecordId) return null;
  return {
    metro: "nyc",
    category: "noise",
    sub_category: "sirens",
    name: r.facilityname.trim(),
    address: r.facilityaddress?.trim() ?? null,
    borough: r.borough?.trim() ?? null,
    lat,
    lng,
    source: SOURCE,
    source_url: SOURCE_URL,
    source_record_id: sourceRecordId,
    metadata: {
      facility_type: "firehouse",
      bbl: r.bbl ?? null,
      nta: r.nta ?? null,
    },
  };
}

export async function syncSirensFdny(
  supabase: SupabaseClient,
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  try {
    const res = await fetch(ENDPOINT);
    if (!res.ok) throw new Error(`Socrata fetch failed: ${res.status} for ${DATASET_ID}`);
    const raw = (await res.json()) as FirehouseRecord[];

    const normalized: ConcernInput[] = [];
    for (const r of raw) {
      const input = normalizeFirehouse(r);
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
      "sirens-fdny",
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
