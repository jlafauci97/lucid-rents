import { createClient } from "@/lib/supabase/server";
import { RentIntelligence } from "@/components/building/RentIntelligence";
import { AmenityPremiums } from "@/components/building/AmenityPremiums";
import { BuildingAmenities } from "@/components/building/BuildingAmenities";
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
}

export async function DeferredRentIntelligenceSection({ building, buildingId, city }: Props) {
  const supabase = await createClient();

  const [deweyBuildingRents, deweyNeighborhoodRents, deweyAmenityPremiums, deweySeasonalIndex, amenities] = await Promise.all([
    safe(supabase.from("dewey_building_rents").select("month, beds, median_rent, min_rent, max_rent, avg_sqft, avg_price_per_sqft, listing_count").eq("building_id", buildingId).order("month", { ascending: true }), []),
    building.zip_code
      ? safe(supabase.from("dewey_neighborhood_rents").select("month, beds, median_rent, p25_rent, p75_rent").eq("zip", building.zip_code).order("month", { ascending: true }), [])
      : Promise.resolve([]),
    building.zip_code
      ? safe(supabase.from("dewey_amenity_premiums").select("amenity, premium_dollars, premium_pct, sample_size").eq("city", city).eq("zip", building.zip_code).eq("period", "dwellsy_2024"), [])
      : Promise.resolve([]),
    building.zip_code
      ? safe(supabase.from("dewey_seasonal_index").select("month_of_year, rent_index").eq("city", city).eq("zip", building.zip_code), [])
      : Promise.resolve([]),
    safe(supabase.from("building_amenities").select("amenity, category, source").eq("building_id", buildingId), []),
  ]);

  // Filter dewey amenity premiums to only amenities this building actually has
  const buildingAmenityNames = amenities.map((a: { amenity: string }) => a.amenity.toLowerCase());
  const filteredDeweyPremiums = (deweyAmenityPremiums || []).filter((dp: { amenity: string }) => {
    const keyword = dp.amenity.replace(/_/g, " ");
    return buildingAmenityNames.some((name: string) => name.includes(keyword));
  });

  if (!deweyBuildingRents || deweyBuildingRents.length === 0) {
    // Still render amenities if present
    return amenities.length > 0 ? (
      <div id="amenities" className="scroll-mt-28">
        <BuildingAmenities amenities={amenities} />
      </div>
    ) : null;
  }

  // Compute value grade
  const latestMonth = deweyBuildingRents[deweyBuildingRents.length - 1]?.month;
  const latestBuildingRows = deweyBuildingRents.filter((r: any) => r.month === latestMonth);
  const latestNeighborhoodRows = (deweyNeighborhoodRents || []).filter((r: any) => r.month === latestMonth);

  let computedValueGrade = "C";
  if (latestBuildingRows.length > 0 && latestNeighborhoodRows.length > 0) {
    let totalDiff = 0;
    let totalWeight = 0;
    for (const br of latestBuildingRows) {
      const nr = latestNeighborhoodRows.find((n: any) => n.beds === br.beds);
      if (nr && nr.median_rent > 0 && br.median_rent > 0) {
        const diff = (br.median_rent - nr.median_rent) / nr.median_rent;
        const weight = br.listing_count || 1;
        totalDiff += diff * weight;
        totalWeight += weight;
      }
    }
    if (totalWeight > 0) {
      const avgDiff = totalDiff / totalWeight;
      const qualityBonus = ((building.overall_score ?? 5) - 5) * 0.02;
      const violationPenalty = Math.min((building.violation_count || 0) / 100, 0.1);
      const adjustedDiff = avgDiff - qualityBonus + violationPenalty;
      if (adjustedDiff <= -0.15) computedValueGrade = "A";
      else if (adjustedDiff <= -0.05) computedValueGrade = "B";
      else if (adjustedDiff <= 0.05) computedValueGrade = "C";
      else if (adjustedDiff <= 0.15) computedValueGrade = "D";
      else computedValueGrade = "F";
    }
  }

  // Amenity premiums card data
  const bedCounts = new Map<number, number>();
  for (const r of latestBuildingRows) {
    bedCounts.set(r.beds, (bedCounts.get(r.beds) || 0) + (r.listing_count || 1));
  }
  let bestBeds = 1;
  let bestCount = 0;
  for (const [beds, count] of bedCounts) {
    if (count > bestCount) { bestBeds = beds; bestCount = count; }
  }

  const buildingRow = latestBuildingRows.find((r: any) => r.beds === bestBeds);
  const neighborhoodRow = latestNeighborhoodRows.find((r: any) => r.beds === bestBeds);
  const neighborhoodMedian = neighborhoodRow?.median_rent || 0;
  const buildingMedian = buildingRow?.median_rent || 0;
  const violationDiscount = Math.min(building.violation_count || 0, 100) * -0.5;
  const bedLabels: Record<number, string> = { 0: "Studio", 1: "1BR", 2: "2BR", 3: "3BR", 4: "4BR+" };

  return (
    <>
      <div id="rent-intelligence" className="scroll-mt-20">
        <RentIntelligence
          buildingId={buildingId}
          building={{ id: building.id, full_address: building.full_address, zip_code: building.zip_code || "", violation_count: building.violation_count || 0, overall_score: building.overall_score }}
          buildingRents={deweyBuildingRents}
          neighborhoodRents={deweyNeighborhoodRents || []}
          amenityPremiums={filteredDeweyPremiums}
          seasonalIndex={deweySeasonalIndex || []}
          valueGrade={computedValueGrade}
        />
      </div>

      {neighborhoodMedian > 0 && buildingMedian > 0 && (
        <AmenityPremiums
          neighborhoodMedian={neighborhoodMedian}
          buildingMedian={buildingMedian}
          amenityPremiums={filteredDeweyPremiums.filter((a: any) => a.premium_dollars > 0)}
          violationDiscount={violationDiscount}
          valueGrade={computedValueGrade}
          bedLabel={bedLabels[bestBeds] ?? `${bestBeds}BR`}
        />
      )}

      {amenities.length > 0 && (
        <div id="amenities" className="scroll-mt-28">
          <BuildingAmenities amenities={amenities} />
        </div>
      )}
    </>
  );
}
