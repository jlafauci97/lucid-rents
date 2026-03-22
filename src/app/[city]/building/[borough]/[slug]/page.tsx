import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BuildingHeader } from "@/components/building/BuildingHeader";
import { QuickSummary } from "@/components/building/QuickSummary";
import { IssuesTabs } from "@/components/building/IssuesTabs";
import { ViolationTrend } from "@/components/building/ViolationTrend";
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
import { SLUG_TO_BOROUGH, buildingUrl, canonicalUrl, buildingJsonLd, breadcrumbJsonLd, landlordUrl, cityPath } from "@/lib/seo";
import { CITY_META } from "@/lib/cities";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { TrackBuildingView } from "@/components/building/TrackBuildingView";
import { cache } from "react";
import type { Building, HpdViolation, Complaint311, HpdLitigation, DobViolation, BedBugReport, Eviction, DobPermit, EnergyBenchmark, ReviewWithDetails } from "@/types";
import type { Metadata } from "next";

export const revalidate = 86400; // 24h ISR

interface BuildingSlugPageProps {
  params: Promise<{ city: string; borough: string; slug: string }>;
}

// cache() deduplicates across generateMetadata + page render in the same request
const getBuilding = cache(async (boroughSlug: string, slug: string) => {
  const borough = SLUG_TO_BOROUGH[boroughSlug];
  if (!borough) return null;

  const supabase = await createClient();
  // Use borough + slug + limit(1) instead of .single() to handle duplicate slugs
  const { data } = await supabase
    .from("buildings")
    .select("*")
    .eq("slug", slug)
    .eq("borough", borough)
    .limit(1);

  if (!data || data.length === 0) return null;
  return data[0] as Building;
});

