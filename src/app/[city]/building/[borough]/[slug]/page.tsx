import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BuildingHeader } from "@/components/building/BuildingHeader";
import { QuickSummary } from "@/components/building/QuickSummary";
import { IssuesTabs } from "@/components/building/IssuesTabs";
import dynamic from "next/dynamic";

const ViolationTrend = dynamic(() => import("@/components/building/ViolationTrend").then(m => m.ViolationTrend), {
  loading: () => <div className="bg-white rounded-xl border border-[#e2e8f0] p-6"><div className="h-6 w-48 bg-[#e2e8f0] rounded animate-pulse mb-4" /><div className="h-[300px] bg-[#f8fafc] rounded-lg animate-pulse" /></div>,
});
import { ViolationsByUnit } from "@/components/building/ViolationsByUnit";
import { ReviewSection } from "@/components/review/ReviewSection";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { SaveButton } from "@/components/building/SaveButton";
import { ShareButton } from "@/components/building/ShareButton";
import { SectionNav } from "@/components/building/SectionNav";
import { NearbyCrimeSummary } from "@/components/crime/NearbyCrimeSummary";
import { NearbyTransit } from "@/components/transit/NearbyTransit";
import { NearbySchools } from "@/components/schools/NearbySchools";
import { NearbyRecreation } from "@/components/building/NearbyRecreation";
import { NearbyEncampments } from "@/components/building/NearbyEncampments";
import { NearbyBuildings } from "@/components/building/NearbyBuildings";
import { SameLandlordBuildings } from "@/components/building/SameLandlordBuildings";
import { BuildingLocationMap } from "@/components/building/BuildingLocationMap";
import { RentStabilizationCard } from "@/components/building/RentStabilizationCard";
import { RentRangeCard } from "@/components/building/RentRangeCard";
import { RentComparison } from "@/components/building/RentComparison";
import { BuildingAmenities } from "@/components/building/BuildingAmenities";
import { MarketListings } from "@/components/building/MarketListings";
import { EnergyScoreCard } from "@/components/building/EnergyScoreCard";
import { SeismicSafetyCard } from "@/components/building/SeismicSafetyCard";
import { HazardZonesCard } from "@/components/building/HazardZonesCard";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { SLUG_TO_BOROUGH, regionFromSlug, buildingUrl, canonicalUrl, buildingJsonLd, breadcrumbJsonLd, landlordUrl, cityPath } from "@/lib/seo";
import { CITY_META, VALID_CITIES, type City } from "@/lib/cities";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { TrackBuildingView } from "@/components/building/TrackBuildingView";
import { FAQSection } from "@/components/seo/FAQSection";
import { generateBuildingFAQ } from "@/lib/faq/building-faq";
import { cache } from "react";
import type { Building, HpdViolation, Complaint311, HpdLitigation, DobViolation, BedBugReport, Eviction, DobPermit, EnergyBenchmark, ReviewWithDetails, LahdViolationSummary } from "@/types";
import type { Metadata } from "next";

export const revalidate = 86400; // 24h ISR

interface BuildingSlugPageProps {
  params: Promise<{ city: string; borough: string; slug: string }>;
}

// cache() deduplicates across generateMetadata + page render in the same request
const getBuilding = cache(async (boroughSlug: string, slug: string, metro?: string) => {
  // regionFromSlug checks CITY_META regions first, then falls back to title-casing
  // so cities with boroughs not in the predefined regions list still work
  const city = (metro || "nyc") as import("@/lib/cities").City;
  const borough = regionFromSlug(boroughSlug, city);

  const supabase = await createClient();
  // Use borough + slug + metro + limit(1) instead of .single() to handle duplicate slugs
  let query = supabase
    .from("buildings")
    .select("*")
    .eq("slug", slug)
    .eq("borough", borough);

  if (metro) {
    query = query.eq("metro", metro);
  }

  const { data } = await query.limit(1);

  if (!data || data.length === 0) return null;
  return data[0] as Building;
});

function metroToCity(metro: string | null): import("@/lib/cities").City {
  if (metro && VALID_CITIES.includes(metro as City)) return metro as City;
  return "nyc";
}

