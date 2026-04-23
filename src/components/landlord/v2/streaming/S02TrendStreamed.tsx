import { Suspense } from "react";
import { S02_Trend } from "../sections/S02_Trend";
import { SectionSkeleton } from "@/components/building/v2/streaming/SectionSkeleton";
import { loadLandlordTrend, loadLandlordRecord } from "@/app/[city]/landlord/[name]/_data";
import type { City } from "@/lib/cities";

async function Inner({ slug, city, buildingCount }: { slug: string; city: City; buildingCount: number }) {
  const [trend, record] = await Promise.all([
    loadLandlordTrend(slug, city),
    loadLandlordRecord(slug, city),
  ]);
  return <S02_Trend trend={trend} record={record} buildingCount={buildingCount} />;
}

export function S02TrendStreamed({ slug, city, buildingCount }: { slug: string; city: City; buildingCount: number }) {
  return (
    <Suspense fallback={<SectionSkeleton num="02 / 09" title="The record over time." id="record" />}>
      <Inner slug={slug} city={city} buildingCount={buildingCount} />
    </Suspense>
  );
}
