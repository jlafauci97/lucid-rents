import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { regionFromSlug, buildingUrl, canonicalUrl, buildingJsonLd, breadcrumbJsonLd, cityPath } from "@/lib/seo";
import { VALID_CITIES, CITY_META, type City } from "@/lib/cities";
import { cache } from "react";
import { normalizeScore } from "@/lib/constants";
import type { Building } from "@/types";
import { loadBuildingV2Data, scoreToGrade } from "./_data";
import { JsonLd } from "@/components/seo/JsonLd";
import { TrackBuildingView } from "@/components/building/TrackBuildingView";
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

export const revalidate = 86400; // 24h ISR

interface Props {
  params: Promise<{ city: string; borough: string; slug: string }>;
}

// ── Data fetching ──────────────────────────────────────────────

const getBuilding = cache(async (boroughSlug: string, slug: string, metro: string) => {
  const city = (metro || "nyc") as City;
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

function metroToCity(metro: string | null): City {
  if (metro && VALID_CITIES.includes(metro as City)) return metro as City;
  return "nyc";
}

/**
 * Extract candidate short slugs from a long-format slug with city/state/zip suffix.
 * e.g. "7438-n-fallbrook-ave-los-angeles-ca-91307" -> ["7438-n-fallbrook-ave-los-angeles", "7438-n-fallbrook-ave"]
 */
function slugCandidates(slug: string): string[] {
  const base = slug.replace(/-[a-z]{2}-\d{5}$/, "");
  if (base === slug) return [];
  const candidates: string[] = [];
  let s = base;
  while (s.includes("-")) {
    s = s.slice(0, s.lastIndexOf("-"));
    if (s.length > 3) candidates.push(s);
  }
  return candidates;
}

const findBuildingAnywhere = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("buildings")
    .select("borough, slug, metro")
    .eq("slug", slug)
    .limit(1);
  if (data?.[0]) return data[0];

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

// ── SEO metadata ───────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: cityParam, borough, slug } = await params;
  const building = await getBuilding(borough, slug, cityParam);

  if (!building) {
    const match = await findBuildingAnywhere(slug);
    if (match) {
      const correctCity = metroToCity(match.metro);
      const url = canonicalUrl(buildingUrl(match, correctCity));
      return { title: "Redirecting\u2026", alternates: { canonical: url } };
    }
    return { title: "Building Not Found" };
  }

  const title =
    building.review_count > 0 && building.overall_score != null
      ? `${building.full_address} \u2014 Rated ${normalizeScore(building.overall_score).toFixed(1)}/5 by Tenants`
      : `${building.full_address} \u2014 Violations, Reviews & Building Score`;

  const isAltMetro = cityParam === "chicago" || cityParam === "miami" || cityParam === "houston";
  const metaViolationCount = isAltMetro
    ? (building.dob_violation_count || 0)
    : (building.violation_count || 0);

  const descParts = [
    `${metaViolationCount} violations`,
    `${building.complaint_count} complaints`,
  ];
  if (building.bedbug_report_count > 0) descParts.push(`${building.bedbug_report_count} bedbug reports`);
  if (building.eviction_count > 0) descParts.push(`${building.eviction_count} evictions`);

  const laExtras: string[] = [];
  if (cityParam === "los-angeles") {
    if (building.is_rent_stabilized) laExtras.push("RSO protected");
    if (building.fire_hazard_zone) laExtras.push(`${building.fire_hazard_zone} fire zone`);
    if (building.ellis_act_filing) laExtras.push("Ellis Act history");
  }
  const laExtraStr = laExtras.length > 0 ? ` ${laExtras.join(", ")}.` : "";
  const description = `${building.full_address} has ${descParts.join(" and ")}.${laExtraStr} Read tenant reviews, check bedbug history, and see the building score \u2014 free.`;
  const url = canonicalUrl(buildingUrl(building, cityParam as City));

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

// ── Page component ─────────────────────────────────────────────

export default async function BuildingPage({ params }: Props) {
  const { city: cityParam, borough, slug } = await params;
  if (!VALID_CITIES.includes(cityParam as City)) notFound();
  const typedCity = cityParam as City;

  let building = await getBuilding(borough, slug, typedCity);

  if (!building) {
    const match = await findBuildingAnywhere(slug);
    if (match) {
      const correctCity = metroToCity(match.metro);
      redirect(buildingUrl(match, correctCity));
    }
    notFound();
  }

  // Redirect to correct city if metro doesn't match URL
  const buildingCity = metroToCity(building.metro);
  if (buildingCity !== typedCity) {
    redirect(buildingUrl(building, buildingCity));
  }

  const data = await loadBuildingV2Data(building);
  const addressFirstLine = building.full_address.split(",")[0] ?? building.full_address;
  const cityPrefix = CITY_META[typedCity]?.urlPrefix ?? "nyc";
  const shortAddress = addressFirstLine.trim() || building.full_address;

  // Grade for wayfinder header
  const grade = scoreToGrade(building.overall_score);

  return (
    <>
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
        { name: "Buildings", url: cityPath("/buildings", typedCity) },
        { name: building.borough, url: cityPath(`/buildings/${borough}`, typedCity) },
        { name: shortAddress, url: buildingUrl(building, typedCity) },
      ])} />

      <div className="v2" style={{ zoom: 0.8 }}>
        <a href="#main-content" className="v2-skip-link">Skip to main content</a>

        <main className="container">
          <Crumbs
            city={typedCity}
            boroughSlug={borough}
            boroughName={building.borough}
            neighborhoodSlug={null}
            neighborhoodName={null}
            addressLabel={addressFirstLine}
          />

          <HeroV2
            building={building}
            rents={data.rents}
            reviews={data.reviews}
            landlord={data.landlord}
            city={typedCity}
          />

          <RecordStrip building={building} reviews={data.reviews} />

          <div className="body">
            <WayfinderRail grade={grade} buildingName={addressFirstLine} city={typedCity} buildingPath={`/${cityPrefix}/building/${borough}/${slug}`} />

            <div className="main" id="main-content">
              <S01_RentalIntelligence
                rents={data.rents}
                neighborhoodName={building.borough}
                isRentStabilized={building.is_rent_stabilized}
              />
              <S02_Issues
                issues={data.issues}
                hpdViolations={data.issues.hpdViolations}
                buildingId={building.id}
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
              <S06_Location building={building} city={typedCity} nearby={data.nearby} neighborhoodStats={data.neighborhoodStats} />
              <S07_History building={building} landlord={data.landlord} />
              <S08_SimilarNearby similar={data.similar} city={typedCity} />
              <S09_FAQ building={building} data={data} />
            </div>

            <SideRail building={building} data={data} city={typedCity} cityPrefix={cityPrefix} />
          </div>
        </main>
      </div>
    </>
  );
}
