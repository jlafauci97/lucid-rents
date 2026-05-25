import { createCacheClient } from "@/lib/supabase/cache-client";
import { MarketListings } from "@/components/building/MarketListings";
import { RentRangeCard } from "@/components/building/RentRangeCard";
import { buildingUrl } from "@/lib/seo";
import type { City } from "@/lib/cities";
import type { Building } from "@/types";

const safe = <T,>(promise: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> =>
  Promise.resolve(promise).then(({ data, error }) => {
    if (error) console.error("Supabase query error:", error);
    return data ?? fallback;
  }).catch((err: unknown) => {
    console.error("Supabase query exception:", err);
    return fallback;
  });

interface Props {
  building: Building;
  buildingId: string;
  city: City;
  rents: { bedrooms: number; min_rent: number; max_rent: number; median_rent: number; listing_count: number; source: string }[];
}

export async function DeferredRentListingsSection({ building, buildingId, city, rents }: Props) {
  const supabase = createCacheClient();

  const [marketListings, amenities, rentHistory] = await Promise.all([
    safe(supabase.from("building_listings").select("*").eq("building_id", buildingId), []),
    safe(supabase.from("building_amenities").select("amenity, category, source").eq("building_id", buildingId), []),
    safe(supabase.from("unit_rent_history").select("id, unit_number, bedrooms, bathrooms, rent, sqft, source, observed_at").eq("building_id", buildingId).order("observed_at", { ascending: false }).limit(100), []),
  ]);

  return (
    <div id="rent" className="scroll-mt-28">
      <MarketListings listings={marketListings} amenities={amenities} rentHistory={rentHistory} buildingUrl={buildingUrl(building, city)} />
      {marketListings.length === 0 && rents.length > 0 && (
        <RentRangeCard rents={rents} />
      )}
    </div>
  );
}