export async function generateMetadata({
  params,
}: BuildingSlugPageProps): Promise<Metadata> {
  const { city: cityParam, borough, slug } = await params;
  const building = await getBuilding(borough, slug);

  if (!building) return { title: "Building Not Found" };

  const title = `${building.full_address} | Lucid Rents`;
  const descParts = [
    `${building.violation_count} violations`,
    `${building.complaint_count} complaints`,
  ];
  if (building.bedbug_report_count > 0) descParts.push(`${building.bedbug_report_count} bedbug reports`);
  if (building.eviction_count > 0) descParts.push(`${building.eviction_count} evictions`);
  const cityName = CITY_META[cityParam as keyof typeof CITY_META]?.name || "NYC";
  const description = `Thinking about ${building.full_address}? Check ${descParts.join(", ")}, and real tenant reviews before you sign a lease.`;
  const url = canonicalUrl(buildingUrl(building));

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
  const city = (cityParam || "nyc") as import("@/lib/cities").City;
  const building = await getBuilding(boroughSlug, slug);

  if (!building) notFound();

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
  const emptyHpdLit = [] as HpdLitigation[];
  const emptyDobVio = [] as DobViolation[];
  const emptyBedbugs = [] as BedBugReport[];
  const emptyEvictions = [] as Eviction[];

  // Fetch all data in parallel — skip NYC-only tables for LA buildings
  const [violations, complaints, litigations, dobViolations, bedbugs, evictions, permits, energyData, reviews, units, violationSummaries, rents, amenities, marketListings, rentHistory, monitorStatus, saveStatus, neighborhoodRentsRaw] = await Promise.all([
    safe(supabase.from("hpd_violations").select("*").eq("building_id", buildingId).order("inspection_date", { ascending: false }).limit(20), [] as HpdViolation[]),
    safe(supabase.from("complaints_311").select("*").eq("building_id", buildingId).order("created_date", { ascending: false }).limit(20), [] as Complaint311[]),
    isLA ? Promise.resolve(emptyHpdLit) : safe(supabase.from("hpd_litigations").select("*").eq("building_id", buildingId).order("case_open_date", { ascending: false }).limit(20), emptyHpdLit),
    isLA ? Promise.resolve(emptyDobVio) : safe(supabase.from("dob_violations").select("*").eq("building_id", buildingId).order("issue_date", { ascending: false }).limit(20), emptyDobVio),
    isLA ? Promise.resolve(emptyBedbugs) : safe(supabase.from("bedbug_reports").select("*").eq("building_id", buildingId).order("filing_date", { ascending: false }).limit(20), emptyBedbugs),
    isLA ? Promise.resolve(emptyEvictions) : safe(supabase.from("evictions").select("*").eq("building_id", buildingId).order("executed_date", { ascending: false }).limit(20), emptyEvictions),
    safe(supabase.from("dob_permits").select("*").eq("building_id", buildingId).order("issued_date", { ascending: false }).limit(20), [] as DobPermit[]),
    safe(supabase.from("energy_benchmarks").select("*").eq("building_id", buildingId).order("report_year", { ascending: false }).limit(1), [] as EnergyBenchmark[]),
    safe(supabase.from("reviews").select(`*, profile:profiles(id, display_name, avatar_url), category_ratings:review_category_ratings(*, category:review_categories(slug, name, icon)), unit:units(unit_number)`).eq("building_id", buildingId).eq("status", "published").order("created_at", { ascending: false }).limit(10), []) as Promise<ReviewWithDetails[]>,
    safe(supabase.from("units").select("*").eq("building_id", buildingId).order("unit_number", { ascending: true }), []),
    safe(supabase.from("hpd_violations").select("id, apartment, class, status, inspection_date, nov_description").eq("building_id", buildingId).order("inspection_date", { ascending: false }).limit(10000), []),
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

  // Extract short address for breadcrumb
  const shortAddress = building.full_address.split(",")[0]?.trim() || building.full_address;

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
        { name: shortAddress, url: buildingUrl(building) },
      ])} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Buildings", href: cityPath("/buildings", city) },
            { label: building.borough, href: cityPath(`/buildings/${boroughSlug}`, city) },
            { label: shortAddress, href: buildingUrl(building) },
          ]}
        />
      </div>

      <BuildingHeader building={building} city={city} />

      <SectionNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 scroll-mt-28">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Summary */}
            <QuickSummary
              building={building}
              rents={rents}
              violationCount={building.violation_count}
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
                  <ShareButton address={shortAddress} url={canonicalUrl(buildingUrl(building))} />
                </>
              }
            />

            {/* Rent History */}
            <div id="rent" className="scroll-mt-28">
              <MarketListings listings={marketListings} amenities={amenities} rentHistory={rentHistory} buildingUrl={buildingUrl(building)} />
            </div>

            {/* Building Amenities */}
            {amenities.length > 0 && (
              <div id="amenities" className="scroll-mt-28">
                <BuildingAmenities amenities={amenities} />
              </div>
            )}

            {/* Violation & Complaint Trends */}
            <div id="violation-trends" className="scroll-mt-28">
              <ViolationTrend buildingId={buildingId} housingAgency={city === "los-angeles" ? "LAHD" : "HPD"} />
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
              <IssuesTabs violations={violations} complaints={complaints} litigations={litigations} dobViolations={dobViolations} bedbugs={bedbugs} evictions={evictions} permits={permits} city={city} />
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
                      <Link
                        href={landlordUrl(building.owner_name)}
                        className="text-xs text-[#3B82F6] hover:text-[#2563EB] font-medium mt-0.5 inline-block transition-colors"
                      >
                        View Portfolio &rarr;
                      </Link>
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
                  {(building.bbl || building.apn) && (
                    <div>
                      <dt className="text-[#94a3b8]">{building.apn ? "APN" : "BBL"}</dt>
                      <dd className="text-[#0F1D2E] font-mono text-xs">
                        {building.apn || building.bbl}
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

            {/* Seismic & Fire Safety */}
            {isLA && building.latitude && building.longitude ? (
              <HazardZonesCard
                latitude={building.latitude}
                longitude={building.longitude}
                isSoftStory={building.is_soft_story}
                softStoryStatus={building.soft_story_status}
                city={city}
              />
            ) : (
              <SeismicSafetyCard
                isSoftStory={building.is_soft_story}
                softStoryStatus={building.soft_story_status}
              />
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
        {building.owner_name && (
          <div id="same-landlord" className="mt-8">
            <SameLandlordBuildings
              buildingId={buildingId}
              ownerName={building.owner_name}
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
            />
          </div>
        )}
      </div>
    </div>
    </AdSidebar>
  );
}
