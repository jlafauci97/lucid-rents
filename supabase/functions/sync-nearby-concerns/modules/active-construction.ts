import type { SupabaseClient } from "@supabase/supabase-js";
import { batchUpsert } from "shared/batch-upsert.ts";
import {
  buildConcernRow,
  recordSyncRun,
  softDeleteUnseen,
  type ConcernInput,
} from "shared/nearby-concerns-helpers.ts";

// Derives "active construction" POIs from the existing sidewalk_sheds table,
// which represents major construction-related permits in NYC. A shed is
// required for any work over 40 feet up or any work that could endanger
// pedestrians — a strong proxy for ongoing noisy construction at the address.
//
// Filter:
//   - permit_status IN ACTIVE | ISSUED | RE-ISSUED (case-insensitive)
//   - issued_date within last 365 days OR expired_date >= today (still up)
//
// Joins through buildings to get lat/lng (sidewalk_sheds has bin but not coords).

const SOURCE = "nyc_dob_sidewalk_sheds_derived";
const SOURCE_URL =
  "https://data.cityofnewyork.us/Housing-Development/DOB-Permit-Issuance/ipu4-2q9a";

interface ShedRow {
  work_permit: string;
  house_no: string | null;
  street_name: string | null;
  borough: string | null;
  permit_status: string | null;
  filing_reason: string | null;
  issued_date: string | null;
  expired_date: string | null;
  job_description: string | null;
  building: {
    lat: number | null;
    lng: number | null;
    neighborhood: string | null;
  } | null;
}

/**
 * Pure transform: sidewalk_sheds row -> ConcernInput.
 * Returns null if the row lacks coordinates or fails the active-status filter.
 */
export function normalizeShed(r: ShedRow): ConcernInput | null {
  const b = r.building;
  if (!b || b.lat === null || b.lng === null) return null;
  if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return null;

  const addressParts = [r.house_no, r.street_name].filter(Boolean).join(" ").trim();
  const name = addressParts
    ? `Construction: ${addressParts}`
    : `Construction permit ${r.work_permit}`;

  return {
    metro: "nyc",
    category: "noise",
    sub_category: "active_construction",
    name,
    address: addressParts || null,
    borough: r.borough ?? null,
    neighborhood: b.neighborhood ?? null,
    lat: b.lat,
    lng: b.lng,
    source: SOURCE,
    source_url: SOURCE_URL,
    source_record_id: r.work_permit,
    metadata: {
      filing_reason: r.filing_reason ?? null,
      issued_date: r.issued_date ?? null,
      expired_date: r.expired_date ?? null,
      permit_status: r.permit_status ?? null,
      job_description: r.job_description ?? null,
    },
  };
}

export async function syncActiveConstruction(
  supabase: SupabaseClient,
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  try {
    // Pull active sheds with their joined building location.
    // Limit is generous; an unbounded scan would be in the high thousands.
    const { data, error } = await supabase
      .from("sidewalk_sheds")
      .select(
        "work_permit, house_no, street_name, borough, permit_status, filing_reason, issued_date, expired_date, job_description, building:building_id(lat, lng, neighborhood)",
      )
      .in("permit_status", ["ACTIVE", "ISSUED", "RE-ISSUED", "Active", "Issued"])
      .gte("issued_date", new Date(Date.now() - 365 * 86400 * 1000).toISOString().slice(0, 10))
      .limit(20000);
    if (error) throw error;
    const rows = (data ?? []) as unknown as ShedRow[];

    const normalized: ConcernInput[] = [];
    for (const r of rows) {
      const input = normalizeShed(r);
      if (input) normalized.push(input);
    }

    const concernRows = normalized.map((input) => buildConcernRow(input));
    const seen = new Set(normalized.map((input) => input.source_record_id));

    const count = await batchUpsert(
      supabase,
      "nearby_concerns",
      concernRows,
      "source,source_record_id",
      errors,
      "active-construction",
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
