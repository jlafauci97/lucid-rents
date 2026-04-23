import { Suspense } from "react";
import { S07_Where } from "../sections/S07_Where";
import { SectionSkeleton } from "@/components/building/v2/streaming/SectionSkeleton";
import { loadLandlordWhere } from "@/app/[city]/landlord/[name]/_data";
import type { City } from "@/lib/cities";

async function Inner({ slug, city, buildingCount }: { slug: string; city: City; buildingCount: number }) {
  const where = await loadLandlordWhere(slug, city);
  if (where.regions.length === 0) return null;
  return <S07_Where where={where} city={city} buildingCount={buildingCount} />;
}

export function S07WhereStreamed({ slug, city, buildingCount }: { slug: string; city: City; buildingCount: number }) {
  return (
    <Suspense fallback={<SectionSkeleton num="07 / 09" title="Where they operate." id="where" />}>
      <Inner slug={slug} city={city} buildingCount={buildingCount} />
    </Suspense>
  );
}
