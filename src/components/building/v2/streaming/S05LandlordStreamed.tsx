import { Suspense } from "react";
import type { Building } from "@/types";
import type { City } from "@/lib/cities";
import { S05_Landlord } from "../sections/S05_Landlord";
import { loadLandlordData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";

interface Props {
  building: Building;
  city: City;
}

async function S05Inner({ building, city }: Props) {
  const landlord = await loadLandlordData(building);
  return <S05_Landlord building={building} landlord={landlord} city={city} />;
}

export function S05LandlordStreamed(props: Props) {
  return (
    <Suspense fallback={<SectionSkeleton id="landlord" num="05 / 09" title="The landlord." height={340} />}>
      <S05Inner {...props} />
    </Suspense>
  );
}
