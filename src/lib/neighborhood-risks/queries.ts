import { createClient } from "@supabase/supabase-js";
import type {
  ConcernRow,
  ConcernSubCategoryGroup,
  NeighborhoodRisksResult,
} from "./types";

const RADIUS_M = 1207; // 0.75 mi
const RADIUS_MI = 0.75;
const ON_BLOCK_RADIUS_M = 121; // ~0.075 mi, roughly one NYC city block

/** Haversine distance in miles. Used for `nearby_schools` where the table
 * lacks a PostGIS geom column. */
function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface BuildingInput {
  id: string;
  name: string;
  address: string;
  borough: string;
  neighborhood: string;
  lat: number;
  lng: number;
  slug: string;
}

// Match an "Avenue" segment in an NYC address. Conservative: needs the
// avenue token to be the trailing street suffix (case-insensitive), so
// "5 Avenue B" / "240 Central Park South" don't get flagged, but
// "240 CENTRAL PARK AVENUE" and "8112 21 AVENUE" do.
const AVENUE_RE = /\b(Ave|Ave\.|Avenue)\b/i;

/**
 * True if the building's street address sits on a (typically higher-traffic)
 * avenue. Used to synthesize an "Avenue traffic" noise concern.
 */
export function detectAvenueTraffic(address: string | null | undefined): boolean {
  if (!address) return false;
  // Inspect only the first comma-separated segment (street component).
  const firstSeg = address.split(",")[0]?.trim() ?? "";
  return AVENUE_RE.test(firstSeg);
}

/**
 * Returns the trimmed street component from a full address string, e.g.
 * "8112 21 AVENUE" from "8112 21 AVENUE, Brooklyn, NY, 11214". Falls back
 * to the original address if no comma.
 */
export function extractStreetName(address: string): string {
  const seg = address.split(",")[0]?.trim();
  return seg || address;
}

/**
 * Groups raw concern rows by sub-category. Order within each group is preserved
 * from input order (callers typically pass distance-ascending rows).
 */
export function groupBySubCategory(rows: ConcernRow[]): ConcernSubCategoryGroup[] {
  const groups = new Map<string, ConcernSubCategoryGroup>();
  for (const r of rows) {
    if (!groups.has(r.sub_category)) {
      groups.set(r.sub_category, {
        sub_category: r.sub_category,
        category: r.category,
        total_count: 0,
        items: [],
      });
    }
    const g = groups.get(r.sub_category)!;
    g.total_count += 1;
    g.items.push(r);
  }
  return Array.from(groups.values());
}

/**
 * Fetches all Neighborhood Risks data for a building and returns a UI-ready
 * result object. Server-component-only — uses the public anon key and is
 * safe to call from RSC code paths.
 */
