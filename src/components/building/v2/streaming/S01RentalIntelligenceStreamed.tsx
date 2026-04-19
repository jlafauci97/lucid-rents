import { Suspense } from "react";
import { S01_RentalIntelligence } from "../sections/S01_RentalIntelligence";
import { loadRentsData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";
import type { Building } from "@/types";

async function Inner({ building }: { building: Building }) {
  const data = await loadRentsData(building.id, building.metro, building.zip_code);
  return (
    <S01_RentalIntelligence
      rents={{ current: data.current, historic: data.historic, neighborhood: data.neighborhood }}
      seasonalIndex={data.seasonalIndex}
      neighborhoodName={building.borough}
      isRentStabilized={building.is_rent_stabilized}
    />
  );
}

export function S01RentalIntelligenceStreamed({ building }: { building: Building }) {
  return (
    <Suspense fallback={<SectionSkeleton num="01 / 09" title="Rental intelligence." id="rent" />}>
      <Inner building={building} />
    </Suspense>
  );
}
