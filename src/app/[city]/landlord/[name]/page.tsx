import "@/styles/v2-tokens.css";
import { createCacheClient } from "@/lib/supabase/cache-client";
import { notFound, permanentRedirect } from "next/navigation";
import { Crumbs } from "@/components/landlord/v2/Crumbs";
import { HeroV2Streamed } from "@/components/landlord/v2/streaming/HeroV2Streamed";
import { RecordStripStreamed } from "@/components/landlord/v2/streaming/RecordStripStreamed";
import { WayfinderRail } from "@/components/landlord/v2/WayfinderRail";
import { S01GlanceStreamed } from "@/components/landlord/v2/streaming/S01GlanceStreamed";
import { S02TrendStreamed } from "@/components/landlord/v2/streaming/S02TrendStreamed";
import { S03CaseFileStreamed } from "@/components/landlord/v2/streaming/S03CaseFileStreamed";
import { S04BuildingsStreamed } from "@/components/landlord/v2/streaming/S04BuildingsStreamed";
import { S05OwnershipStreamed } from "@/components/landlord/v2/streaming/S05OwnershipStreamed";
import { S06TenantVoiceStreamed } from "@/components/landlord/v2/streaming/S06TenantVoiceStreamed";
import { S07WhereStreamed } from "@/components/landlord/v2/streaming/S07WhereStreamed";
import { S08CompareStreamed } from "@/components/landlord/v2/streaming/S08CompareStreamed";
import { S09FAQStreamed } from "@/components/landlord/v2/streaming/S09FAQStreamed";
import { S10CityInsightsStreamed } from "@/components/landlord/v2/streaming/S10CityInsightsStreamed";
import { normalizeScore } from "@/lib/constants";
import { V2Zoom } from "@/components/building/v2/V2Zoom";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  landlordSlug,
  landlordUrl,
  landlordJsonLd,
  faqJsonLd,
  breadcrumbJsonLd,
  canonicalUrl,
  cityPath,
} from "@/lib/seo";
import type { Metadata } from "next";
import { CITY_META } from "@/lib/cities";
import type { City } from "@/lib/cities";
import { buildLandlordDescription } from "@/lib/seo-metadata";
import { pickLandlordTitle } from "@/lib/seo-titles";
import { getLandlordTitleData } from "@/lib/seo-title-data";
import { getLandlordStats } from "@/lib/landlord-stats";
import {
  loadLandlordNeighborhoods,
  loadLandlordTenantVoice,
  loadLandlordFAQ,
} from "./_data";
import { LandlordNeighborhoods } from "@/components/landlord/LandlordNeighborhoods";
import { LandlordLeadParagraph } from "@/components/landlord/LandlordLeadParagraph";
import { InContentAd } from "@/components/ads/InContentAd";
import { FloatingAdRail } from "@/components/ads/FloatingAdRail";

export const revalidate = 86400; // 24h ISR — matches building v2

// Enable on-demand ISR for unbounded dynamic params. Without this Next.js 16
// treats the route as fully dynamic and ignores `revalidate`.
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

// Coarse landlord letter grade used by the wayfinder rail. Full scoring
// and grade breakdown live in HeroV2.
function letterGrade(score: number | null): string {
  if (score === null) return "—";
  const s = normalizeScore(score);
  if (s >= 4.5) return "A";
  if (s >= 4.0) return "A-";
  if (s >= 3.65) return "B+";
  if (s >= 3.3) return "B";
  if (s >= 3.0) return "B-";
  if (s >= 2.65) return "C+";
  if (s >= 2.3) return "C";
  if (s >= 2.0) return "C-";
  if (s >= 1.0) return "D";
  return "F";
}

interface LandlordPageProps {
  params: Promise<{ city: string; name: string }>;
}

// Resolve the canonical owner_name for a slug. Returns `null` if the slug has
// no landlord record in this metro. Also handles the legacy "decoded name" URL.
async function resolveOwnerName(
  supabase: ReturnType<typeof createCacheClient>,
  slugOrName: string,
  city: City
): Promise<string | null> {
  const { data: statsRows } = await supabase
    .from("landlord_stats")
    .select("name")
    .eq("slug", slugOrName)
    .eq("metro", city)
    .limit(1);

  if (statsRows?.[0]?.name) return statsRows[0].name;

  // Legacy fallback: old URLs had the owner name URL-encoded directly.
  const decoded = decodeURIComponent(slugOrName);
  const { data: byName } = await supabase
    .from("buildings")
    .select("owner_name")
    .ilike("owner_name", decoded)
    .eq("metro", city)
    .limit(1);

  return byName?.[0]?.owner_name ?? null;
}

export async function generateMetadata({
  params,
}: LandlordPageProps): Promise<Metadata> {
  const { city: cityParam, name } = await params;
  const city = (cityParam || "nyc") as City;
  const [stats, tenantVoice] = await Promise.all([
    getLandlordStats(name, city),
    loadLandlordTenantVoice(name, city),
  ]);

  // Treat zero-building stats rows the same as missing — these are junk
  // rows and we redirect the page render below; the metadata must agree
  // so we don't end up with HTTP 200 + "Not Found" title (soft-404).
  if (!stats || stats.buildingCount === 0) {
    return { title: "Landlord Not Found", robots: { index: false, follow: false } };
  }

  // Title cascade — picks the strongest defensible template based on data.
  const titleData = await getLandlordTitleData(stats, city, {
    avgRating: tenantVoice?.avgRating ?? 0,
    totalReviews: tenantVoice?.totalReviews ?? 0,
  });
  const { title } = pickLandlordTitle(titleData);

  const description = buildLandlordDescription({
    name: stats.name,
    buildingCount: stats.buildingCount,
    totalIssues: stats.totalIssues,
    city,
  });

  const url = canonicalUrl(landlordUrl(stats.name, city));

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
    },
  };
}

