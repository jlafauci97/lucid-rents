/**
 * Building V2 page — skeleton that matches the mockup structure.
 *
 * Mockup reference: public/mockups/building-v1.html
 *
 * Structure being built out section by section (verbatim ports):
 *   <nav class="nav">              ← NavV2            ✅ done
 *   <main class="container">
 *     <nav class="crumbs">         ← Crumbs           ✅ done
 *     <section class="hero">       ← Hero             ⏳ TODO
 *     <section class="record">     ← RecordStrip      ⏳ TODO
 *     <div class="layout">
 *       <aside class="wayfinder">  ← WayfinderRail    ⏳ TODO
 *       <main class="main">
 *         9 sections               ← S01–S09          ⏳ TODO
 *       <aside class="sr">         ← Right rail       ⏳ TODO
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { regionFromSlug, buildingUrl, canonicalUrl } from "@/lib/seo";
import { VALID_CITIES, CITY_META, type City } from "@/lib/cities";
import { cache } from "react";
import type { Building } from "@/types";
import { loadBuildingV2Data } from "./_data";
import { NavV2 } from "@/components/building/v2/NavV2";
import { Crumbs } from "@/components/building/v2/Crumbs";
import { HeroV2 } from "@/components/building/v2/HeroV2";
import { RecordStrip } from "@/components/building/v2/RecordStrip";
import { WayfinderRail } from "@/components/building/v2/WayfinderRail";
import { SideRail } from "@/components/building/v2/SideRail";
import { S01_RentalIntelligence } from "@/components/building/v2/sections/S01_RentalIntelligence";
import { S02_Issues } from "@/components/building/v2/sections/S02_Issues";
import { S03_TenantReviews } from "@/components/building/v2/sections/S03_TenantReviews";
import { S04_Amenities } from "@/components/building/v2/sections/S04_Amenities";
import { S05_Landlord } from "@/components/building/v2/sections/S05_Landlord";
import { S06_Location } from "@/components/building/v2/sections/S06_Location";
import { S07_History } from "@/components/building/v2/sections/S07_History";
import { S08_SimilarNearby } from "@/components/building/v2/sections/S08_SimilarNearby";
import { S09_FAQ } from "@/components/building/v2/sections/S09_FAQ";

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, borough, slug } = await params;
  if (!VALID_CITIES.includes(city as City)) {
    return { title: "Building · v2 preview", robots: { index: false, follow: false } };
  }
  const building = await getBuilding(borough, slug, city);
  if (!building) {
    return { title: "Building · v2 preview", robots: { index: false, follow: false } };
  }
  const productionPath = buildingUrl({ borough: building.borough, slug: building.slug }, city as City);
  return {
    title: `${building.full_address} · v2 preview`,
    description: `Preview of redesigned building page for ${building.full_address}.`,
    robots: { index: false, follow: false },
    alternates: { canonical: canonicalUrl(productionPath) },
  };
}

export default async function BuildingV2Page({ params }: Props) {
  const { city, borough, slug } = await params;
  if (!VALID_CITIES.includes(city as City)) notFound();
  const typedCity = city as City;
  const building = await getBuilding(borough, slug, typedCity);
  if (!building) notFound();

  const data = await loadBuildingV2Data(building);
  const addressFirstLine = building.full_address.split(",")[0] ?? building.full_address;
  const cityPrefix = CITY_META[typedCity]?.urlPrefix ?? "nyc";

  // Grade for wayfinder header — derived from overall_score.
  const score = building.overall_score ?? 0;
  const grade = score >= 90 ? "A+" : score >= 85 ? "A" : score >= 80 ? "A-" : score >= 75 ? "B+" : score >= 70 ? "B" : score >= 65 ? "B-" : score >= 60 ? "C+" : score >= 55 ? "C" : score >= 50 ? "C-" : score >= 45 ? "D" : score > 0 ? "F" : "—";

  return (
    <>
      {/* Skip to main content (a11y) */}
      <a href="#main-content" className="v2-skip-link">Skip to main content</a>

      {/* ────── <nav class="nav"> ────── */}
      <NavV2 city={typedCity} />

      {/* ────── <main class="container"> ────── */}
      <main className="container">
        {/* ── <nav class="crumbs"> ── */}
        <Crumbs
          city={typedCity}
          boroughSlug={borough}
          boroughName={building.borough}
          neighborhoodSlug={null}
          neighborhoodName={null}
          addressLabel={addressFirstLine}
        />

        {/* ── <section class="hero"> ── */}
        <HeroV2
          building={building}
          rents={data.rents}
          reviews={data.reviews}
          landlord={data.landlord}
          city={typedCity}
        />

        {/* ── <section class="record"> ── */}
        <RecordStrip building={building} reviews={data.reviews} />

        {/* ── <div class="body">: wayfinder + main column + right rail ── */}
        <div className="body">
          <WayfinderRail grade={grade} buildingName={addressFirstLine} />

          <div className="main" id="main-content">
            <S01_RentalIntelligence
              rents={data.rents}
              neighborhoodName={building.borough}
              isRentStabilized={building.is_rent_stabilized}
            />
            <S02_Issues
              issues={data.issues}
              hpdCount={building.violation_count ?? 0}
              dobCount={building.dob_violation_count ?? 0}
              complaintsCount={building.complaint_count ?? 0}
              evictionsCount={building.eviction_count ?? 0}
              seeAllUrl={`/${cityPrefix}/building/${borough}/${slug}/violations`}
            />
            <S03_TenantReviews
              reviews={data.reviews}
              seeAllUrl={`/${cityPrefix}/building/${borough}/${slug}/reviews`}
            />
            <S04_Amenities amenities={data.amenities} />
            <S05_Landlord building={building} landlord={data.landlord} city={typedCity} />
            <S06_Location building={building} city={typedCity} nearby={data.nearby} />
            <S07_History timeline={data.timeline} building={building} />
            <S08_SimilarNearby similar={data.similar} city={typedCity} />
            <S09_FAQ building={building} data={data} />
          </div>

          {/* ── <aside class="sr">: right rail ── */}
          <SideRail building={building} data={data} city={typedCity} cityPrefix={cityPrefix} />
        </div>
      </main>
    </>
  );
}
