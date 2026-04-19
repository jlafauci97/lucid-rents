import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { BuildingHeader } from "@/components/building/BuildingHeader";
import { DeferredBuildingFAQ } from "@/components/building/DeferredBuildingFAQ";
import { DeferredVerdictSection } from "@/components/building/sections/DeferredVerdictSection";
import { DeferredRentIntelligenceSection } from "@/components/building/sections/DeferredRentIntelligenceSection";
import { DeferredIssuesSection } from "@/components/building/sections/DeferredIssuesSection";
import { DeferredReviewsSection } from "@/components/building/sections/DeferredReviewsSection";
import { DeferredRentListingsSection } from "@/components/building/sections/DeferredRentListingsSection";
import { DeferredMapSection } from "@/components/building/sections/DeferredMapSection";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { SectionNav } from "@/components/building/SectionNav";
import { NearbyCrimeSummary } from "@/components/crime/NearbyCrimeSummary";
import { NearbyTransit } from "@/components/transit/NearbyTransit";
import { WalkabilityScore } from "@/components/building/WalkabilityScore";
import { NearbySchools } from "@/components/schools/NearbySchools";
import { NearbyRecreation } from "@/components/building/NearbyRecreation";
import { NearbyEncampments } from "@/components/building/NearbyEncampments";
import { NearbyBuildings } from "@/components/building/NearbyBuildings";
import { SameLandlordBuildings } from "@/components/building/SameLandlordBuildings";
import { RentStabilizationCard } from "@/components/building/RentStabilizationCard";
import { RentComparison } from "@/components/building/RentComparison";
import { DeferredRentComparison } from "@/components/building/DeferredRentComparison";
import { EnergyScoreCard } from "@/components/building/EnergyScoreCard";
import { SeismicSafetyCard } from "@/components/building/SeismicSafetyCard";
import { HazardZonesCard } from "@/components/building/HazardZonesCard";
import { FloodRiskCard } from "@/components/building/FloodRiskCard";
import { ChicagoInfoCard } from "@/components/building/ChicagoInfoCard";
import { MiamiInfoCard } from "@/components/building/MiamiInfoCard";
import { HoustonInfoCard } from "@/components/building/HoustonInfoCard";
import { LAInfoCard } from "@/components/building/LAInfoCard";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { SLUG_TO_BOROUGH, regionFromSlug, buildingUrl, canonicalUrl, buildingJsonLd, breadcrumbJsonLd, landlordUrl, cityPath } from "@/lib/seo";
import { CITY_META, VALID_CITIES, type City } from "@/lib/cities";
import { TrackBuildingView } from "@/components/building/TrackBuildingView";
import { T } from "@/lib/design-tokens";
import { ShieldCheck, ShieldX } from "lucide-react";
import { cache } from "react";
import { normalizeScore } from "@/lib/constants";
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

/**
 * Extract candidate short slugs from a long-format slug with city/state/zip suffix.
 * e.g. "7438-n-fallbrook-ave-los-angeles-ca-91307" → ["7438-n-fallbrook-ave-los-angeles", "7438-n-fallbrook-ave"]
 */
function slugCandidates(slug: string): string[] {
  // Strip trailing state-zip (-xx-ddddd)
  const base = slug.replace(/-[a-z]{2}-\d{5}$/, "");
  if (base === slug) return []; // no suffix found
  // Try progressively shorter versions by removing trailing segments (city name)
  const candidates: string[] = [];
  let s = base;
  while (s.includes("-")) {
    s = s.slice(0, s.lastIndexOf("-"));
    if (s.length > 3) candidates.push(s);
  }
  return candidates;
}

/** Find a building by slug across all cities — used for cross-city redirects */
const findBuildingAnywhere = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("buildings")
    .select("borough, slug, metro")
    .eq("slug", slug)
    .limit(1);
  if (data?.[0]) return data[0];

  // Fallback: try stripping city/state/zip suffix from long-format slugs
  const candidates = slugCandidates(slug);
  for (const candidate of candidates) {
    const { data: fallback } = await supabase
      .from("buildings")
      .select("borough, slug, metro")
      .eq("slug", candidate)
      .limit(1);
    if (fallback?.[0]) return fallback[0];
  }

  return null;
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
      ? `${building.full_address} — Rated ${normalizeScore(building.overall_score).toFixed(1)}/5 by Tenants`
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
  // LA-specific SEO additions
  const laExtras: string[] = [];
  if (cityParam === "los-angeles") {
    if (building.is_rent_stabilized) laExtras.push("RSO protected");
    if (building.fire_hazard_zone) laExtras.push(`${building.fire_hazard_zone} fire zone`);
    if (building.ellis_act_filing) laExtras.push("Ellis Act history");
  }
  const laExtraStr = laExtras.length > 0 ? ` ${laExtras.join(", ")}.` : "";
  const description = `${building.full_address} has ${descParts.join(" and ")}.${laExtraStr} Read tenant reviews, check bedbug history, and see the building score — free.`;
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

