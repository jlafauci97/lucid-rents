import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { regionFromSlug, buildingUrl, canonicalUrl, buildingJsonLd, breadcrumbJsonLd, cityPath } from "@/lib/seo";
import { VALID_CITIES, CITY_META, type City } from "@/lib/cities";
import { cache } from "react";
import { normalizeScore } from "@/lib/constants";
import { buildBuildingTitle, buildBuildingDescription } from "@/lib/seo-metadata";
import { buildingNeighborhood } from "@/lib/neighborhoods";
import type { Building } from "@/types";
import { scoreToGrade } from "./_data";
import { JsonLd } from "@/components/seo/JsonLd";
import { TrackBuildingView } from "@/components/building/TrackBuildingView";
import { Crumbs } from "@/components/building/v2/Crumbs";
import { V2Zoom } from "@/components/building/v2/V2Zoom";
import { WayfinderRail } from "@/components/building/v2/WayfinderRail";
import { S10_NYCInsights } from "@/components/building/v2/sections/S10_NYCInsights";
// Streaming wrappers — each fetches its own slice of data inside a Suspense
// boundary so the hero paints first and every section streams in independently.
import { HeroV2Streamed } from "@/components/building/v2/streaming/HeroV2Streamed";
import { RecordStripStreamed } from "@/components/building/v2/streaming/RecordStripStreamed";
import { S01RentalIntelligenceStreamed } from "@/components/building/v2/streaming/S01RentalIntelligenceStreamed";
import { S02IssuesStreamed } from "@/components/building/v2/streaming/S02IssuesStreamed";
import { S03TenantReviewsStreamed } from "@/components/building/v2/streaming/S03TenantReviewsStreamed";
import { S04AmenitiesStreamed } from "@/components/building/v2/streaming/S04AmenitiesStreamed";
import { S05LandlordStreamed } from "@/components/building/v2/streaming/S05LandlordStreamed";
import { S06LocationStreamed } from "@/components/building/v2/streaming/S06LocationStreamed";
import { S07HistoryStreamed } from "@/components/building/v2/streaming/S07HistoryStreamed";
import { S08SimilarNearbyStreamed } from "@/components/building/v2/streaming/S08SimilarNearbyStreamed";
import { S09FAQStreamed } from "@/components/building/v2/streaming/S09FAQStreamed";
import { S10LAInsightsStreamed } from "@/components/building/v2/streaming/S10LAInsightsStreamed";
import { S10ChicagoInsightsStreamed } from "@/components/building/v2/streaming/S10ChicagoInsightsStreamed";
import { S10MiamiInsightsStreamed } from "@/components/building/v2/streaming/S10MiamiInsightsStreamed";
import { S10HoustonInsightsStreamed } from "@/components/building/v2/streaming/S10HoustonInsightsStreamed";
import { SideRailStreamed } from "@/components/building/v2/streaming/SideRailStreamed";
import { LazyOnScroll } from "@/components/building/v2/streaming/LazyOnScroll";
import { SectionSkeleton } from "@/components/building/v2/streaming/SectionSkeleton";

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

  const addressFirstLine = building.full_address.split(",")[0]?.trim() ?? building.full_address;
  const shortAddress = addressFirstLine || building.full_address;

  const { name: neighborhoodName } = buildingNeighborhood(
    { zip_code: building.zip_code, borough: building.borough },
    cityParam as City
  );

  const isAltMetro = cityParam === "chicago" || cityParam === "miami" || cityParam === "houston";
  const metaViolationCount = isAltMetro
    ? (building.dob_violation_count || 0)
    : (building.violation_count || 0);
  const issuesFiled = metaViolationCount + (building.complaint_count || 0);

  const title = buildBuildingTitle({
    shortAddress,
    neighborhood: neighborhoodName,
    city: cityParam as City,
  });

  const description = buildBuildingDescription({
    shortAddress,
    neighborhood: neighborhoodName,
    issues: issuesFiled,
    reviewCount: building.review_count,
    overallScore:
      building.overall_score != null
        ? Number(normalizeScore(building.overall_score).toFixed(1))
        : null,
  });
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

  const building = await getBuilding(borough, slug, typedCity);

  if (!building) {
    const match = await findBuildingAnywhere(slug);
    if (match) {
      const correctCity = metroToCity(match.metro);
      redirect(buildingUrl(match, correctCity));
    }
    // Next 16 page-level notFound() returns HTTP 200 (soft-404). Redirect
    // to the city's buildings directory so the response code is a real 307
    // that crawlers + monitoring treat as a real miss.
    redirect(cityPath("/buildings", typedCity));
  }

  // Redirect to correct city if metro doesn't match URL
  const buildingCity = metroToCity(building.metro);
  if (buildingCity !== typedCity) {
    redirect(buildingUrl(building, buildingCity));
  }

  // NOTE: we no longer `await loadBuildingV2Data(building)` here. Every section
  // below renders via a streaming wrapper that fetches its own slice inside a
  // Suspense boundary so the shell (nav + breadcrumbs + hero skeleton) paints
  // immediately and each card fills in as its query resolves.
  const addressFirstLine = building.full_address.split(",")[0] ?? building.full_address;
  const cityPrefix = CITY_META[typedCity]?.urlPrefix ?? "nyc";
  const shortAddress = addressFirstLine.trim() || building.full_address;

  // Grade for wayfinder header — overall_score is already on the building row.
  const grade = scoreToGrade(building.overall_score);
  const seeAllIssuesUrl = `/${cityPrefix}/building/${borough}/${slug}/violations`;
  const seeAllReviewsUrl = `/${cityPrefix}/building/${borough}/${slug}/reviews`;

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

      <div className="v2">
        <V2Zoom />
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

          <HeroV2Streamed building={building} city={typedCity} />

          <RecordStripStreamed building={building} />

          <div className="body">
            <WayfinderRail
              grade={grade}
              buildingName={addressFirstLine}
              city={typedCity}
              buildingPath={`/${cityPrefix}/building/${borough}/${slug}`}
              buildingId={building.id}
            />

            <div className="main" id="main-content">
              <S01RentalIntelligenceStreamed building={building} />
              <S02IssuesStreamed building={building} seeAllUrl={seeAllIssuesUrl} />
              <S03TenantReviewsStreamed building={building} seeAllUrl={seeAllReviewsUrl} />
              <S04AmenitiesStreamed building={building} />
              <S05LandlordStreamed building={building} city={typedCity} />
              <S06LocationStreamed building={building} city={typedCity} />
              <S07HistoryStreamed building={building} />
              <LazyOnScroll fallback={<SectionSkeleton num="09 / 09" title="Frequently asked questions." id="faq" />}>
                <S09FAQStreamed building={building} />
              </LazyOnScroll>
              {typedCity === "los-angeles" && (
                <LazyOnScroll fallback={<SectionSkeleton num="10 / 10" title="LA-specific insights." id="la-insights" />}>
                  <S10LAInsightsStreamed building={building} />
                </LazyOnScroll>
              )}
              {typedCity === "chicago" && (
                <LazyOnScroll fallback={<SectionSkeleton num="10 / 10" title="Chicago-specific insights." id="chicago-insights" />}>
                  <S10ChicagoInsightsStreamed building={building} />
                </LazyOnScroll>
              )}
              {typedCity === "miami" && (
                <LazyOnScroll fallback={<SectionSkeleton num="10 / 10" title="Miami-specific insights." id="miami-insights" />}>
                  <S10MiamiInsightsStreamed building={building} />
                </LazyOnScroll>
              )}
              {typedCity === "houston" && (
                <LazyOnScroll fallback={<SectionSkeleton num="10 / 10" title="Houston-specific insights." id="houston-insights" />}>
                  <S10HoustonInsightsStreamed building={building} />
                </LazyOnScroll>
              )}
              {typedCity === "nyc" && <S10_NYCInsights building={building} />}
            </div>

            <SideRailStreamed building={building} city={typedCity} cityPrefix={cityPrefix} />
          </div>

          {/* Similar Buildings — rendered AFTER both .main and .sr so it sits at
              the very bottom of the page on mobile (after sidebar cards reflow
              below main) and stays at the bottom of desktop too. Wrapped in
              LazyOnScroll since it's always below the fold. */}
          <div className="similar-bottom" style={{ marginTop: 24 }}>
            <LazyOnScroll fallback={<SectionSkeleton num="08 / 09" title="Similar buildings nearby." id="similar" />}>
              <S08SimilarNearbyStreamed building={building} city={typedCity} />
            </LazyOnScroll>
          </div>
        </main>
      </div>
    </>
  );
}
