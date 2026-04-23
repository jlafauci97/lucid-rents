import { Suspense } from "react";
import { S04_Buildings } from "../sections/S04_Buildings";
import { SectionSkeleton } from "@/components/building/v2/streaming/SectionSkeleton";
import { loadLandlordBuildings } from "@/app/[city]/landlord/[name]/_data";
import type { City } from "@/lib/cities";

async function Inner({ slug, city }: { slug: string; city: City }) {
  const buildings = await loadLandlordBuildings(slug, city);
  return <S04_Buildings buildings={buildings} city={city} slug={slug} />;
}

export function S04BuildingsStreamed({ slug, city }: { slug: string; city: City }) {
  return (
    <Suspense fallback={<SectionSkeleton num="04 / 09" title="The buildings." id="buildings" />}>
      <Inner slug={slug} city={city} />
    </Suspense>
  );
}
