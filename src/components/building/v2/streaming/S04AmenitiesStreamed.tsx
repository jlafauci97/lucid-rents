import { Suspense } from "react";
import { S04_Amenities } from "../sections/S04_Amenities";
import { loadAmenitiesData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";
import type { Building } from "@/types";

async function Inner({ building }: { building: Building }) {
  const data = await loadAmenitiesData(building.id, building.zip_code, building.metro);
  return <S04_Amenities amenities={data.amenities} amenityPremiums={data.amenityPremiums} />;
}

export function S04AmenitiesStreamed({ building }: { building: Building }) {
  return (
    <Suspense fallback={<SectionSkeleton num="04 / 09" title="Building amenities." id="amenities" />}>
      <Inner building={building} />
    </Suspense>
  );
}