export default async function LandlordDetailPage({
  params,
}: LandlordPageProps) {
  const { city: cityParam, name } = await params;
  const city = (cityParam || "nyc") as City;
  const supabase = createCacheClient();

  const [ownerName, cachedStats, neighborhoods, tenantVoice, faqItems] =
    await Promise.all([
      resolveOwnerName(supabase, name, city),
      getLandlordStats(name, city),
      loadLandlordNeighborhoods(name, city),
      loadLandlordTenantVoice(name, city),
      loadLandlordFAQ(name, city),
    ]);

  // No matching landlord, or a junk stats row with no buildings to render —
  // surface the not-found UI from src/app/not-found.tsx. We tried `redirect()`
  // here originally but Next 16 / Vercel silently swallow the redirect signal
  // for streamed pages with revalidate set, returning HTTP 200 + an empty
  // body. notFound() also returns HTTP 200 in Next 16 (soft-404) but at least
  // renders meaningful content for users instead of a blank page.
  // The buildingCount === 0 guard catches stale sitemap slugs and cross-metro
  // mismatches (e.g. an LA landlord slug requested under /nyc/).
  if (!ownerName || !cachedStats || cachedStats.buildingCount === 0) {
    notFound();
  }

  // Canonicalise to the slug URL when the caller used a decoded owner name.
  const correctSlug = landlordSlug(ownerName);
  if (correctSlug !== name) {
    permanentRedirect(cityPath(`/landlord/${correctSlug}`, city));
  }

  const displayName = cachedStats.name;
  const grade = letterGrade(cachedStats.avgScore);

  const ratingForJsonLd =
    cachedStats.avgScore != null && tenantVoice.totalReviews > 0
      ? {
          lucidIqScore: cachedStats.avgScore,
          reviewCount: tenantVoice.totalReviews,
          excerpts: tenantVoice.excerpts,
        }
      : null;

  return (
    <div className="v2">
      <V2Zoom />
      <JsonLd
        data={landlordJsonLd(
          displayName,
          cachedStats.buildingCount,
          city,
          undefined,
          cachedStats.totalIssues,
          ratingForJsonLd
        )}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: "Landlords", url: cityPath("/landlords", city) },
          { name: displayName, url: landlordUrl(displayName, city) },
        ])}
      />
      {faqItems.length > 0 ? (
        <JsonLd data={faqJsonLd(faqItems)} />
      ) : null}

      <div className="container">
        <Crumbs city={city} displayName={displayName} />

        {/* ────────── Above-the-fold ────────── */}
        <HeroV2Streamed
          slug={correctSlug}
          city={city}
          displayName={displayName}
          fullCity={CITY_META[city].fullName}
        />

        {/* SEO/AI lead paragraph — rendered in the synchronous shell (not behind
            a Suspense boundary) so crawlers and LLMs read a data-grounded
            portfolio summary without consuming the streamed sections below.
            Mirrors BuildingLeadParagraph on the building page. */}
        <LandlordLeadParagraph
          stats={cachedStats}
          tenantVoice={tenantVoice}
          neighborhoods={neighborhoods}
          city={city}
        />

        <RecordStripStreamed slug={correctSlug} city={city} />

        {/* ────────── Body ────────── */}
        {/*
          Landlord v2 has only wayfinder + main (no right-hand side rail like
          building v2), so we override the 3-col `.body` grid to 2 columns
          here. An inline style is the simplest override that also respects
          the responsive 1-column collapse at ≤900px (handled by v2-tokens.css).
        */}
        <div className="body v2-landlord-body">
          <WayfinderRail
            grade={grade}
            displayName={displayName}
            city={city}
            slug={correctSlug}
          />

          <main id="main-content">
            <S01GlanceStreamed
              slug={correctSlug}
              city={city}
              avgScore={cachedStats.avgScore}
              buildingCount={cachedStats.buildingCount}
            />
            {/* AdSense — horizontal in-content ads mirror building page cadence:
                after section 1, then every 2 sections. */}
            <InContentAd />
            <S02TrendStreamed
              slug={correctSlug}
              city={city}
              buildingCount={cachedStats.buildingCount}
            />
            <S03CaseFileStreamed slug={correctSlug} city={city} />
            <InContentAd />
            <S04BuildingsStreamed slug={correctSlug} city={city} />
            <S05OwnershipStreamed
              slug={correctSlug}
              city={city}
              displayName={displayName}
              buildingCount={cachedStats.buildingCount}
            />
            <InContentAd />
            <S06TenantVoiceStreamed slug={correctSlug} city={city} />
            <S07WhereStreamed
              slug={correctSlug}
              city={city}
              buildingCount={cachedStats.buildingCount}
            />
            <InContentAd />
            <LandlordNeighborhoods city={city} neighborhoods={neighborhoods} />
            <S08CompareStreamed
              slug={correctSlug}
              city={city}
              currentAvgScore={cachedStats.avgScore}
            />
            <InContentAd />
            <S09FAQStreamed slug={correctSlug} city={city} />
            {/* Only NYC has a loaded insights payload in Phase 1. Skipping
                the streamed wrapper for the other metros avoids a Suspense
                skeleton flash before the inner resolves to null. */}
            {city === "nyc" ? (
              <S10CityInsightsStreamed slug={correctSlug} city={city} />
            ) : null}
          </main>
        </div>
      </div>
      {/* AdSense — landlord page's .v2-landlord-body grid is 2-col (no right
          rail like building page), so vertical ads use a fixed-position
          floating rail that fills the empty space beyond 1600px viewport. */}
      <FloatingAdRail count={3} />
    </div>
  );
}
