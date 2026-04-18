import { Suspense } from "react";
import type { Building } from "@/types";
import type { City } from "@/lib/cities";
import { S06_Location } from "../sections/S06_Location";
import { loadLocationData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";

interface Props {
  building: Building;
  city: City;
}

async function S06Inner({ building, city }: Props) {
  const { nearby, neighborhoodStats, demographics, vibe } = await loadLocationData(building);
  return (
    <S06_Location
      building={building}
      city={city}
      nearby={nearby}
      neighborhoodStats={neighborhoodStats}
      demographics={demographics}
      vibe={vibe}
    />
  );
}

export function S06LocationStreamed(props: Props) {
  return (
    <Suspense fallback={<SectionSkeleton id="location" num="06 / 09" title="Location & daily life." height={460} />}>
      <S06Inner {...props} />
    </Suspense>
  );
}