export async function fetchNeighborhoodRisks(
  building: BuildingInput,
): Promise<NeighborhoodRisksResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { lat, lng } = building;

  // 1. POI rows within 0.75 mi
  const { data: concernRows } = await supabase.rpc("nearby_concerns_within_radius", {
    p_lat: lat,
    p_lng: lng,
    p_radius_m: RADIUS_M,
  });
  const rows: ConcernRow[] = (concernRows ?? []) as ConcernRow[];

  // 1b. Synthetic concern: if the building's street address is on an Avenue,
  // add an "Avenue traffic" noise entry at the building's own location.
  // Heuristic — NYC's named/numbered avenues are typically higher-traffic
  // than side streets. Conservative match: street component ends with
  // "Ave", "Ave.", or "Avenue" (case-insensitive).
  if (detectAvenueTraffic(building.address)) {
    rows.unshift({
      id: -1,
      category: "noise",
      sub_category: "avenue_traffic",
      name: `On an avenue — ${extractStreetName(building.address)}`,
      address: building.address,
      source: "derived_from_address",
      source_url: null,
      distance_mi: 0,
    });
  }

  // 1c. Schools — pulled from the dedicated `nearby_schools` table (synced
  // separately via the sync-schools edge function). The table has broader
  // coverage than the DOE-only Socrata feed: public + charter + private +
  // colleges across NYC, LA, Houston. We use a bbox prefilter + haversine
  // because nearby_schools doesn't have a PostGIS geom column (just lat/lng
  // numerics indexed for the lookup path that the schools sidebar uses).
  // K-12 + college all produce drop-off, dismissal, and dorm/library noise
  // patterns, so we include every school type — distinguished in metadata.
  const SCHOOL_BBOX_DEG = 0.012; // ~0.83 mi at NYC latitude — superset of 0.75 mi
  const { data: schoolRows } = await supabase
    .from("nearby_schools")
    .select("school_id, name, type, address, latitude, longitude")
    .eq("metro", "nyc")
    .gte("latitude", lat - SCHOOL_BBOX_DEG)
    .lte("latitude", lat + SCHOOL_BBOX_DEG)
    .gte("longitude", lng - SCHOOL_BBOX_DEG)
    .lte("longitude", lng + SCHOOL_BBOX_DEG);

  for (const s of schoolRows ?? []) {
    const sLat = Number(s.latitude);
    const sLng = Number(s.longitude);
    if (!Number.isFinite(sLat) || !Number.isFinite(sLng)) continue;
    const distMi = haversineMi(lat, lng, sLat, sLng);
    if (distMi > RADIUS_MI) continue;
    rows.push({
      id: rows.length > 0 ? -(1000 + rows.length) : -1000, // synthetic
      category: "noise",
      sub_category: "school",
      name: String(s.name ?? "School"),
      address: (s.address as string | null) ?? null,
      source: `nearby_schools:${s.type ?? "school"}`,
      source_url: null,
      distance_mi: distMi,
    });
  }

  // 2. Sex-offender count (separate RPC, count only — never leaks rows)
  const { data: offenderCount } = await supabase.rpc("count_sex_offenders_near", {
    lat,
    lng,
    radius_meters: RADIUS_M,
  });

  // 3. Block-level live queries.
  //
  // The 311 RPCs scan a 15M-row partition; performance varies by neighborhood
  // density. We hard-cap each RPC at RPC_TIMEOUT_MS so a single slow call
  // doesn't hang page render. On timeout/error, the block falls back to 0
  // (the UI shows "0" or "All clear" — better than a 30s spinner).
  //
  // Long-term fix: pre-aggregate per-building counts into a materialized view
  // so the radius query becomes a small bbox sum instead of a partition scan.
  const RPC_TIMEOUT_MS = 4500;

  const countRpc = async (
    fn: string,
    radius: number,
  ): Promise<number> => {
    const rpcPromise = (async () => {
      try {
        const { data } = await supabase.rpc(fn, {
          p_lat: lat,
          p_lng: lng,
          p_radius_m: radius,
        });
        return Number(data ?? 0);
      } catch {
        return 0;
      }
    })();
    const timeout = new Promise<number>((resolve) =>
      setTimeout(() => resolve(0), RPC_TIMEOUT_MS),
    );
    return Promise.race([rpcPromise, timeout]);
  };

  const [noise311, noise311Block, rats, bedbugs] = await Promise.all([
    countRpc("count_311_noise_near", RADIUS_M),
    countRpc("count_311_noise_near", ON_BLOCK_RADIUS_M),
    countRpc("count_rats_near", RADIUS_M),
    countRpc("count_bedbugs_near", RADIUS_M),
  ]);

  return {
    building,
    groups: groupBySubCategory(rows),
    sex_offender_count: Number(offenderCount ?? 0),
    block_level: {
      rat_failures: rats,
      noise_311: noise311,
      noise_311_on_block: noise311Block,
      bedbug_history: bedbugs,
    },
    total_concerns: rows.length + Number(offenderCount ?? 0),
    within_block_count: rows.filter((r) => r.distance_mi < 0.1).length,
  };
}
