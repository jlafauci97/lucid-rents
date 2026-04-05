import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { BuildingHeader } from "@/components/building/BuildingHeader";
import { QuickSummary } from "@/components/building/QuickSummary";
import { DeferredBuildingContent } from "@/components/building/DeferredBuildingContent";
import { DeferredBuildingFAQ } from "@/components/building/DeferredBuildingFAQ";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { SectionNav } from "@/components/building/SectionNav";
import { NearbyCrimeSummary } from "@/components/crime/NearbyCrimeSummary";
import { NearbyTransit } from "@/components/transit/NearbyTransit";
import { NearbySchools } from "@/components/schools/NearbySchools";
import { NearbyRecreation } from "@/components/building/NearbyRecreation";
import { NearbyEncampments } from "@/components/building/NearbyEncampments";
import { NearbyBuildings } from "@/components/building/NearbyBuildings";
import { SameLandlordBuildings } from "@/components/building/SameLandlordBuildings";
import { RentStabilizationCard } from "@/components/building/RentStabilizationCard";
import { RentComparison } from "@/components/building/RentComparison";
import { EnergyScoreCard } from "@/components/building/EnergyScoreCard";
import { SeismicSafetyCard } from "@/components/building/SeismicSafetyCard";
import { HazardZonesCard } from "@/components/building/HazardZonesCard";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { SLUG_TO_BOROUGH, regionFromSlug, buildingUrl, canonicalUrl, buildingJsonLd, breadcrumbJsonLd, landlordUrl, cityPath } from "@/lib/seo";
import { CITY_META, VALID_CITIES, type City } from "@/lib/cities";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { TrackBuildingView } from "@/components/building/TrackBuildingView";
import { T } from "@/lib/design-tokens";
import { cache } from "react";
import type { Building, EnergyBenchmark } from "@/types";
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

  const title =
    building.review_count > 0 && building.overall_score != null
      ? `${building.full_address} — Rated ${building.overall_score}/5 by Tenants`
      : `${building.full_address} — Violations, Reviews & Building Score`;
  const isChicagoMeta = cityParam === "chicago" || cityParam === "miami" || cityParam === "houston";
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
  const description = `${building.full_address} has ${descParts.join(" and ")}. Read tenant reviews, check bedbug history, and see the building score — free.`;
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
      type: "article",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

