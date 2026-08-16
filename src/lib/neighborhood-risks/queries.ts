import { unstable_cache } from "next/cache";
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
  /** Building's metro (nyc | los-angeles | chicago). The 311/rat/bedbug
   * counters only have NYC data — passing a non-NYC metro skips those RPCs
   * entirely instead of scanning NYC in vain for every LA/Chicago render. */
  metro?: string;
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
  // Geo data changes slowly; cache one week keyed by rounded coordinates
  // (~11m grid — buildings sharing a rounded cell share identical radius
  // results for all practical purposes). Uncached, this branch's PostGIS
  // waterfall set the whole building page's cold TTFB.
  //
  // Degraded results (an RPC timed out and fell back to 0) are NOT cached —
  // caching would freeze a wrong "0" for a week. We throw inside the cached
  // scope to abort the cache write, then serve the degraded result uncached.
  const cacheKey = `${building.lat.toFixed(4)},${building.lng.toFixed(4)}`;
  let escaped: NeighborhoodRisksResult | null = null;
  const cached = unstable_cache(
    async () => {
      const { result, degraded } = await fetchNeighborhoodRisksUncached(building);
      if (degraded) {
        escaped = result;
        throw new Error("neighborhood-risks: degraded result, skipping cache");
      }
      return result;
    },
    ["neighborhood-risks", cacheKey],
    { revalidate: 604800, tags: ["neighborhood-risks"] },
  );
  try {
    return await cached();
  } catch (e) {
    if (escaped) return escaped;
    throw e;
  }
}

async function fetchNeighborhoodRisksUncached(
  building: BuildingInput,
): Promise<{ result: NeighborhoodRisksResult; degraded: boolean }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { lat, lng } = building;

  // Kick off every independent query up front — previously these ran as a
  // serial waterfall and their latencies added up.
  const concernsPromise = supabase.rpc("nearby_concerns_within_radius", {
    p_lat: lat,
    p_lng: lng,
    p_radius_m: RADIUS_M,
  });
  const SCHOOL_BBOX_DEG = 0.012; // ~0.83 mi at NYC latitude — superset of 0.75 mi
  const schoolsPromise = supabase
    .from("nearby_schools")
    .select("school_id, name, type, address, latitude, longitude")
    .eq("metro", "nyc")
    .gte("latitude", lat - SCHOOL_BBOX_DEG)
    .lte("latitude", lat + SCHOOL_BBOX_DEG)
    .gte("longitude", lng - SCHOOL_BBOX_DEG)
    .lte("longitude", lng + SCHOOL_BBOX_DEG);
  const offendersPromise = supabase.rpc("count_sex_offenders_near", {
    lat,
    lng,
    radius_meters: RADIUS_M,
  });

  // 1. POI rows within 0.75 mi
  const { data: concernRows } = await concernsPromise;
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
  const { data: schoolRows } = await schoolsPromise;

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
  const { data: offenderCount } = await offendersPromise;

  // 3. Block-level live queries.
  //
  // Block-level counters, one RPC for all four numbers. The previous shape —
  // four separate radius RPCs, each re-finding nearby buildings with a
  // PostGIS geography recheck — averaged 4-12s per call in production and
  // kept burning the database after the app's timeout race abandoned the
  // wait. neighborhood_risk_counts computes the nearby set once with planar
  // math (index-only bbox scan) and returns every aggregate.
  //
  // NYC-only data: for other metros, return zeros without touching the DB.
  const RPC_TIMEOUT_MS = 4000;

  let degraded = false;
  let noise311 = 0;
  let noise311Block = 0;
  let rats = 0;
  let bedbugs = 0;

  if (!building.metro || building.metro === "nyc") {
    interface RiskCounts {
      noise_311: number;
      noise_311_block: number;
      rat_failures: number;
      bedbug_history: number;
    }
    const rpcPromise = (async (): Promise<RiskCounts | null> => {
      try {
        const { data } = await supabase.rpc("neighborhood_risk_counts", {
          p_lat: lat,
          p_lng: lng,
          p_radius_m: RADIUS_M,
          p_block_m: ON_BLOCK_RADIUS_M,
        });
        const row = (Array.isArray(data) ? data[0] : data) as RiskCounts | undefined;
        return row ?? null;
      } catch {
        return null;
      }
    })();
    const timeout = new Promise<RiskCounts | null>((resolve) =>
      setTimeout(() => resolve(null), RPC_TIMEOUT_MS),
    );
    const counts = await Promise.race([rpcPromise, timeout]);
    if (counts) {
      noise311 = Number(counts.noise_311) || 0;
      noise311Block = Number(counts.noise_311_block) || 0;
      rats = Number(counts.rat_failures) || 0;
      bedbugs = Number(counts.bedbug_history) || 0;
    } else {
      degraded = true;
    }
  }

  return {
    result: {
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
    },
    degraded,
  };
}
