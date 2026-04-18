import { Suspense } from "react";
import { S06_Location } from "../sections/S06_Location";
import { loadLocationData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";
import type { Building } from "@/types";
import type { City } from "@/lib/cities";

async function Inner({ building, city }: { building: Building; city: City }) {
  const data = await loadLocationData(building);
  return (
    <S06_Location
      building={building}
      city={city}
      nearby={data.nearby}
      neighborhoodStats={data.neighborhoodStats}
      demographics={data.demographics}
      vibe={data.vibe}
    />
  );
}

export function S06LocationStreamed({ building, city }: { building: Building; city: City }) {
  return (
    <Suspense fallback={<SectionSkeleton num="06 / 09" title="Location & daily life." id="location" />}>
      <Inner building={building} city={city} />
    </Suspense>
  );
}
