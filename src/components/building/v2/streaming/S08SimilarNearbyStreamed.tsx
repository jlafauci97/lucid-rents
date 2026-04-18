import { Suspense } from "react";
import { S08_SimilarNearby } from "../sections/S08_SimilarNearby";
import { loadSimilarData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";
import type { Building } from "@/types";
import type { City } from "@/lib/cities";

async function Inner({ building, city }: { building: Building; city: City }) {
  const similar = await loadSimilarData(building.id, building.zip_code);
  return <S08_SimilarNearby similar={similar} city={city} />;
}

export function S08SimilarNearbyStreamed({ building, city }: { building: Building; city: City }) {
  return (
    <Suspense fallback={<SectionSkeleton num="08 / 09" title="Similar buildings nearby." id="similar" />}>
      <Inner building={building} city={city} />
    </Suspense>
  );
}