/** Find a building by slug across all cities — used for cross-city redirects */
const findBuildingAnywhere = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("buildings")
    .select("borough, slug, metro")
    .eq("slug", slug)
    .limit(1);
  return data?.[0] ?? null;
});

export async function generateMetadata({
  params,
}: BuildingSlugPageProps): Promise<Metadata> {
  const { city: cityParam, borough, slug } = await params;
  const building = await getBuilding(borough, slug, cityParam);

  if (!building) {
    // Check if the building exists under a different city — redirect will happen in the page component
    const match = await findBuildingAnywhere(slug);
    if (match) {
      const correctCity = metroToCity(match.metro);
      const url = canonicalUrl(buildingUrl(match, correctCity));
      return {
        title: "Redirecting…",
        alternates: { canonical: url },
      };
    }
    return { title: "Building Not Found" };
  }

  const title = `${building.full_address} | Lucid Rents`;
  const isChicagoMeta = cityParam === "chicago" || cityParam === "miami";
  const metaViolationCount = isChicagoMeta
    ? (building.dob_violation_count || 0)
    : (building.violation_count || 0);
  const descParts = [
    `${metaViolationCount} violations`,
    `${building.complaint_count} complaints`,
  ];
  if (building.bedbug_report_count > 0) descParts.push(`${building.bedbug_report_count} bedbug reports`);
  if (building.eviction_count > 0) descParts.push(`${building.eviction_count} evictions`);
  const cityName = CITY_META[cityParam as keyof typeof CITY_META]?.name || "NYC";
  const description = `Thinking about ${building.full_address}? Check ${descParts.join(", ")}, and real tenant reviews before you sign a lease.`;
  const url = canonicalUrl(buildingUrl(building, cityParam as import("@/lib/cities").City));

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function BuildingSlugPage({ params }: BuildingSlugPageProps) {
  const { city: cityParam, borough: boroughSlug, slug } = await params;
  const city = (cityParam || "nyc") as City;
  let building = await getBuilding(boroughSlug, slug, city);

  if (!building) {
    // Building not found for this city — check if it exists under a different city and redirect
    const match = await findBuildingAnywhere(slug);
    if (match) {
      const correctCity = metroToCity(match.metro);
      redirect(buildingUrl(match, correctCity));
    }
    notFound();
  }

  // If the building's metro doesn't match the URL city, redirect to the correct city
  const buildingCity = metroToCity(building.metro);
  if (buildingCity !== city) {
    redirect(buildingUrl(building, buildingCity));
  }

  const supabase = await createClient();
  const buildingId = building.id;

  // Helper: wrap each query so a single failure doesn't kill the whole page
  const safe = <T,>(promise: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> =>
    Promise.resolve(promise).then(({ data, error }) => {
      if (error) console.error("Supabase query error:", error);
      return data ?? fallback;
    }).catch((err: unknown) => {
      console.error("Supabase query exception:", err);
      return fallback;
    });

  const isLA = city === "los-angeles";
  const isChicago = city === "chicago";
  const isMiami = city === "miami";
  const isNYC = city === "nyc";
  const emptyHpdLit = [] as HpdLitigation[];
  const emptyDobVio = [] as DobViolation[];
  const emptyBedbugs = [] as BedBugReport[];
  const emptyEvictions = [] as Eviction[];

  // Fetch all data in a single parallel batch — including city-specific queries
  const [violations, complaints, litigations, dobViolations, bedbugs, evictions, permits, energyData, reviews, units, violationSummaries, rents, amenities, marketListings, rentHistory, monitorStatus, saveStatus, neighborhoodRentsRaw, lahdViolationSummary, chicagoRlto, chicagoLead, chicagoScofflaw] = await Promise.all([
    safe(supabase.from("hpd_violations").select("*").eq("building_id", buildingId).order("inspection_date", { ascending: false }).limit(20), [] as HpdViolation[]),
    safe(supabase.from("complaints_311").select("*").eq("building_id", buildingId).order("created_date", { ascending: false }).limit(20), [] as Complaint311[]),
    isNYC ? safe(supabase.from("hpd_litigations").select("*").eq("building_id", buildingId).order("case_open_date", { ascending: false }).limit(20), emptyHpdLit) : Promise.resolve(emptyHpdLit),
    (isNYC || isChicago) ? safe(supabase.from("dob_violations").select("*").eq("building_id", buildingId).order("issue_date", { ascending: false }).limit(20), emptyDobVio) : Promise.resolve(emptyDobVio),
    isNYC ? safe(supabase.from("bedbug_reports").select("*").eq("building_id", buildingId).order("filing_date", { ascending: false }).limit(20), emptyBedbugs) : Promise.resolve(emptyBedbugs),
    isNYC ? safe(supabase.from("evictions").select("*").eq("building_id", buildingId).order("executed_date", { ascending: false }).limit(20), emptyEvictions) : Promise.resolve(emptyEvictions),
    safe(supabase.from("dob_permits").select("*").eq("building_id", buildingId).order("issued_date", { ascending: false }).limit(20), [] as DobPermit[]),
    safe(supabase.from("energy_benchmarks").select("*").eq("building_id", buildingId).order("report_year", { ascending: false }).limit(1), [] as EnergyBenchmark[]),
    safe(supabase.from("reviews").select(`*, profile:profiles(id, display_name, avatar_url), category_ratings:review_category_ratings(*, category:review_categories(slug, name, icon)), unit:units(unit_number)`).eq("building_id", buildingId).eq("status", "published").order("created_at", { ascending: false }).limit(10), []) as Promise<ReviewWithDetails[]>,
    safe(supabase.from("units").select("*").eq("building_id", buildingId).order("unit_number", { ascending: true }), []),
    safe(supabase.from("hpd_violations").select("id, apartment, class, status, inspection_date, nov_description").eq("building_id", buildingId).order("inspection_date", { ascending: false }).limit(500), []),
    safe(supabase.from("building_rents").select("bedrooms, min_rent, max_rent, median_rent, listing_count, source").eq("building_id", buildingId), []),
    safe(supabase.from("building_amenities").select("amenity, category, source").eq("building_id", buildingId), []),
    safe(supabase.from("building_listings").select("*").eq("building_id", buildingId), []),
    safe(supabase.from("unit_rent_history").select("id, unit_number, bedrooms, bathrooms, rent, sqft, source, observed_at").eq("building_id", buildingId).order("observed_at", { ascending: false }).limit(100), []),
    // Auth checks run in parallel instead of sequentially
    (async (): Promise<{ monitored: boolean; saved: boolean }> => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { monitored: false, saved: false };
        const [monitorRes, saveRes] = await Promise.all([
          supabase.from("monitored_buildings").select("id").eq("user_id", user.id).eq("building_id", buildingId).single(),
          supabase.from("saved_buildings").select("id").eq("user_id", user.id).eq("building_id", buildingId).single(),
        ]);
        return { monitored: !!monitorRes.data, saved: !!saveRes.data };
      } catch {
        return { monitored: false, saved: false };
      }
    })(),
    null, // placeholder for saveStatus — extracted from authStatus below
    safe(supabase.from("building_rents").select("bedrooms, median_rent, buildings!inner(zip_code)").eq("buildings.zip_code", building.zip_code!).neq("building_id", buildingId), [] as { bedrooms: number; median_rent: number; buildings: { zip_code: string }[] }[]),
    isLA
      ? safe(supabase.from("lahd_violation_summary").select("id, building_id, violation_type, violations_cited, violations_cleared").eq("building_id", buildingId).order("violations_cited", { ascending: false }).limit(50), [] as LahdViolationSummary[])
      : Promise.resolve([] as LahdViolationSummary[]),
    // Chicago-specific queries — merged into single Promise.all to avoid sequential await
    isChicago
      ? safe(supabase.from("chicago_rlto_violations").select("*").eq("building_id", buildingId).order("violation_date", { ascending: false }).limit(50), [])
      : Promise.resolve([]),
    isChicago
      ? safe(supabase.from("chicago_lead_inspections").select("*").eq("building_id", buildingId).order("inspection_date", { ascending: false }).limit(50), [])
      : Promise.resolve([]),
    isChicago
      ? safe(supabase.from("chicago_scofflaws").select("*").eq("building_id", buildingId).limit(1), [])
      : Promise.resolve([]),
  ]);

  const authStatus = monitorStatus as unknown as { monitored: boolean; saved: boolean };
  const isMonitored = authStatus.monitored;
  const isSaved = authStatus.saved;

  // Compute zip-level median rents per bedroom for neighborhood comparison
  const neighborhoodRents = (() => {
    const byBedroom = new Map<number, number[]>();
    for (const r of (neighborhoodRentsRaw as { bedrooms: number; median_rent: number }[]) || []) {
      if (r.median_rent > 0) {
        const arr = byBedroom.get(r.bedrooms) || [];
        arr.push(r.median_rent);
        byBedroom.set(r.bedrooms, arr);
      }
    }
    return [...byBedroom.entries()].map(([bedrooms, medians]) => {
      medians.sort((a, b) => a - b);
      const mid = Math.floor(medians.length / 2);
      const median_rent = medians.length % 2 === 0 ? Math.round((medians[mid - 1] + medians[mid]) / 2) : medians[mid];
      return { bedrooms, median_rent };
    });
  })();

  // Fetch schools, transit, and crime data for FAQ (server-side, in parallel)
  const BBOX = 0.025;
  const hasFaqCoords = building.latitude && building.longitude;
  const [faqSchoolsRaw, faqTransitRaw, faqCrimeRaw] = await Promise.all([
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

  // Extract short address for breadcrumb
  const shortAddress = building.full_address.split(",")[0]?.trim() || building.full_address;

  // For non-NYC cities, violation_count may be 0 because it tracks HPD violations only.
  // Use dob_violation_count as the primary violation metric for Chicago.
  const effectiveViolationCount = isChicago
    ? (building.dob_violation_count || 0)
    : (building.violation_count || 0);

  return (
    <AdSidebar>
    <div>
      <TrackBuildingView
        building={{
          id: building.id,
          full_address: building.full_address,
          borough: building.borough,
          slug: building.slug,
          overall_score: building.overall_score,
        }}
      />
      <JsonLd data={buildingJsonLd(building)} />
      <JsonLd data={breadcrumbJsonLd([
        { name: "Home", url: "/" },
        { name: "Buildings", url: cityPath("/buildings", city) },
        { name: building.borough, url: cityPath(`/buildings/${boroughSlug}`, city) },
        { name: shortAddress, url: buildingUrl(building, city) },
      ])} />

      <div className="bg-[#0F1D2E]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Buildings", href: cityPath("/buildings", city) },
              { label: building.borough, href: cityPath(`/buildings/${boroughSlug}`, city) },
              { label: shortAddress, href: buildingUrl(building, city) },
            ]}
            variant="dark"
          />
        </div>
      </div>

      <BuildingHeader building={building} city={city} violationCount={effectiveViolationCount} />

      <SectionNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 scroll-mt-28">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Summary */}
            <QuickSummary
              building={building}
              rents={rents}
              violationCount={effectiveViolationCount}
              complaintCount={building.complaint_count}
              bedbugCount={building.bedbug_report_count}
              evictionCount={building.eviction_count}
            />

            {/* Reviews */}
            <ReviewSection
              reviews={reviews}
              buildingId={buildingId}
              isMonitored={isMonitored}
              cityPath={cityPath("", city)}
              headerActions={
                <>
                  <SaveButton buildingId={buildingId} initialSaved={isSaved} />
                  <ShareButton address={shortAddress} url={canonicalUrl(buildingUrl(building, city))} />
                </>
              }
            />

            {/* Rent History */}
            <div id="rent" className="scroll-mt-28">
              <MarketListings listings={marketListings} amenities={amenities} rentHistory={rentHistory} buildingUrl={buildingUrl(building, city)} />
              {marketListings.length === 0 && rents.length > 0 && (
                <RentRangeCard rents={rents} />
              )}
            </div>

            {/* Building Amenities */}
            {amenities.length > 0 && (
              <div id="amenities" className="scroll-mt-28">
                <BuildingAmenities amenities={amenities} />
              </div>
            )}

            {/* Violation & Complaint Trends */}
            <div id="violation-trends" className="scroll-mt-28">
              <ViolationTrend buildingId={buildingId} housingAgency={city === "los-angeles" ? "LAHD" : city === "chicago" ? "CDBS" : city === "miami" ? "RER" : "HPD"} />
            </div>

            {/* Violations by Unit Breakdown */}
            <div id="violations-by-unit">
            <ViolationsByUnit
              violationSummaries={violationSummaries}
              units={units}
              buildingId={buildingId}
            />
            </div>

            <AdBlock adSlot="BUILDING_MID_2" adFormat="horizontal" />

            {/* Violations & Complaints Tabs */}
            <div id="violations" className="scroll-mt-28">
              <IssuesTabs violations={violations} complaints={complaints} litigations={litigations} dobViolations={dobViolations} bedbugs={bedbugs} evictions={evictions} permits={permits} lahdViolationSummary={lahdViolationSummary} city={city} />
            </div>

            {/* Building Location Map */}
            {building.latitude && building.longitude && (
              <div id="location" className="scroll-mt-28">
              <BuildingLocationMap
                latitude={building.latitude}
                longitude={building.longitude}
                address={building.full_address}
              />
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Building Info */}
            <Card id="building-details" className="scroll-mt-28">
              <CardHeader>
                <h3 className="font-semibold text-[#0F1D2E]">
                  Building Details
                </h3>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  {building.owner_name && (
                    <div>
                      <dt className="text-[#94a3b8]">Owner</dt>
                      <dd className="text-[#0F1D2E] font-medium">
                        {building.owner_name}
                      </dd>
                      {building.owner_name !== "UNAVAILABLE OWNER" && (
                        <Link
                          href={landlordUrl(building.owner_name)}
                          className="text-xs text-[#3B82F6] hover:text-[#2563EB] font-medium mt-0.5 inline-block transition-colors"
                        >
                          View Portfolio &rarr;
                        </Link>
                      )}
                    </div>
                  )}
                  {building.building_class && (
                    <div>
                      <dt className="text-[#94a3b8]">Building Class</dt>
                      <dd className="text-[#0F1D2E] font-medium">
                        {building.building_class}
                      </dd>
                    </div>
                  )}
                  {building.land_use && (
                    <div>
                      <dt className="text-[#94a3b8]">Land Use</dt>
                      <dd className="text-[#0F1D2E] font-medium">
                        {building.land_use}
                      </dd>
                    </div>
                  )}
                  {building.residential_units != null && (
                    <div>
                      <dt className="text-[#94a3b8]">Residential Units</dt>
                      <dd className="text-[#0F1D2E] font-medium">
                        {building.residential_units}
                      </dd>
                    </div>
                  )}
                  {building.commercial_units != null &&
                    building.commercial_units > 0 && (
                      <div>
                        <dt className="text-[#94a3b8]">Commercial Units</dt>
                        <dd className="text-[#0F1D2E] font-medium">
                          {building.commercial_units}
                        </dd>
                      </div>
                    )}
                  {(building.bbl || building.apn || building.pin) && (
                    <div>
                      <dt className="text-[#94a3b8]">{building.pin ? "PIN" : building.apn ? "APN" : "BBL"}</dt>
                      <dd className="text-[#0F1D2E] font-mono text-xs">
                        {building.pin || building.apn || building.bbl}
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            {/* Rent Stabilization */}
            <div id="rent-stabilization">
            <RentStabilizationCard
              isStabilized={building.is_rent_stabilized}
              stabilizedUnits={building.stabilized_units}
              totalUnits={building.residential_units}
              stabilizedYear={building.stabilized_year}
              yearBuilt={building.year_built}
              city={city}
            />
            </div>


            {/* Rent Comparison */}
            {building.zip_code && (
              <div id="rent-comparison">
                <RentComparison
                  buildingRents={rents}
                  neighborhoodRents={neighborhoodRents}
                  zipCode={building.zip_code}
                  borough={building.borough}
                />
              </div>
            )}
            {/* Energy Score */}
            <div id="energy-score">
              <EnergyScoreCard data={energyData[0] || null} />
            </div>

            {/* Seismic & Fire Zones (NYC / LA only) */}
            {isLA && building.latitude && building.longitude ? (
              <HazardZonesCard
                latitude={building.latitude}
                longitude={building.longitude}
                isSoftStory={building.is_soft_story}
                softStoryStatus={building.soft_story_status}
                city={city}
              />
            ) : isNYC ? (
              <SeismicSafetyCard
                isSoftStory={building.is_soft_story}
                softStoryStatus={building.soft_story_status}
              />
            ) : null}

            {/* Chicago Info */}
            {isChicago && (
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-[#0F1D2E]">Chicago Info</h3>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-3 text-sm">
                    {building.is_rlto_protected != null && (
                      <div>
                        <dt className="text-[#94a3b8]">RLTO Protection</dt>
                        <dd className="text-[#0F1D2E] font-medium">
                          {building.is_rlto_protected ? (
                            <span className="text-green-600">Protected</span>
                          ) : (
                            <span className="text-[#94a3b8]">Not covered</span>
                          )}
                        </dd>
                      </div>
                    )}
                    {building.is_scofflaw != null && (
                      <div>
                        <dt className="text-[#94a3b8]">Scofflaw Status</dt>
                        <dd className="text-[#0F1D2E] font-medium">
                          {building.is_scofflaw ? (
                            <span className="text-red-600">Scofflaw</span>
                          ) : (
                            <span className="text-green-600">Clear</span>
                          )}
                        </dd>
                      </div>
                    )}
                    {building.ward && (
                      <div>
                        <dt className="text-[#94a3b8]">Ward</dt>
                        <dd className="text-[#0F1D2E] font-medium">{building.ward}</dd>
                      </div>
                    )}
                    {building.community_area && (
                      <div>
                        <dt className="text-[#94a3b8]">Community Area</dt>
                        <dd className="text-[#0F1D2E] font-medium">{building.community_area}</dd>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>
            )}

            {/* Nearby Transit */}
            {building.latitude && building.longitude && (
              <div id="transit" className="scroll-mt-28">
              <NearbyTransit
                latitude={building.latitude}
                longitude={building.longitude}
                city={city}
              />
              </div>
            )}

            {/* Nearby Schools & Colleges */}
            {building.latitude && building.longitude && (
              <div id="schools">
              <NearbySchools
                latitude={building.latitude}
                longitude={building.longitude}
                city={city}
              />
              </div>
            )}

            {/* Nearby Recreation */}
            {building.latitude && building.longitude && (
              <div id="recreation">
              <NearbyRecreation
                latitude={building.latitude}
                longitude={building.longitude}
              />
              </div>
            )}

            {/* Encampment Reports (LA only) */}
            {building.latitude && building.longitude && city === "los-angeles" && (
              <NearbyEncampments
                latitude={building.latitude}
                longitude={building.longitude}
              />
            )}

            {/* Neighborhood Crime */}
            {building.zip_code && (
              <div id="crime" className="scroll-mt-28">
              <NearbyCrimeSummary zipCode={building.zip_code} />
              </div>
            )}

          </div>
        </div>

        {/* Same Landlord Buildings — cross-link within portfolio */}
        {building.owner_name && building.owner_name !== "UNAVAILABLE OWNER" && (
          <div id="same-landlord" className="mt-8">
            <SameLandlordBuildings
              buildingId={buildingId}
              ownerName={building.owner_name}
              city={city}
            />
          </div>
        )}

        {/* Nearby Buildings — full width below the grid */}
        {building.zip_code && (
          <div id="nearby-buildings" className="mt-8">
            <NearbyBuildings
              buildingId={buildingId}
              zipCode={building.zip_code}
              borough={building.borough}
              city={city}
            />
          </div>
        )}

        {/* FAQ — SEO-optimized Q&A section */}
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
      </div>
    </div>
    </AdSidebar>
  );
}
