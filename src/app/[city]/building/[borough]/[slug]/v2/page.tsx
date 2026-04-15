import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { regionFromSlug } from "@/lib/seo";
import { VALID_CITIES, type City } from "@/lib/cities";
import { cache } from "react";
import type { Building } from "@/types";
import { loadBuildingV2Data, scoreToGrade } from "./_data";
import { NavV2 } from "@/components/building/v2/NavV2";
import { WayfinderRail } from "@/components/building/v2/WayfinderRail";
import { CITY_META } from "@/lib/cities";
import { buildingUrl } from "@/lib/seo";

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
  const reviewsUrl = `/${cityPrefix}/building/${building.borough.toLowerCase().replace(/\s+/g, "-")}/${building.slug}/review`;

  return (
    <>
      <NavV2 city={typedCity} />
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "32px 24px",
          display: "grid",
          gridTemplateColumns: "220px 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        <WayfinderRail
          grade={grade}
          rating={data.reviews.avgRating}
          buildingName={building.full_address}
          reviewsUrl={reviewsUrl}
        />
        <main>
          <p style={{ fontFamily: "var(--v2-mono)", color: "var(--v2-ink-mute)", fontSize: 12 }}>
            V2 PREVIEW · {building.metro}
          </p>
          <h1 style={{ fontFamily: "var(--v2-serif)", fontSize: 48, margin: "12px 0" }}>
            {building.full_address}
          </h1>
          <p style={{ color: "var(--v2-ink-soft)", marginBottom: 24 }}>
            Hero + RecordStrip render below (Task 1.3).
          </p>
        </main>
      </div>
    </>
  );
}