// Lightweight skeleton for individual Suspense sections
function SectionSkeleton({ h = "h-48" }: { h?: string }) {
  return (
    <div className="animate-pulse">
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6">
        <div className="h-6 w-40 bg-[#e2e8f0] rounded mb-4" />
        <div className={`${h} bg-[#FAFBFD] rounded-lg`} />
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
    // Next 16 page-level notFound() returns HTTP 200 (soft-404). Redirect
    // to the city's buildings directory so the response code is a real 307
    // that crawlers + monitoring treat as a real miss.
    redirect(cityPath("/buildings", city));
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
  const isMiami = city === "miami";

  // Critical data only — just what's needed for above-the-fold content
  // NOTE: neighborhood median rents moved to DeferredRentComparison (Suspense boundary)
  // so it doesn't block the entire page render
  const [rents, energyData, deweyLatestRaw, deweyNeighborhoodLatestRaw] = await Promise.all([
    safe(supabase.from("building_rents").select("bedrooms, min_rent, max_rent, median_rent, listing_count, source").eq("building_id", buildingId), []),
    safe(supabase.from("energy_benchmarks").select("*").eq("building_id", buildingId).order("report_year", { ascending: false }).limit(1), [] as EnergyBenchmark[]),
    // Dewey: latest month building rents for above-the-fold badges
    safe(supabase.from("dewey_building_rents").select("month, beds, median_rent, avg_price_per_sqft, listing_count").eq("building_id", buildingId).order("month", { ascending: false }).limit(10), [] as { month: string; beds: number; median_rent: number; avg_price_per_sqft: number; listing_count: number }[]),
    // Dewey: latest month neighborhood rents for comparison
    building.zip_code
      ? safe(supabase.from("dewey_neighborhood_rents").select("month, beds, median_rent").eq("zip", building.zip_code).order("month", { ascending: false }).limit(10), [] as { month: string; beds: number; median_rent: number }[])
      : Promise.resolve([] as { month: string; beds: number; median_rent: number }[]),
  ]);

  // Top violation category / complaint type for header preview cards
  const categorizeViolation = (desc: string): string => {
    const d = desc.toUpperCase();
    if (/MICE|ROACH|INFESTATION|PEST|BED\s?BUG/.test(d)) return "Pest Infestation";
    if (/PAINT|PLASTER/.test(d)) return "Paint/Plaster";
    if (/LEAK|WATER\s+(LEAK|SUPPLY)/.test(d)) return "Water Leak";
    if (/WINDOW|GUARD/.test(d)) return "Window/Guard";
    if (/SMOKE|CARBON|DETECTOR/.test(d)) return "Smoke/CO Detector";
    if (/DOOR|LOCK/.test(d)) return "Door/Lock";
    if (/FLOOR|TILE/.test(d)) return "Flooring";
    if (/HEAT|HOT WATER|BOILER/.test(d)) return "Heat/Hot Water";
    if (/LEAD/.test(d)) return "Lead Paint";
    if (/ELECTRIC|OUTLET|WIRING/.test(d)) return "Electrical";
    if (/ROOF|CEILING/.test(d)) return "Roof/Ceiling";
    if (/MOLD|MILDEW/.test(d)) return "Mold/Mildew";
    if (/ELEVATOR/.test(d)) return "Elevator";
    if (/FIRE\s?ESCAPE|STAIR/.test(d)) return "Fire Escape/Stairs";
    return "Other";
  };
  const [recentViolations, recentComplaints] = await Promise.all([
    safe(supabase.from("hpd_violations").select("nov_description").eq("building_id", buildingId).not("nov_description", "is", null).order("inspection_date", { ascending: false }).limit(100), [] as { nov_description: string }[]),
    safe(supabase.from("complaints_311").select("complaint_type").eq("building_id", buildingId).not("complaint_type", "is", null).order("created_date", { ascending: false }).limit(100), [] as { complaint_type: string }[]),
  ]);
  const topViolationType = (() => {
    const c: Record<string, number> = {};
    for (const v of recentViolations) { const cat = categorizeViolation(v.nov_description); if (cat !== "Other") c[cat] = (c[cat] || 0) + 1; }
    return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0];
  })();
  const topComplaintType = (() => {
    const c: Record<string, number> = {};
    for (const v of recentComplaints) c[v.complaint_type] = (c[v.complaint_type] || 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0];
  })();

  // For non-NYC cities, violation_count may be 0 because it tracks HPD violations only.
  // Use dob_violation_count as the primary violation metric for Chicago.
  const effectiveViolationCount = (isChicago || isHouston)
    ? (building.dob_violation_count || 0)
    : (building.violation_count || 0);

  // City-specific data queries — only fetch for the relevant city
  const [
    chicagoDemolitions,
    chicagoLeadInspections,
    chicagoAffordableUnits,
    chicagoRodentComplaints,
    chicagoRltoViolations,
    chicagoEnergy,
    miamiRecerts,
    miamiUnsafeStructures,
    miamiStormDamage,
    miamiFloodClaims,
    houstonDangerous,
    houstonIndustrial,
    houstonTaxProtests,
    houstonAffordable,
    laRetrofit,
  ] = await Promise.all([
    isChicago ? safe(supabase.from("chicago_demolitions").select("id, permit_number, issue_date, status, work_description, contractor").eq("building_id", buildingId).order("issue_date", { ascending: false }).limit(5), []) : Promise.resolve([]),
    isChicago ? safe(supabase.from("chicago_lead_inspections").select("id, inspection_date, result, risk_level, hazard_type").eq("building_id", buildingId).order("inspection_date", { ascending: false }).limit(10), []) : Promise.resolve([]),
    isChicago ? safe(supabase.from("chicago_affordable_units").select("id, project_name, affordable_units, total_units, income_requirement, status").eq("building_id", buildingId).limit(5), []) : Promise.resolve([]),
    Promise.resolve([]), // rodent complaints already appear in 311 tab
    isChicago ? safe(supabase.from("chicago_rlto_violations").select("id, case_number, violation_date, violation_description, status").eq("building_id", buildingId).order("violation_date", { ascending: false }).limit(10), []) : Promise.resolve([]),
    isChicago ? safe(supabase.from("energy_benchmarks").select("energy_star_score, report_year, site_eui").eq("building_id", buildingId).order("report_year", { ascending: false }).limit(1), []) : Promise.resolve([]),
    isMiami ? safe(supabase.from("miami_forty_year_recerts").select("id, recertification_status, due_date, completion_date, engineer_name").eq("building_id", buildingId).limit(1), []) : Promise.resolve([]),
    isMiami ? safe(supabase.from("miami_unsafe_structures").select("id, case_number, violation_type, violation_description, case_date, status").eq("building_id", buildingId).order("case_date", { ascending: false }).limit(5), []) : Promise.resolve([]),
    isMiami ? safe(supabase.from("miami_storm_damage").select("id, disaster_name, disaster_date, damage_category, fema_verified_loss, flood_damage, wind_damage").eq("building_id", buildingId).order("disaster_date", { ascending: false }).limit(5), []) : Promise.resolve([]),
    isMiami ? safe(supabase.from("miami_flood_claims").select("id, claim_date, flood_zone, amount_paid, cause_of_damage").eq("building_id", buildingId).order("claim_date", { ascending: false }).limit(10), []) : Promise.resolve([]),
    isHouston ? safe(supabase.from("houston_dangerous_buildings").select("id, case_number, status, case_type, case_date, violation_description").eq("building_id", buildingId).order("case_date", { ascending: false }).limit(5), []) : Promise.resolve([]),
    isHouston ? safe(supabase.from("houston_industrial_proximity").select("id, facility_name, distance_miles, industry_type, total_releases_lbs, release_year, chemicals").eq("building_id", buildingId).order("distance_miles", { ascending: true }).limit(5), []) : Promise.resolve([]),
    isHouston ? safe(supabase.from("houston_tax_protests").select("id, protest_year, original_value, final_value, reduction_pct, outcome").eq("building_id", buildingId).order("protest_year", { ascending: false }).limit(10), []) : Promise.resolve([]),
    isHouston ? safe(supabase.from("houston_affordable_housing").select("id, project_name, affordable_units, total_units, income_requirement, program_type, status").eq("building_id", buildingId).limit(5), []) : Promise.resolve([]),
    isLA ? safe(supabase.from("la_earthquake_retrofit").select("id, retrofit_type, compliance_status, ordinance, deadline, completion_date").eq("building_id", buildingId).limit(1), []) : Promise.resolve([]),
  ]);

  // LA-specific: buyouts, SCEP inspections
  const [laBuyouts, laScep] = await Promise.all([
    isLA ? safe(supabase.from("lahd_tenant_buyouts").select("id, disclosure_date, compensation_amount").eq("building_id", buildingId).order("disclosure_date", { ascending: false }).limit(10), []) : Promise.resolve([]),
    isLA ? safe(supabase.from("lahd_scep_inspections").select("id, inspection_date, compliance_status, violations_found").eq("building_id", buildingId).order("inspection_date", { ascending: false }).limit(1), []) : Promise.resolve([]),
  ]);

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

      <BuildingHeader building={building} city={city} violationCount={effectiveViolationCount} valueGrade={deweyMetrics?.valueGrade} medianRent={(() => { if (deweyMetrics?.medianRent) return deweyMetrics.medianRent; const rows = (rents as { median_rent: number | null; listing_count: number | null }[]) || []; let total = 0, weight = 0; for (const r of rows) { if (r?.median_rent && r.median_rent > 0) { const w = r.listing_count && r.listing_count > 0 ? r.listing_count : 1; total += r.median_rent * w; weight += w; } } return weight > 0 ? Math.round(total / weight) : undefined; })()} pricePerSqft={deweyMetrics?.pricePerSqft} topViolationType={topViolationType} topComplaintType={topComplaintType} />

      <SectionNav />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 scroll-mt-28">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-12">
            {/* Each section streams independently via its own Suspense boundary */}
            <Suspense fallback={<SectionSkeleton h="h-48" />}>
              <DeferredVerdictSection building={building} buildingId={buildingId} />
            </Suspense>

            <Suspense fallback={<SectionSkeleton h="h-[300px]" />}>
              <DeferredRentIntelligenceSection building={building} buildingId={buildingId} city={city} />
            </Suspense>

            <Suspense fallback={<SectionSkeleton h="h-64" />}>
              <DeferredIssuesSection buildingId={buildingId} city={city} buildingHref={buildingUrl(building, city)} />
            </Suspense>

            <Suspense fallback={<SectionSkeleton h="h-48" />}>
              <DeferredReviewsSection building={building} buildingId={buildingId} city={city} />
            </Suspense>

            <Suspense fallback={<SectionSkeleton h="h-[200px]" />}>
              <DeferredRentListingsSection building={building} buildingId={buildingId} city={city} rents={rents} />
            </Suspense>

            <DeferredMapSection building={building} city={city} />
          </div>

          {/* Sidebar — static props render immediately, client components fetch independently */}
          <div className="space-y-6">
            {/* RSO Hero — LA's #1 searched topic */}
            {isLA && building.is_rent_stabilized && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-emerald-600" />
                  <span className="text-lg font-bold text-emerald-800">RSO Protected</span>
                </div>
                <p className="text-sm text-emerald-700">
                  This building is covered by LA&apos;s Rent Stabilization Ordinance.
                  Annual rent increases are capped at <strong>3%</strong> (effective Feb 2026).
                </p>
                {building.year_built && (
                  <p className="text-xs text-emerald-600">Built {building.year_built} — pre-Oct 1978 with 2+ units</p>
                )}
                <a href="https://housing.lacity.gov/rental-property-owners/rso-property-search" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-emerald-700 hover:text-emerald-900">
                  Verify on LAHD &rarr;
                </a>
              </div>
            )}
            {isLA && !building.is_rent_stabilized && building.year_built && building.year_built >= 1978 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldX className="w-5 h-5 text-amber-600" />
                  <span className="text-base font-bold text-amber-800">Not RSO Protected</span>
                </div>
                <p className="text-xs text-amber-700">
                  Built {building.year_built} — after Oct 1978 cutoff. Subject to AB 1482 caps (max 10% annual increase).
                </p>
              </div>
            )}

            {/* Building Info — hide if every field is empty */}
            {(building.owner_name || building.building_class || building.land_use ||
              building.residential_units != null || (building.commercial_units != null && building.commercial_units > 0) ||
              building.bbl || building.apn || building.pin) && (
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
            )}

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


            {/* Rent Comparison — streams independently so it doesn't block page render */}
            {building.zip_code && (
              <div id="rent-comparison">
                <Suspense fallback={<div className="bg-white rounded-xl border border-[#E2E8F0] p-6 animate-pulse h-48" />}>
                  <DeferredRentComparison
                    buildingRents={rents}
                    buildingId={buildingId}
                    zipCode={building.zip_code}
                    borough={building.borough}
                  />
                </Suspense>
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
                earthquakeRetrofit={laRetrofit[0] || null}
              />
            ) : isNYC ? (
              <SeismicSafetyCard
                isSoftStory={building.is_soft_story}
                softStoryStatus={building.soft_story_status}
              />
            ) : null}

            {/* FEMA Flood Risk (Miami + Houston) */}
            {(isMiami || isHouston) && building.latitude && building.longitude && (
              <FloodRiskCard
                latitude={building.latitude}
                longitude={building.longitude}
                fullAddress={building.full_address}
              />
            )}

            {/* Chicago Info */}
            {isChicago && (
              <ChicagoInfoCard
                isRltoProtected={building.is_rlto_protected}
                isScofflaw={building.is_scofflaw}
                ward={building.ward}
                communityArea={building.community_area}
                demolitions={chicagoDemolitions}
                leadInspections={chicagoLeadInspections}
                affordableUnits={chicagoAffordableUnits}
                rodentComplaints={chicagoRodentComplaints}
                rltoViolations={chicagoRltoViolations}
                energyRating={chicagoEnergy?.[0]?.energy_star_score}
                energyYear={chicagoEnergy?.[0]?.report_year}
                siteEui={chicagoEnergy?.[0]?.site_eui}
              />
            )}

            {/* Miami-Dade Info */}
            {isMiami && (
              <MiamiInfoCard
                fortyYearRecertStatus={building.forty_year_recert_status}
                fortyYearRecertDueDate={building.forty_year_recert_due_date}
                unsafeStructureCount={building.unsafe_structure_count}
                seaLevelRiskZone={building.sea_level_risk_zone}
                seaLevelRiskFeet={building.sea_level_risk_feet}
                recerts={miamiRecerts}
                unsafeStructures={miamiUnsafeStructures}
                stormDamage={miamiStormDamage}
                floodClaims={miamiFloodClaims}
              />
            )}

            {/* Houston Info */}
            {isHouston && (
              <HoustonInfoCard
                dangerousBuildings={houstonDangerous}
                industrialProximity={houstonIndustrial}
                taxProtests={houstonTaxProtests}
                affordableHousing={houstonAffordable}
              />
            )}

            {/* LA Housing Info */}
            {isLA && (
              <LAInfoCard
                ellisActFiling={building.ellis_act_filing ?? false}
                ellisActDate={building.ellis_act_date}
                buyoutCount={building.buyout_count ?? 0}
                buyoutTotalAmount={building.buyout_total_amount}
                buyouts={laBuyouts}
                scepLastInspection={laScep[0]?.inspection_date ?? null}
                scepComplianceStatus={laScep[0]?.compliance_status ?? null}
                parkingType={building.parking_type}
                parkingSpaces={building.parking_spaces}
                carDependencyScore={building.car_dependency_score}
                calenviroScreenPercentile={building.calenviroscreen_percentile}
                fireHazardZone={building.fire_hazard_zone}
                fairPlanRisk={building.fair_plan_risk ?? false}
                rentRegistryStatus={building.rent_registry_status}
              />
            )}

            {/* Walkability & Transit Score */}
            {building.latitude && building.longitude && (
              <div id="walkability" className="scroll-mt-28">
              <WalkabilityScore
                latitude={building.latitude}
                longitude={building.longitude}
                city={city}
              />
              </div>
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
            neighborhoodRents={[]}
          />
        </Suspense>
      </div>
    </div>
  );
}
