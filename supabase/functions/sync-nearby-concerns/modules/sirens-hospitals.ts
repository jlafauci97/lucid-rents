import type { SupabaseClient } from "@supabase/supabase-js";
import { batchUpsert } from "shared/batch-upsert.ts";
import {
  buildConcernRow,
  recordSyncRun,
  softDeleteUnseen,
  type ConcernInput,
} from "shared/nearby-concerns-helpers.ts";

// NYC Open Data — "hospital" dataset. Covers NYC Health + Hospitals (HHC)
// facilities. The "Acute Care Hospital" facility_type has 24/7 ER bays
// (the source of relevant ambulance siren noise). The dataset only covers
// the 11 public HHC hospitals — private hospitals (Mt Sinai, NYP, NYU
// Langone, Lenox Hill, etc.) are not in this feed. A follow-up module
// would add them via the Facilities Database (2fpa-bnsx).
const DATASET_ID = "q6fj-vxf8";
const ENDPOINT = `https://data.cityofnewyork.us/resource/${DATASET_ID}.json?$limit=10000`;
const SOURCE = "nyc_open_data_hospital_hhc";
const SOURCE_URL = `https://data.cityofnewyork.us/Health/hospital/${DATASET_ID}`;

// Only facility types that operate 24/7 emergency departments / ambulance bays.
const ER_FACILITY_TYPES = new Set(["Acute Care Hospital"]);

interface GeoPoint {
  type?: "Point";
  coordinates?: [number, number]; // [lng, lat]
}

interface HospitalRecord {
  facility_type?: string;
  borough?: string;
  facility_name?: string;
  phone?: string;
  cross_streets?: string;
  location_1?: GeoPoint;
}

/**
 * Pure transform: NYC HHC hospital row -> ConcernInput. Filters to ER-having
 * facility types only. Returns null on rows that fail validation.
 */
export function normalizeHospital(r: HospitalRecord): ConcernInput | null {
  if (!r.facility_name?.trim()) return null;
  if (!r.facility_type || !ER_FACILITY_TYPES.has(r.facility_type)) return null;
  const coords = r.location_1?.coordinates;
  if (!coords || coords.length !== 2) return null;
  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    metro: "nyc",
    category: "noise",
    sub_category: "sirens",
    name: r.facility_name.trim(),
    address: r.cross_streets?.trim() ?? null,
    borough: r.borough?.trim() ?? null,
    lat,
    lng,
    source: SOURCE,
    source_url: SOURCE_URL,
    source_record_id: r.facility_name.trim(),
    metadata: {
      facility_type: "hospital_er",
      hhc_facility_type: r.facility_type,
      phone: r.phone ?? null,
    },
  };
}

export async function syncSirensHospitals(
  supabase: SupabaseClient,
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  try {
    const res = await fetch(ENDPOINT);
    if (!res.ok) throw new Error(`Socrata fetch failed: ${res.status} for ${DATASET_ID}`);
    const raw = (await res.json()) as HospitalRecord[];

    const normalized: ConcernInput[] = [];
    for (const r of raw) {
      const input = normalizeHospital(r);
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
      "sirens-hospitals",
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
