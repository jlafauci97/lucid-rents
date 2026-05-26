import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { RelatedLinks } from "../RelatedLinks";
import { loadLandlordData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { createCacheClient } from "@/lib/supabase/cache-client";
import type { Building } from "@/types";
import type { City } from "@/lib/cities";

// Cached neighborhood stats: same answer for every building in the same zip,
// so we cache by (metro, zip) and reuse across requests. 1h freshness window.
const _loadNeighborhoodStats = async (metro: string, zip: string): Promise<{ median1BR: number | null; trackedCount: number }> => {
  const supabase = createCacheClient();
  const [medianRes, trackedRes] = await Promise.all([
    supabase
      .from("dewey_neighborhood_rents")
      .select("median_rent")
      .eq("zip", zip)
      .eq("beds", 1)
      .not("median_rent", "is", null)
      .order("month", { ascending: false })
      .limit(1),
    supabase.rpc("count_neighborhood_tracked_rents", {
      p_zip: zip,
      p_metro: metro,
      p_exclude_id: "00000000-0000-0000-0000-000000000000",
    }),
  ]);
  const rawMedian = (medianRes.data as Array<{ median_rent: number | string | null }> | null)?.[0]?.median_rent;
  const parsedMedian = typeof rawMedian === "string" ? Number(rawMedian) : rawMedian;
  const median1BR = typeof parsedMedian === "number" && Number.isFinite(parsedMedian) ? Math.round(parsedMedian) : null;
  const trackedCount = typeof trackedRes.data === "number" ? trackedRes.data : 0;
  return { median1BR, trackedCount };
};
const loadNeighborhoodStats = unstable_cache(
  _loadNeighborhoodStats,
  ["neighborhood-stats-related"],
  { revalidate: 3600, tags: ["neighborhood-stats"] }
);

interface RelatedContext {
  sameStreetCount: number;
  ownerWorstCount: number;
  sameEraCount: number;
  neighborhoodMedian1BR: number | null;
  neighborhoodTrackedRentsCount: number;
}

async function loadRelatedContext(building: Building): Promise<RelatedContext> {
  const supabase = createCacheClient();
  const ownerName = building.owner_name ?? building.management_company ?? null;
  const ownerColumn = building.management_company ? "management_company" : "owner_name";

  const nbhStatsPromise = building.zip_code
    ? loadNeighborhoodStats(building.metro, building.zip_code)
    : Promise.resolve({ median1BR: null, trackedCount: 0 });

  const [streetRes, worstRes, eraRes, nbhStats] = await Promise.all([
    // Buildings on same street in same borough/metro (excluding self)
    building.street_name
      ? supabase
          .from("buildings")
          .select("id", { count: "exact", head: true })
          .eq("metro", building.metro)
          .eq("street_name", building.street_name)
          .ilike("borough", building.borough)
          .neq("id", building.id)
      : Promise.resolve({ count: 0, error: null }),
    // Owner's buildings with low scores (<= 2.5 on 0-5 scale) excluding self
    ownerName
      ? supabase
          .from("buildings")
          .select("id", { count: "exact", head: true })
          .eq(ownerColumn, ownerName)
          .eq("metro", building.metro)
          .lte("overall_score", 2.5)
          .neq("id", building.id)
      : Promise.resolve({ count: 0, error: null }),
    // Same-era buildings (within ±10 years) in same borough
    building.year_built
      ? supabase
          .from("buildings")
          .select("id", { count: "exact", head: true })
          .eq("metro", building.metro)
          .ilike("borough", building.borough)
          .gte("year_built", building.year_built - 10)
          .lte("year_built", building.year_built + 10)
          .neq("id", building.id)
      : Promise.resolve({ count: 0, error: null }),
    nbhStatsPromise,
  ]);

  return {
    sameStreetCount: streetRes.count ?? 0,
    ownerWorstCount: worstRes.count ?? 0,
    sameEraCount: eraRes.count ?? 0,
    neighborhoodMedian1BR: nbhStats.median1BR,
    neighborhoodTrackedRentsCount: nbhStats.trackedCount,
  };
}

async function Inner({ building, city }: { building: Building; city: City }) {
  const [landlord, context] = await Promise.all([
    loadLandlordData(building),
    loadRelatedContext(building),
  ]);
  return <RelatedLinks building={building} landlord={landlord} context={context} city={city} />;
}

export function RelatedLinksStreamed({ building, city }: { building: Building; city: City }) {
  return (
    <Suspense fallback={null}>
      <Inner building={building} city={city} />
    </Suspense>
  );
}
