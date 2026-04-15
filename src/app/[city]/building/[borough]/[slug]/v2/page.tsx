import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { regionFromSlug, regionSlug, buildingUrl, canonicalUrl } from "@/lib/seo";
import { VALID_CITIES, CITY_META, type City } from "@/lib/cities";
import { cache } from "react";
import type { Building } from "@/types";
import { loadBuildingV2Data, scoreToGrade } from "./_data";
import { NavV2 } from "@/components/building/v2/NavV2";
import { WayfinderRail } from "@/components/building/v2/WayfinderRail";
import { HeroV2 } from "@/components/building/v2/HeroV2";
import { RecordStrip } from "@/components/building/v2/RecordStrip";
import { S01_RentalIntelligence } from "@/components/building/v2/sections/S01_RentalIntelligence";
import { S02_Issues } from "@/components/building/v2/sections/S02_Issues";
import { S03_TenantReviews } from "@/components/building/v2/sections/S03_TenantReviews";
import { S04_Amenities } from "@/components/building/v2/sections/S04_Amenities";
import { S05_Landlord } from "@/components/building/v2/sections/S05_Landlord";
import { S06_Location } from "@/components/building/v2/sections/S06_Location";
import { S07_History } from "@/components/building/v2/sections/S07_History";
import { S08_SimilarNearby } from "@/components/building/v2/sections/S08_SimilarNearby";
import { S09_FAQ } from "@/components/building/v2/sections/S09_FAQ";
import { RailContainer } from "@/components/building/v2/rail/RailContainer";
import { R01_RentComparison } from "@/components/building/v2/rail/R01_RentComparison";
import { R02_ReviewSummary } from "@/components/building/v2/rail/R02_ReviewSummary";
import { R03_EnergyScore } from "@/components/building/v2/rail/R03_EnergyScore";
import { R04_WalkTransit } from "@/components/building/v2/rail/R04_WalkTransit";
import { R05_NearbyTransit } from "@/components/building/v2/rail/R05_NearbyTransit";
import { R06_NearbySchools } from "@/components/building/v2/rail/R06_NearbySchools";
import { R07_NearbyRecreation } from "@/components/building/v2/rail/R07_NearbyRecreation";
import { R08_SafetyCrime } from "@/components/building/v2/rail/R08_SafetyCrime";
import { R09_AtAGlance } from "@/components/building/v2/rail/R09_AtAGlance";
import { R10_SimilarBuildingsRail } from "@/components/building/v2/rail/R10_SimilarBuildingsRail";

export const revalidate = 86400;

interface Props {
  params: Promise<{ city: string; borough: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, borough, slug } = await params;
  const building = await getBuilding(borough, slug, city);
  if (!building) {
    return {
      title: "Building · v2 preview",
      robots: { index: false, follow: false },
    };
  }
  const productionPath = buildingUrl(
    { borough: building.borough, slug: building.slug },
    city as City
  );
  return {
    title: `${building.full_address} · v2 preview`,
    description: `Preview of redesigned building page for ${building.full_address}.`,
    robots: { index: false, follow: false },
    alternates: { canonical: canonicalUrl(productionPath) },
  };
}

const getBuilding = cache(async (boroughSlug: string, slug: string, metro: string) => {
  const city = metro as City;
  const borough = regionFromSlug(boroughSlug, city);
  const supabase = await createClient();
  const { data } = await supabase
    .from("buildings")
    .select("*")
    .eq("slug", slug)
    .eq("borough", borough)
    .eq("metro", metro)
    .limit(1);
  return (data?.[0] as Building) ?? null;
});

