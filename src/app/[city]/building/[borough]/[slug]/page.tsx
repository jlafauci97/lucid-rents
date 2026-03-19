import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BuildingHeader } from "@/components/building/BuildingHeader";
import { IssuesTabs } from "@/components/building/IssuesTabs";
import { ViolationTrend } from "@/components/building/ViolationTrend";
import { ViolationsByUnit } from "@/components/building/ViolationsByUnit";
import { ReviewCard } from "@/components/review/ReviewCard";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MonitorButton } from "@/components/building/MonitorButton";
import { NearbyCrimeSummary } from "@/components/crime/NearbyCrimeSummary";
import { NearbyTransit } from "@/components/transit/NearbyTransit";
import { NearbySchools } from "@/components/schools/NearbySchools";
import { NearbyRecreation } from "@/components/building/NearbyRecreation";
import { NearbyBuildings } from "@/components/building/NearbyBuildings";
import { SameLandlordBuildings } from "@/components/building/SameLandlordBuildings";
import { BuildingLocationMap } from "@/components/building/BuildingLocationMap";
import { RentStabilizationCard } from "@/components/building/RentStabilizationCard";
import { RentRangeCard } from "@/components/building/RentRangeCard";
import { BuildingAmenities } from "@/components/building/BuildingAmenities";
import { RentHistory } from "@/components/building/RentHistory";
import type { RentHistoryEntry } from "@/components/building/RentHistory";
import { EnergyScoreCard } from "@/components/building/EnergyScoreCard";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { SLUG_TO_BOROUGH, buildingUrl, canonicalUrl, buildingJsonLd, breadcrumbJsonLd, landlordUrl, cityPath } from "@/lib/seo";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { PenSquare } from "lucide-react";
import type { Building, HpdViolation, Complaint311, HpdLitigation, DobViolation, BedBugReport, Eviction, DobPermit, EnergyBenchmark, ReviewWithDetails, UnitListing } from "@/types";
import type { Metadata } from "next";

export const revalidate = 86400; // 24h ISR

interface BuildingSlugPageProps {
  params: Promise<{ borough: string; slug: string }>;
}

async function getBuilding(boroughSlug: string, slug: string) {
  const borough = SLUG_TO_BOROUGH[boroughSlug];
  if (!borough) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("buildings")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!data) return null;
  // Verify borough matches
  if (data.borough !== borough) return null;
  return data as Building;
}

