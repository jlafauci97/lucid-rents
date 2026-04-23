import { createClient } from "@/lib/supabase/server";
import { permanentRedirect, redirect } from "next/navigation";
import { Crumbs } from "@/components/landlord/v2/Crumbs";
import { HeroV2Streamed } from "@/components/landlord/v2/streaming/HeroV2Streamed";
import { RecordStripStreamed } from "@/components/landlord/v2/streaming/RecordStripStreamed";
import { WayfinderRail } from "@/components/landlord/v2/WayfinderRail";
import { S01GlanceStreamed } from "@/components/landlord/v2/streaming/S01GlanceStreamed";
import { S02TrendStreamed } from "@/components/landlord/v2/streaming/S02TrendStreamed";
import { S03CaseFileStreamed } from "@/components/landlord/v2/streaming/S03CaseFileStreamed";
import { S04BuildingsStreamed } from "@/components/landlord/v2/streaming/S04BuildingsStreamed";
import { S05OwnershipStreamed } from "@/components/landlord/v2/streaming/S05OwnershipStreamed";
import { normalizeScore } from "@/lib/constants";
import { V2Zoom } from "@/components/building/v2/V2Zoom";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  landlordSlug,
  landlordUrl,
  landlordJsonLd,
  breadcrumbJsonLd,
  canonicalUrl,
  cityPath,
} from "@/lib/seo";
import type { Metadata } from "next";
import { CITY_META } from "@/lib/cities";
import type { City } from "@/lib/cities";
import {
  buildLandlordTitle,
  buildLandlordDescription,
} from "@/lib/seo-metadata";
import { getLandlordStats } from "@/lib/landlord-stats";

export const revalidate = 86400; // 24h ISR — matches building v2

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
  supabase: Awaited<ReturnType<typeof createClient>>,
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
  const stats = await getLandlordStats(name, city);

  if (!stats) {
    return { title: "Landlord Not Found" };
  }

  const title = buildLandlordTitle({
    name: stats.name,
    buildingCount: stats.buildingCount,
    totalIssues: stats.totalIssues,
    city,
  });

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
  const supabase = await createClient();

  const [ownerName, cachedStats] = await Promise.all([
    resolveOwnerName(supabase, name, city),
    getLandlordStats(name, city),
  ]);

  // No matching landlord — send to the directory with a real 307 so crawlers
  // and health checks see a status code (page-level `notFound()` returns 200).
  if (!ownerName || !cachedStats) {
    redirect(cityPath("/landlords", city));
  }

  // Canonicalise to the slug URL when the caller used a decoded owner name.
  const correctSlug = landlordSlug(ownerName);
  if (correctSlug !== name) {
    permanentRedirect(cityPath(`/landlord/${correctSlug}`, city));
  }

  const displayName = cachedStats.name;
  const grade = letterGrade(cachedStats.avgScore);

  return (
    <div className="v2">
      <V2Zoom />
      <JsonLd
        data={landlordJsonLd(
          displayName,
          cachedStats.buildingCount,
          city,
          undefined,
          cachedStats.totalIssues
        )}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: "Landlords", url: cityPath("/landlords", city) },
          { name: displayName, url: landlordUrl(displayName, city) },
        ])}
      />

      <div className="container">
        <Crumbs city={city} displayName={displayName} />

        {/* ────────── Above-the-fold ────────── */}
        <HeroV2Streamed
          slug={correctSlug}
          city={city}
          displayName={displayName}
          fullCity={CITY_META[city].fullName}
        />

        <RecordStripStreamed slug={correctSlug} city={city} />

        {/* ────────── Body ────────── */}
        <div className="body">
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
            <S02TrendStreamed
              slug={correctSlug}
              city={city}
              buildingCount={cachedStats.buildingCount}
            />
            <S03CaseFileStreamed slug={correctSlug} city={city} />
            <S04BuildingsStreamed slug={correctSlug} city={city} />
            <S05OwnershipStreamed
              slug={correctSlug}
              city={city}
              displayName={displayName}
              buildingCount={cachedStats.buildingCount}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
