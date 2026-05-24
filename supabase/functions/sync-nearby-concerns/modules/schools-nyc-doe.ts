import type { SupabaseClient } from "@supabase/supabase-js";
import { batchUpsert } from "shared/batch-upsert.ts";
import {
  buildConcernRow,
  recordSyncRun,
  softDeleteUnseen,
  type ConcernInput,
} from "shared/nearby-concerns-helpers.ts";

// NYC DOE 2019-2020 School Locations — the freshest queryable Socrata
// dataset (later "School Point Locations" sets are stored as shapefiles
// and not exposed via the JSON resource API). School building footprints
// don't change meaningfully year-to-year, so this is a faithful proxy for
// "where K-12 noise sources are today."
const DATASET_ID = "wg9x-4ke6";
const ENDPOINT = `https://data.cityofnewyork.us/resource/${DATASET_ID}.json?$limit=5000&status_descriptions=Open`;
const SOURCE = "nyc_doe_school_locations";
const SOURCE_URL = `https://data.cityofnewyork.us/Education/2019-2020-School-Locations/${DATASET_ID}`;

interface SchoolRecord {
  location_code?: string;
  location_name?: string;
  primary_address_line_1?: string;
  location_category_description?: string; // "Elementary" / "Junior High-Intermediate-Middle" / "High school" / etc
  location_type_description?: string;
  grades_final_text?: string;
  status_descriptions?: string;
  managed_by_name?: string; // "DOE" / "Charter" / "Pre-K Center"
  primary_building_code?: string;
  latitude?: string;
  longitude?: string;
  borough_block_lot?: string;
  nta?: string;
}

/**
 * Map NYC borough codes (first char of bbl / nta) to display borough.
 * BBL: 1=Manhattan, 2=Bronx, 3=Brooklyn, 4=Queens, 5=Staten Island.
 */
function boroughFromBbl(bbl: string | undefined): string | null {
  if (!bbl) return null;
  switch (bbl.charAt(0)) {
    case "1":
      return "Manhattan";
    case "2":
      return "Bronx";
    case "3":
      return "Brooklyn";
    case "4":
      return "Queens";
    case "5":
      return "Staten Island";
    default:
      return null;
  }
}

/**
 * Pure transform: Socrata school row -> ConcernInput. Returns null on rows
 * that fail validation (missing name/coords, non-K12 facility types).
 */
export function normalizeSchool(r: SchoolRecord): ConcernInput | null {
  if (!r.location_name?.trim()) return null;
  if (r.status_descriptions && r.status_descriptions !== "Open") return null;

  const lat = r.latitude !== undefined ? Number(r.latitude) : NaN;
  const lng = r.longitude !== undefined ? Number(r.longitude) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // Sanity-bound to NYC. Anything outside drops to keep bad coords from
  // surfacing in radius queries.
  if (lat < 40.4 || lat > 41.0 || lng < -74.3 || lng > -73.6) return null;

  // The dataset includes Pre-K-only centers, transfer schools, and
  // alternative programs. They all produce drop-off / dismissal noise, so
  // include them all — the noise pattern is similar even if grade levels
  // differ. Skip clearly-administrative location_types (not actual school
  // sites) — these have category "District 75 Citywide" or "Administrative".
  const cat = (r.location_category_description ?? "").trim();
  if (cat === "" || cat === "Administrative") return null;

  const sourceRecordId = r.location_code?.trim() || r.location_name.trim();

  return {
    metro: "nyc",
    category: "noise",
    sub_category: "school",
    name: r.location_name.trim().slice(0, 120),
    address: r.primary_address_line_1?.trim() ?? null,
    borough: boroughFromBbl(r.borough_block_lot),
    lat,
    lng,
    source: SOURCE,
    source_url: SOURCE_URL,
    source_record_id: sourceRecordId,
    metadata: {
      category: cat || null,
      type: r.location_type_description ?? null,
      grades: r.grades_final_text ?? null,
      managed_by: r.managed_by_name ?? null,
      building_code: r.primary_building_code ?? null,
      nta: r.nta ?? null,
    },
  };
}

export async function syncSchoolsNycDoe(
  supabase: SupabaseClient,
): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  try {
    const res = await fetch(ENDPOINT);
    if (!res.ok) throw new Error(`Socrata fetch failed: ${res.status} for ${DATASET_ID}`);
    const raw = (await res.json()) as SchoolRecord[];

    const normalized: ConcernInput[] = [];
    const seenIds = new Set<string>();
    for (const r of raw) {
      const input = normalizeSchool(r);
      if (!input) continue;
      // The DOE dataset has multiple rows per building (one per program
      // sharing the address). Dedupe by source_record_id to keep upserts
      // single-statement-safe.
      if (seenIds.has(input.source_record_id)) continue;
      seenIds.add(input.source_record_id);
      normalized.push(input);
    }

    const rows = normalized.map((input) => buildConcernRow(input));

    const count = await batchUpsert(
      supabase,
      "nearby_concerns",
      rows,
      "source,source_record_id",
      errors,
      "schools-nyc-doe",
    );

    await softDeleteUnseen(supabase, SOURCE, seenIds);
    await recordSyncRun(supabase, SOURCE, count, "completed");

    return { synced: count, errors };
  } catch (e) {
    const msg = (e as Error).message;
    await recordSyncRun(supabase, SOURCE, 0, "failed", msg);
    return { synced: 0, errors: [...errors, msg] };
  }
}