export async function generateMetadata({
  params,
}: BuildingSlugPageProps): Promise<Metadata> {
  const { borough, slug } = await params;
  const building = await getBuilding(borough, slug);

  if (!building) return { title: "Building Not Found" };

  const title = `${building.full_address} | Lucid Rents`;
  const descParts = [
    `${building.violation_count} violations`,
    `${building.complaint_count} complaints`,
  ];
  if (building.bedbug_report_count > 0) descParts.push(`${building.bedbug_report_count} bedbug reports`);
  if (building.eviction_count > 0) descParts.push(`${building.eviction_count} evictions`);
  const description = `View ${descParts.join(", ")}, and tenant reviews for ${building.full_address} in ${building.borough}, NYC.`;
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
  const { borough: boroughSlug, slug } = await params;
  const building = await getBuilding(boroughSlug, slug);

  if (!building) notFound();

  const supabase = await createClient();
  const buildingId = building.id;

  // Fetch violations, complaints, litigations, DOB violations, bedbugs, evictions, reviews, and units in parallel
  const [violationsRes, complaintsRes, litigationsRes, dobViolationsRes, bedbugsRes, evictionsRes, permitsRes, energyRes, reviewsRes, unitsRes, violationSummaryRes, rentsRes, amenitiesRes, listingsRes, unitListingsRes] = await Promise.all([
    supabase
      .from("hpd_violations")
      .select("*")
      .eq("building_id", buildingId)
      .order("inspection_date", { ascending: false })
      .limit(20),
    supabase
      .from("complaints_311")
      .select("*")
      .eq("building_id", buildingId)
      .order("created_date", { ascending: false })
      .limit(20),
    supabase
      .from("hpd_litigations")
      .select("*")
      .eq("building_id", buildingId)
      .order("case_open_date", { ascending: false })
      .limit(20),
    supabase
      .from("dob_violations")
      .select("*")
      .eq("building_id", buildingId)
      .order("issue_date", { ascending: false })
      .limit(20),
    supabase
      .from("bedbug_reports")
      .select("*")
      .eq("building_id", buildingId)
      .order("filing_date", { ascending: false })
      .limit(20),
    supabase
      .from("evictions")
      .select("*")
      .eq("building_id", buildingId)
      .order("executed_date", { ascending: false })
      .limit(20),
    supabase
      .from("dob_permits")
      .select("*")
      .eq("building_id", buildingId)
      .order("issued_date", { ascending: false })
      .limit(20),
    supabase
      .from("energy_benchmarks")
      .select("*")
      .eq("building_id", buildingId)
      .order("report_year", { ascending: false })
      .limit(1),
    supabase
      .from("reviews")
      .select(
        `*, profile:profiles(id, display_name, avatar_url), category_ratings:review_category_ratings(*, category:review_categories(slug, name, icon)), unit:units(unit_number)`
      )
      .eq("building_id", buildingId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("units")
      .select("*")
      .eq("building_id", buildingId)
      .order("unit_number", { ascending: true }),
    supabase
      .from("hpd_violations")
      .select("apartment, class, status, inspection_date")
      .eq("building_id", buildingId),
    supabase
      .from("building_rents")
      .select("bedrooms, min_rent, max_rent, median_rent, listing_count, source")
      .eq("building_id", buildingId),
    supabase
      .from("building_amenities")
      .select("amenity, category, source")
      .eq("building_id", buildingId),
    supabase
      .from("building_listings")
      .select("*")
      .eq("building_id", buildingId),
    supabase
      .from("unit_listings")
      .select("*")
      .eq("building_id", buildingId)
      .eq("available", true),
  ]);

  const violations = (violationsRes.data || []) as HpdViolation[];
  const complaints = (complaintsRes.data || []) as Complaint311[];
  const litigations = (litigationsRes.data || []) as HpdLitigation[];
  const dobViolations = (dobViolationsRes.data || []) as DobViolation[];
  const bedbugs = (bedbugsRes.data || []) as BedBugReport[];
  const evictions = (evictionsRes.data || []) as Eviction[];
  const permits = (permitsRes.data || []) as DobPermit[];
  const energyData = (energyRes.data || []) as EnergyBenchmark[];
  const reviews = (reviewsRes.data || []) as unknown as ReviewWithDetails[];
  const units = unitsRes.data || [];
  const violationSummaries = violationSummaryRes.data || [];
  const rents = rentsRes.data || [];
  const amenities = amenitiesRes.data || [];
  const marketListings = listingsRes.data || [];
  const unitListings = (unitListingsRes.data || []) as UnitListing[];

  // Check if user is monitoring this building
  let isMonitored = false;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: monitorData } = await supabase
      .from("monitored_buildings")
      .select("id")
      .eq("user_id", user.id)
      .eq("building_id", buildingId)
      .single();
    isMonitored = !!monitorData;
  }

  // Extract short address for breadcrumb
  const shortAddress = building.full_address.split(",")[0]?.trim() || building.full_address;

  return (
    <AdSidebar>
    <div>
      <JsonLd data={buildingJsonLd(building)} />
      <JsonLd data={breadcrumbJsonLd([
        { name: "Home", url: "/" },
        { name: "Buildings", url: cityPath("/buildings") },
        { name: building.borough, url: cityPath(`/buildings/${boroughSlug}`) },
        { name: shortAddress, url: buildingUrl(building) },
      ])} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Buildings", href: cityPath("/buildings") },
            { label: building.borough, href: cityPath(`/buildings/${boroughSlug}`) },
            { label: shortAddress, href: buildingUrl(building) },
          ]}
        />
      </div>

      <BuildingHeader building={building} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Reviews */}
            <section id="reviews">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[#0F1D2E]">
                  Tenant Reviews ({reviews.length})
                </h2>
                <div className="flex items-center gap-2">
                  <MonitorButton buildingId={buildingId} initialMonitored={isMonitored} />
                  <Link href={cityPath(`/review/new?building=${buildingId}`)}>
                    <Button size="sm">
                      <PenSquare className="w-4 h-4 mr-2" />
                      Write Review
                    </Button>
                  </Link>
                </div>
              </div>
              {reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent>
                    <p className="text-center text-[#64748b] py-8">
                      No reviews yet. Be the first to review this building!
                    </p>
                  </CardContent>
                </Card>
              )}
            </section>

            {/* Rent History */}
            <div id="rent">
              <MarketListings listings={marketListings} amenities={amenities} units={units} unitListings={unitListings} buildingUrl={buildingUrl(building)} />
            </div>

            {/* Building Amenities */}
            {amenities.length > 0 && (
              <div id="amenities">
                <BuildingAmenities amenities={amenities} />
              </div>
            )}

            {/* Violation & Complaint Trends */}
            <div id="violation-trends">
              <ViolationTrend buildingId={buildingId} />
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
            <div id="violations">
              <IssuesTabs violations={violations} complaints={complaints} litigations={litigations} dobViolations={dobViolations} bedbugs={bedbugs} evictions={evictions} permits={permits} />
            </div>

            {/* Building Location Map */}
            {building.latitude && building.longitude && (
              <div id="location">
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
            <Card id="building-details">
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
                  {building.bbl && (
                    <div>
                      <dt className="text-[#94a3b8]">BBL</dt>
                      <dd className="text-[#0F1D2E] font-mono text-xs">
                        {building.bbl}
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
            />
            </div>

            {/* Energy Score */}
            <div id="energy-score">
              <EnergyScoreCard data={energyData[0] || null} />
            </div>

            {/* Nearby Transit */}
            {building.latitude && building.longitude && (
              <div id="transit">
              <NearbyTransit
                latitude={building.latitude}
                longitude={building.longitude}
              />
              </div>
            )}

            {/* Nearby Schools & Colleges */}
            {building.latitude && building.longitude && (
              <div id="schools">
              <NearbySchools
                latitude={building.latitude}
                longitude={building.longitude}
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

            {/* Neighborhood Crime */}
            {building.zip_code && (
              <div id="crime">
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
