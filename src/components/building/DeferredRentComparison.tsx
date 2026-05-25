import { createCacheClient } from "@/lib/supabase/cache-client";
import { RentComparison } from "./RentComparison";

interface DeferredRentComparisonProps {
  buildingRents: { bedrooms: number; min_rent: number; max_rent: number; median_rent: number }[];
  buildingId: string;
  zipCode: string;
  borough: string;
}

async function safe<T>(promise: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> {
  try {
    const { data, error } = await promise;
    if (error || data === null) return fallback;
    return data;
  } catch {
    return fallback;
  }
}

export async function DeferredRentComparison({
  buildingRents,
  buildingId,
  zipCode,
  borough,
}: DeferredRentComparisonProps) {
  const supabase = createCacheClient();
  const neighborhoodRents = await safe(
    supabase.rpc("get_neighborhood_median_rents", {
      p_zip: zipCode,
      p_exclude_building: buildingId,
    }),
    [] as { bedrooms: number; median_rent: number }[]
  );

  return (
    <RentComparison
      buildingRents={buildingRents}
      neighborhoodRents={neighborhoodRents}
      zipCode={zipCode}
      borough={borough}
    />
  );
}
