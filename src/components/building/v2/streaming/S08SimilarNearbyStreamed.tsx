import { Suspense } from "react";
import type { Building } from "@/types";
import type { City } from "@/lib/cities";
import { S08_SimilarNearby } from "../sections/S08_SimilarNearby";
import { loadSimilarData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";

interface Props {
  building: Building;
  city: City;
}

async function S08Inner({ building, city }: Props) {
  const similar = await loadSimilarData(building.id, building.zip_code ?? null);
  return <S08_SimilarNearby similar={similar} city={city} />;
}

export function S08SimilarNearbyStreamed(props: Props) {
  return (
    <Suspense fallback={<SectionSkeleton id="similar" num="08 / 09" title="Similar buildings nearby." height={360} />}>
      <S08Inner {...props} />
    </Suspense>
  );
}
