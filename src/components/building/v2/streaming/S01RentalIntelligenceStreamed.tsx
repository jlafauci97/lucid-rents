import { Suspense } from "react";
import type { Building } from "@/types";
import { S01_RentalIntelligence } from "../sections/S01_RentalIntelligence";
import { loadRentsData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";

async function S01Inner({ building }: { building: Building }) {
  const { rents, seasonalIndex } = await loadRentsData(
    building.id,
    building.metro,
    building.zip_code ?? null,
  );
  return (
    <S01_RentalIntelligence
      rents={rents}
      neighborhoodName={building.borough}
      isRentStabilized={building.is_rent_stabilized}
      seasonalIndex={seasonalIndex}
    />
  );
}

export function S01RentalIntelligenceStreamed({ building }: { building: Building }) {
  return (
    <Suspense fallback={<SectionSkeleton id="rent" num="01 / 09" title="Rental intelligence." height={360} />}>
      <S01Inner building={building} />
    </Suspense>
  );
}
