import type { ComparableBuilding } from "@/components/fair-rent/types";
import { createClient } from "@/lib/supabase/server";

export async function fetchComparables(
  address: string,
  zipCode: string,
  beds: number
): Promise<ComparableBuilding[]> {
  try {
    const supabase = await createClient();

    // Get buildings with better scores in the same ZIP
    const { data: buildings } = await supabase
      .from("buildings")
      .select("id, full_address, borough, slug, zip_code, total_units, violation_count, complaint_count, overall_score, is_rent_stabilized, year_built, crime_count")
      .eq("metro", "nyc")
      .eq("zip_code", zipCode)
      .gte("overall_score", 4.0)
      .not("full_address", "ilike", `%${address.split(",")[0].trim()}%`)
      .order("overall_score", { ascending: false })
      .order("violation_count", { ascending: true })
      .limit(6);

    if (!buildings || buildings.length === 0) return [];

    const buildingIds = buildings.map((b) => b.id);

    // Fetch rents for these buildings (matching bed count)
    const { data: rents } = await supabase
      .from("building_rents")
      .select("building_id, median_rent")
      .in("building_id", buildingIds)
      .eq("bedrooms", beds);

    const rentMap = new Map<string, number>();
    for (const r of rents ?? []) {
      if (r.median_rent) rentMap.set(r.building_id, r.median_rent);
    }

    // Fetch amenities for these buildings (key amenities only)
    const { data: amenityRows } = await supabase
      .from("building_amenities")
      .select("building_id, amenity")
      .in("building_id", buildingIds)
      .in("amenity", [
        "Elevator", "Doorman", "Gym", "Fitness Center",
        "Laundry", "Washer/Dryer", "In-Unit Laundry",
        "Parking", "Garage", "Pet Friendly", "Cat Friendly", "Large Dog Friendly",
        "Dishwasher", "Air Conditioning", "Central AC",
        "Roof Deck", "Outdoor Space", "Balcony", "Terrace",
        "Concierge", "24-hour Security", "Pool", "Swimming Pool",
      ]);

    const amenityMap = new Map<string, Set<string>>();
    for (const a of amenityRows ?? []) {
      if (!amenityMap.has(a.building_id)) amenityMap.set(a.building_id, new Set());
      amenityMap.get(a.building_id)!.add(a.amenity);
    }

    return buildings.map((b) => ({
      full_address: b.full_address,
      borough: b.borough,
      slug: b.slug,
      zip_code: b.zip_code,
      total_units: b.total_units,
      violation_count: b.violation_count,
      complaint_count: b.complaint_count,
      overall_score: b.overall_score,
      is_rent_stabilized: b.is_rent_stabilized,
      year_built: b.year_built,
      crime_count: b.crime_count,
      median_rent: rentMap.get(b.id) ?? null,
      amenities: [...(amenityMap.get(b.id) ?? [])],
    }));
  } catch {
    return [];
  }
}
