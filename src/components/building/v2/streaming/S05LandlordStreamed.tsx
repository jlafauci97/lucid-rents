import { Suspense } from "react";
import { S05_Landlord } from "../sections/S05_Landlord";
import { loadLandlordData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";
import type { Building } from "@/types";
import type { City } from "@/lib/cities";

async function Inner({ building, city }: { building: Building; city: City }) {
  const landlord = await loadLandlordData(building);
  return <S05_Landlord building={building} landlord={landlord} city={city} />;
}

export function S05LandlordStreamed({ building, city }: { building: Building; city: City }) {
  return (
    <Suspense fallback={<SectionSkeleton num="05 / 09" title="The landlord." id="landlord" />}>
      <Inner building={building} city={city} />
    </Suspense>
  );
}
