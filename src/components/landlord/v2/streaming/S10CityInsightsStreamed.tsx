import { Suspense } from "react";
import { S10_CityInsights } from "../sections/S10_CityInsights";
import { SectionSkeleton } from "@/components/building/v2/streaming/SectionSkeleton";
import { loadLandlordCityInsights } from "@/app/[city]/landlord/[name]/_data";
import { CITY_META } from "@/lib/cities";
import type { City } from "@/lib/cities";

async function Inner({ slug, city }: { slug: string; city: City }) {
  const payload = await loadLandlordCityInsights(slug, city);
  if (!payload) return null;
  return <S10_CityInsights payload={payload} city={city} />;
}

export function S10CityInsightsStreamed({ slug, city }: { slug: string; city: City }) {
  const cityName = CITY_META[city].name;
  return (
    <Suspense fallback={<SectionSkeleton num={cityName} title={`${cityName}-specific insights.`} id="city-insights" />}>
      <Inner slug={slug} city={city} />
    </Suspense>
  );
}
