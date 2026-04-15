import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { regionFromSlug, regionSlug } from "@/lib/seo";
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

export const revalidate = 86400;

interface Props {
  params: Promise<{ city: string; borough: string; slug: string }>;
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
      {/* NavV2 */}
      <NavV2 city={typedCity} />

      {/* Page-level grid: wayfinder | main content */}
      <style>{`
        .v2-page-grid {
          max-width: 1440px;
          margin: 0 auto;
          padding: 32px 24px;
          display: grid;
          grid-template-columns: 220px 1fr;
          gap: 24px;
          align-items: start;
        }
        @media (max-width: 899px) {
          .v2-page-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="v2-page-grid">
        {/* Wayfinder rail (sticky left) */}
        <WayfinderRail
          grade={grade}
          rating={data.reviews.avgRating}
          buildingName={building.full_address}
          reviewsUrl={reviewsUrl}
        />

        {/* Main content column */}
        <main style={{ minWidth: 0 }}>
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

          {/* Phase 3+ placeholders */}
          <div id="history" />
          <div id="similar" />
          <div id="faq" />
        </main>
      </div>
    </>
  );
}