// Helper: wrap each query so a single failure doesn't kill the whole page
const safe = <T,>(promise: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> =>
  Promise.resolve(promise).then(({ data, error }) => {
    if (error) console.error("Supabase query error:", error);
    return data ?? fallback;
  }).catch((err: unknown) => {
    console.error("Supabase query exception:", err);
    return fallback;
  });

// Loading skeleton for the main content area
function ContentSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Reviews skeleton */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
        <div className="h-6 w-40 bg-[#e2e8f0] rounded mb-4" />
        <div className="space-y-3">
          <div className="h-24 bg-[#FAFBFD] rounded-lg" />
          <div className="h-24 bg-[#FAFBFD] rounded-lg" />
        </div>
      </div>
      {/* Rent skeleton */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
        <div className="h-6 w-36 bg-[#e2e8f0] rounded mb-4" />
        <div className="h-[200px] bg-[#FAFBFD] rounded-lg" />
      </div>
      {/* Chart skeleton */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
        <div className="h-6 w-48 bg-[#e2e8f0] rounded mb-4" />
        <div className="h-[300px] bg-[#FAFBFD] rounded-lg" />
      </div>
    </div>
  );
}

// Loading skeleton for the full-width bottom sections
function BottomSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-6 w-48 bg-[#e2e8f0] rounded mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-[#FAFBFD] rounded-2xl border border-[#E2E8F0]" />)}
      </div>
    </div>
  );
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

  const isLA = city === "los-angeles";
  const isChicago = city === "chicago";
  const isNYC = city === "nyc";
  const isHouston = city === "houston";

  // Critical data only — just what's needed for above-the-fold content
  const [rents, energyData, neighborhoodRentsRaw, deweyLatestRaw, deweyNeighborhoodLatestRaw] = await Promise.all([
    safe(supabase.from("building_rents").select("bedrooms, min_rent, max_rent, median_rent, listing_count, source").eq("building_id", buildingId), []),
    safe(supabase.from("energy_benchmarks").select("*").eq("building_id", buildingId).order("report_year", { ascending: false }).limit(1), [] as EnergyBenchmark[]),
    building.zip_code
      ? safe(supabase.from("building_rents").select("bedrooms, median_rent, buildings!inner(zip_code)").eq("buildings.zip_code", building.zip_code!).neq("building_id", buildingId), [] as { bedrooms: number; median_rent: number; buildings: { zip_code: string }[] }[])
      : Promise.resolve([] as { bedrooms: number; median_rent: number; buildings: { zip_code: string }[] }[]),
    // Dewey: latest month building rents for above-the-fold badges
    safe(supabase.from("dewey_building_rents").select("month, beds, median_rent, avg_price_per_sqft, listing_count").eq("building_id", buildingId).order("month", { ascending: false }).limit(10), [] as { month: string; beds: number; median_rent: number; avg_price_per_sqft: number; listing_count: number }[]),
    // Dewey: latest month neighborhood rents for comparison
    building.zip_code
      ? safe(supabase.from("dewey_neighborhood_rents").select("month, beds, median_rent").eq("zip", building.zip_code).order("month", { ascending: false }).limit(10), [] as { month: string; beds: number; median_rent: number }[])
      : Promise.resolve([] as { month: string; beds: number; median_rent: number }[]),
  ]);

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

  // For non-NYC cities, violation_count may be 0 because it tracks HPD violations only.
  // Use dob_violation_count as the primary violation metric for Chicago.
  const effectiveViolationCount = (isChicago || isHouston)
    ? (building.dob_violation_count || 0)
    : (building.violation_count || 0);

  // Dewey rent intelligence: compute above-the-fold metrics
  const deweyMetrics = (() => {
    try {
    if (!deweyLatestRaw || deweyLatestRaw.length === 0) return null;
    // Find the latest month
    const latestMonth = deweyLatestRaw[0]?.month;
    if (!latestMonth) return null;
    const latestRows = deweyLatestRaw.filter(r => r.month === latestMonth);
    if (latestRows.length === 0) return null;

    // Weighted median rent and price per sqft
    let totalRent = 0, totalPsf = 0, totalWeight = 0, psfWeight = 0;
    for (const r of latestRows) {
      const w = r.listing_count || 1;
      if (r.median_rent > 0) { totalRent += r.median_rent * w; totalWeight += w; }
      if (r.avg_price_per_sqft > 0) { totalPsf += r.avg_price_per_sqft * w; psfWeight += w; }
    }
    const medianRent = totalWeight > 0 ? Math.round(totalRent / totalWeight) : undefined;
    const pricePerSqft = psfWeight > 0 ? totalPsf / psfWeight : undefined;

    // Neighborhood median for same month
    const nhLatest = (deweyNeighborhoodLatestRaw || []).filter(r => r.month === latestMonth);
    let nhTotalRent = 0, nhTotalWeight = 0;
    for (const r of nhLatest) {
      if (r.median_rent > 0) { nhTotalRent += r.median_rent; nhTotalWeight += 1; }
    }
    const neighborhoodMedianRent = nhTotalWeight > 0 ? Math.round(nhTotalRent / nhTotalWeight) : undefined;

    // YoY rent change: compare latest month to 12 months prior
    const latestDateStr = String(latestMonth).slice(0, 10); // "2024-07-01"
    const latestDate = new Date(latestDateStr + "T00:00:00Z");
    const priorDate = new Date(latestDate);
    priorDate.setFullYear(priorDate.getFullYear() - 1);
    const priorMonth = priorDate.toISOString().slice(0, 7) + "-01";
    const priorRows = deweyLatestRaw.filter(r => r.month === priorMonth);
    let rentChangeYoY: number | undefined;
    if (priorRows.length > 0 && medianRent) {
      let priorTotal = 0, priorW = 0;
      for (const r of priorRows) {
        const w = r.listing_count || 1;
        if (r.median_rent > 0) { priorTotal += r.median_rent * w; priorW += w; }
      }
      if (priorW > 0) {
        const priorMedian = priorTotal / priorW;
        rentChangeYoY = ((medianRent - priorMedian) / priorMedian) * 100;
      }
    }

    // Value grade
    let valueGrade: string | undefined;
    if (medianRent && neighborhoodMedianRent && neighborhoodMedianRent > 0) {
      const diff = (medianRent - neighborhoodMedianRent) / neighborhoodMedianRent;
      const qualityBonus = ((building.overall_score ?? 5) - 5) * 0.02;
      const violationPenalty = Math.min((effectiveViolationCount) / 100, 0.1);
      const adjustedDiff = diff - qualityBonus + violationPenalty;
      if (adjustedDiff <= -0.15) valueGrade = "A";
      else if (adjustedDiff <= -0.05) valueGrade = "B";
      else if (adjustedDiff <= 0.05) valueGrade = "C";
      else if (adjustedDiff <= 0.15) valueGrade = "D";
      else valueGrade = "F";
    }

    return { medianRent, pricePerSqft, neighborhoodMedianRent, rentChangeYoY, valueGrade };
    } catch (e) { return null; }
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
        { name: shortAddress, url: buildingUrl(building, city) },
      ])} />

      <div style={{ backgroundColor: T.surface }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Buildings", href: cityPath("/buildings", city) },
              { label: building.borough, href: cityPath(`/buildings/${boroughSlug}`, city) },
              { label: shortAddress, href: buildingUrl(building, city) },
            ]}
          />
        </div>
      </div>

      <BuildingHeader building={building} city={city} violationCount={effectiveViolationCount} valueGrade={deweyMetrics?.valueGrade} medianRent={deweyMetrics?.medianRent} pricePerSqft={deweyMetrics?.pricePerSqft} />

      <SectionNav />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 scroll-mt-28">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-12">
            {/* Below-fold content streams in via Suspense */}
            <Suspense fallback={<ContentSkeleton />}>
              <DeferredBuildingContent
                building={building}
                buildingId={buildingId}
                city={city}
                rents={rents}
              />
            </Suspense>
          </div>

          {/* Sidebar — static props render immediately, client components fetch independently */}
          <div className="space-y-6">
            {/* Building Info */}
            <Card id="building-details" className="scroll-mt-28">
              <CardHeader>
                <h3 className="font-semibold" style={{ color: T.text1 }}>
                  Building Details
                </h3>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  {building.owner_name && (
                    <div>
                      <dt style={{ color: T.text3 }}>Owner</dt>
                      <dd className="font-medium" style={{ color: T.text1 }}>
                        {building.owner_name}
                      </dd>
                      {building.owner_name !== "UNAVAILABLE OWNER" && (
                        <Link
                          href={landlordUrl(building.owner_name)}
                          className="text-xs font-medium mt-0.5 inline-block transition-colors hover:opacity-80"
                          style={{ color: T.blue }}
                        >
                          View Portfolio &rarr;
                        </Link>
                      )}
                    </div>
                  )}
                  {building.building_class && (
                    <div>
                      <dt style={{ color: T.text3 }}>Building Class</dt>
                      <dd className="font-medium" style={{ color: T.text1 }}>
                        {building.building_class}
                      </dd>
                    </div>
                  )}
                  {building.land_use && (
                    <div>
                      <dt style={{ color: T.text3 }}>Land Use</dt>
                      <dd className="font-medium" style={{ color: T.text1 }}>
                        {building.land_use}
                      </dd>
                    </div>
                  )}
                  {building.residential_units != null && (
                    <div>
                      <dt style={{ color: T.text3 }}>Residential Units</dt>
                      <dd className="font-medium" style={{ color: T.text1 }}>
                        {building.residential_units}
                      </dd>
                    </div>
                  )}
                  {building.commercial_units != null &&
                    building.commercial_units > 0 && (
                      <div>
                        <dt style={{ color: T.text3 }}>Commercial Units</dt>
                        <dd className="font-medium" style={{ color: T.text1 }}>
                          {building.commercial_units}
                        </dd>
                      </div>
                    )}
                  {(building.bbl || building.apn || building.pin) && (
                    <div>
                      <dt style={{ color: T.text3 }}>{building.pin ? "PIN" : building.apn ? "APN" : "BBL"}</dt>
                      <dd className="font-mono text-xs" style={{ color: T.text1 }}>
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
                  <h3 className="font-semibold" style={{ color: T.text1 }}>Chicago Info</h3>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-3 text-sm">
                    {building.is_rlto_protected != null && (
                      <div>
                        <dt style={{ color: T.text3 }}>RLTO Protection</dt>
                        <dd className="font-medium" style={{ color: T.text1 }}>
                          {building.is_rlto_protected ? (
                            <span style={{ color: T.sage }}>Protected</span>
                          ) : (
                            <span style={{ color: T.text3 }}>Not covered</span>
                          )}
                        </dd>
                      </div>
                    )}
                    {building.is_scofflaw != null && (
                      <div>
                        <dt style={{ color: T.text3 }}>Scofflaw Status</dt>
                        <dd className="font-medium" style={{ color: T.text1 }}>
                          {building.is_scofflaw ? (
                            <span style={{ color: T.danger }}>Scofflaw</span>
                          ) : (
                            <span style={{ color: T.sage }}>Clear</span>
                          )}
                        </dd>
                      </div>
                    )}
                    {building.ward && (
                      <div>
                        <dt style={{ color: T.text3 }}>Ward</dt>
                        <dd className="font-medium" style={{ color: T.text1 }}>{building.ward}</dd>
                      </div>
                    )}
                    {building.community_area && (
                      <div>
                        <dt style={{ color: T.text3 }}>Community Area</dt>
                        <dd className="font-medium" style={{ color: T.text1 }}>{building.community_area}</dd>
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

        {/* Same Landlord / Management Company Buildings — cross-link within portfolio */}
        {(building.management_company || (building.owner_name && building.owner_name !== "UNAVAILABLE OWNER")) && (
          <Suspense fallback={<BottomSkeleton />}>
            <div id="same-landlord" className="mt-8">
              <SameLandlordBuildings
                buildingId={buildingId}
                ownerName={building.owner_name || ""}
                managementCompany={building.management_company}
                city={city}
              />
            </div>
          </Suspense>
        )}

        {/* Nearby Buildings — full width below the grid */}
        {building.zip_code && (
          <Suspense fallback={<BottomSkeleton />}>
            <div id="nearby-buildings" className="mt-8">
              <NearbyBuildings
                buildingId={buildingId}
                zipCode={building.zip_code}
                borough={building.borough}
                city={city}
              />
            </div>
          </Suspense>
        )}

        {/* FAQ — streams independently, no longer blocks TTFB */}
        <Suspense fallback={null}>
          <DeferredBuildingFAQ
            building={building}
            buildingId={buildingId}
            city={city}
            rents={rents}
            neighborhoodRents={neighborhoodRents}
          />
        </Suspense>
      </div>
    </div>
    </AdSidebar>
  );
}
