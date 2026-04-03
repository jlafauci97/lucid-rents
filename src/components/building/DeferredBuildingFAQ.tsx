import { createClient } from "@/lib/supabase/server";
import { FAQSection } from "@/components/seo/FAQSection";
import { generateBuildingFAQ } from "@/lib/faq/building-faq";
import type { City } from "@/lib/cities";
import type { Building, HpdViolation, Complaint311, HpdLitigation, DobViolation, Eviction, DobPermit, EnergyBenchmark, ReviewWithDetails } from "@/types";

// Helper: wrap each query so a single failure doesn't kill the section
const safe = <T,>(promise: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> =>
  Promise.resolve(promise).then(({ data, error }) => {
    if (error) console.error("Supabase query error:", error);
    return data ?? fallback;
  }).catch((err: unknown) => {
    console.error("Supabase query exception:", err);
    return fallback;
  });

interface DeferredBuildingFAQProps {
  building: Building;
  buildingId: string;
  city: City;
  rents: { bedrooms: number; min_rent: number; max_rent: number; median_rent: number; listing_count: number; source: string }[];
  neighborhoodRents: { bedrooms: number; median_rent: number }[];
}

export async function DeferredBuildingFAQ({ building, buildingId, city, rents, neighborhoodRents }: DeferredBuildingFAQProps) {
  const supabase = await createClient();
  const shortAddress = building.full_address.split(",")[0]?.trim() || building.full_address;

  const isNYC = city === "nyc";
  const isChicago = city === "chicago";
  const isLA = city === "los-angeles";
  const BBOX = 0.025;
  const hasFaqCoords = building.latitude && building.longitude;

  // Fetch ALL FAQ data in a single parallel batch — no more sequential waterfall
  const [violations, complaints, litigations, dobViolations, evictions, permits, energyData, reviews, amenities, faqSchoolsRaw, faqTransitRaw, faqCrimeRaw] = await Promise.all([
    safe(supabase.from("hpd_violations").select("*").eq("building_id", buildingId).order("inspection_date", { ascending: false }).limit(20), [] as HpdViolation[]),
    safe(supabase.from("complaints_311").select("*").eq("building_id", buildingId).order("created_date", { ascending: false }).limit(20), [] as Complaint311[]),
    isNYC ? safe(supabase.from("hpd_litigations").select("*").eq("building_id", buildingId).order("case_open_date", { ascending: false }).limit(20), [] as HpdLitigation[]) : Promise.resolve([] as HpdLitigation[]),
    (isNYC || isChicago) ? safe(supabase.from("dob_violations").select("*").eq("building_id", buildingId).order("issue_date", { ascending: false }).limit(20), [] as DobViolation[]) : Promise.resolve([] as DobViolation[]),
    isNYC ? safe(supabase.from("evictions").select("*").eq("building_id", buildingId).order("executed_date", { ascending: false }).limit(20), [] as Eviction[]) : Promise.resolve([] as Eviction[]),
    safe(supabase.from("dob_permits").select("*").eq("building_id", buildingId).order("issued_date", { ascending: false }).limit(20), [] as DobPermit[]),
    safe(supabase.from("energy_benchmarks").select("*").eq("building_id", buildingId).order("report_year", { ascending: false }).limit(1), [] as EnergyBenchmark[]),
    safe(supabase.from("reviews").select(`*, profile:profiles(id, display_name, avatar_url), category_ratings:review_category_ratings(*, category:review_categories(slug, name, icon)), unit:units(unit_number)`).eq("building_id", buildingId).eq("status", "published").order("created_at", { ascending: false }).limit(10), []) as Promise<ReviewWithDetails[]>,
    safe(supabase.from("building_amenities").select("amenity, category, source").eq("building_id", buildingId), []),
    hasFaqCoords
      ? safe(supabase.from("nearby_schools").select("type, name, latitude, longitude, grades")
          .gte("latitude", building.latitude! - BBOX).lte("latitude", building.latitude! + BBOX)
          .gte("longitude", building.longitude! - BBOX).lte("longitude", building.longitude! + BBOX), [])
      : Promise.resolve([]),
    hasFaqCoords
      ? safe(supabase.from("transit_stops").select("type, name, latitude, longitude, routes")
          .gte("latitude", building.latitude! - BBOX).lte("latitude", building.latitude! + BBOX)
          .gte("longitude", building.longitude! - BBOX).lte("longitude", building.longitude! + BBOX), [])
      : Promise.resolve([]),
    building.zip_code
      ? safe(supabase.rpc("crime_zip_summary", { target_zip: building.zip_code, since_date: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], metro: city }), [])
      : Promise.resolve([]),
  ]);

  // Process schools into grouped format
  const faqSchools: Record<string, { name: string; grades: string | null; distance: string; walkMin: number }[]> = {};
  const schoolLimits: Record<string, number> = { public_school: 3, charter_school: 2, private_school: 2, college: 2 };
  if (hasFaqCoords) {
    const R = 3958.8;
    for (const s of (faqSchoolsRaw as { type: string; name: string; latitude: number; longitude: number; grades: string | null }[])) {
      const dLat = ((Number(s.latitude) - building.latitude!) * Math.PI) / 180;
      const dLng = ((Number(s.longitude) - building.longitude!) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((building.latitude! * Math.PI) / 180) * Math.cos((Number(s.latitude) * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (dist > 1.0) continue;
      if (!faqSchools[s.type]) faqSchools[s.type] = [];
      if (faqSchools[s.type].length >= (schoolLimits[s.type] || 3)) continue;
      faqSchools[s.type].push({ name: s.name, grades: s.grades, distance: dist < 0.1 ? `${Math.round(dist * 5280)} ft` : `${dist.toFixed(1)} mi`, walkMin: Math.round(dist * 20) });
    }
  }

  // Process transit into grouped format
  const faqTransit: Record<string, { name: string; routes: string[]; distance: string; walkMin: number }[]> = {};
  const transitLimits: Record<string, number> = { subway: 3, bus: 3, citibike: 3, ferry: 1 };
  if (hasFaqCoords) {
    const R = 3958.8;
    for (const s of (faqTransitRaw as { type: string; name: string; latitude: number; longitude: number; routes: string[] }[])) {
      const dLat = ((Number(s.latitude) - building.latitude!) * Math.PI) / 180;
      const dLng = ((Number(s.longitude) - building.longitude!) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((building.latitude! * Math.PI) / 180) * Math.cos((Number(s.latitude) * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (dist > 1.5) continue;
      if (!faqTransit[s.type]) faqTransit[s.type] = [];
      if (faqTransit[s.type].length >= (transitLimits[s.type] || 3)) continue;
      faqTransit[s.type].push({ name: s.name, routes: s.routes || [], distance: dist < 0.1 ? `${Math.round(dist * 5280)} ft` : `${dist.toFixed(1)} mi`, walkMin: Math.round(dist * 20) });
    }
  }

  // Process crime summary
  const faqCrime = Array.isArray(faqCrimeRaw) && faqCrimeRaw.length > 0
    ? faqCrimeRaw[0] as { total: number; violent: number; property: number; quality_of_life: number }
    : null;

  return (
    <FAQSection
      items={generateBuildingFAQ({
        building,
        rents,
        amenities,
        violations,
        complaints,
        litigations,
        dobViolations,
        evictions,
        permits,
        energy: energyData[0] || null,
        reviews,
        neighborhoodRents,
        nearbySchools: faqSchools,
        nearbyTransit: faqTransit,
        crimeSummary: faqCrime,
      })}
      title={`Frequently Asked Questions About ${shortAddress}`}
    />
  );
}