export default async function BuildingV2Page({ params }: Props) {
  const { city, borough, slug } = await params;
  if (!VALID_CITIES.includes(city as City)) notFound();
  const building = await getBuilding(borough, slug, city);
  if (!building) notFound();

  const data = await loadBuildingV2Data(building);

  const typedCity = city as City;
  const cityPrefix = CITY_META[typedCity].urlPrefix;
  const grade = scoreToGrade(building.overall_score);
  const reviewsUrl = `/${cityPrefix}/building/${regionSlug(building.borough)}/${building.slug}/review`;

  // Compute HPD, eviction, complaints counts from data bag
  const hpdCount = data.issues.trends.reduce((sum, t) => sum + (t.hpd ?? 0), 0)
    + data.issues.hpdTop.reduce((sum, t) => sum + (t.count ?? 0), 0);
  // Use building.violation_count which is the full HPD tally if trends is sparse
  const hpdDisplayCount = building.violation_count ?? hpdCount;
  const evictionCount = building.eviction_count ?? data.issues.trends.reduce((sum, t) => sum + (t.evictions ?? 0), 0);
  const complaintsCount = building.complaint_count ?? data.issues.trends.reduce((sum, t) => sum + (t.complaints ?? 0), 0);

  return (
    <>
      {/* Skip to main content (a11y) */}
      <a
        href="#main-content"
        style={{
          position: "absolute",
          left: "-9999px",
          top: 8,
          zIndex: 200,
          padding: "8px 16px",
          background: "var(--v2-brand)",
          color: "#fff",
          fontFamily: "var(--v2-sans)",
          fontSize: 14,
          fontWeight: 600,
          borderRadius: "var(--v2-radius-sm)",
          textDecoration: "none",
        }}
        onFocus={(e) => (e.currentTarget.style.left = "8px")}
        onBlur={(e) => (e.currentTarget.style.left = "-9999px")}
      >
        Skip to main content
      </a>

      {/* NavV2 */}
      <NavV2 city={typedCity} />

      {/* Page-level grid: wayfinder | main content | right rail.
          Breakpoints are managed in src/styles/v2-tokens.css (.v2-page-grid) */}

      <div className="v2-page-grid">
        {/* Wayfinder rail (sticky left) */}
        <WayfinderRail
          grade={grade}
          rating={data.reviews.avgRating}
          buildingName={building.full_address}
          reviewsUrl={reviewsUrl}
        />

        {/* Main content column */}
        <main id="main-content" style={{ minWidth: 0 }}>
          {/* HeroV2 */}
          <HeroV2
            building={building}
            rents={data.rents}
            reviews={data.reviews}
            landlord={data.landlord}
            city={typedCity}
            cityPrefix={cityPrefix}
            borough={building.borough}
            slug={building.slug}
            grade={grade}
          />

          {/* RecordStrip */}
          <RecordStrip
            building={building}
            reviews={data.reviews}
            hpdCount={hpdDisplayCount}
            evictionCount={evictionCount}
            complaintsCount={complaintsCount}
          />

          {/* Phase 2A — main content sections */}
          <S01_RentalIntelligence
            rents={data.rents}
            neighborhoodName={building.borough ?? "your neighborhood"}
            zipCode={building.zip_code ?? null}
          />

          <S02_Issues
            issues={data.issues}
            buildingName={building.full_address}
          />

          <S03_TenantReviews
            reviews={data.reviews}
            reviewsUrl={`/${cityPrefix}/building/${regionSlug(building.borough)}/${building.slug}/reviews`}
          />

          {/* Phase 2B — amenities, landlord, location */}
          <S04_Amenities amenities={data.amenities} />

          <S05_Landlord
            landlord={data.landlord}
            city={typedCity}
            currentBuildingSlug={slug}
            currentBuildingBorough={building.borough}
          />

          <S06_Location building={building} city={typedCity} />

          {/* Phase 2C — history, similar, FAQ */}
          <S07_History
            timeline={data.timeline}
            building={building}
            city={typedCity}
          />

          <S08_SimilarNearby
            similar={data.similar}
            city={typedCity}
          />

          <S09_FAQ
            building={building}
            data={data}
          />
        </main>

        {/* Phase 3 — right rail */}
        <RailContainer>
          <R01_RentComparison rents={data.rents} buildingName={building.full_address} />
          <R02_ReviewSummary reviews={data.reviews} />
          <R03_EnergyScore energy={data.energy} city={typedCity} />
          <R04_WalkTransit building={building} />
          <R05_NearbyTransit building={building} />
          <R06_NearbySchools building={building} />
          <R07_NearbyRecreation building={building} />
          <R08_SafetyCrime building={building} />
          <R09_AtAGlance building={building} />
          <R10_SimilarBuildingsRail similar={data.similar} city={typedCity} />
        </RailContainer>
      </div>
    </>
  );
}
