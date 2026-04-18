import { Suspense } from "react";
import type { Building } from "@/types";
import { S04_Amenities } from "../sections/S04_Amenities";
import { loadAmenitiesData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";

async function S04Inner({ building }: { building: Building }) {
  const { amenities, amenityPremiums } = await loadAmenitiesData(
    building.id,
    building.zip_code ?? null,
    building.metro,
  );
  return <S04_Amenities amenities={amenities} amenityPremiums={amenityPremiums} />;
}

export function S04AmenitiesStreamed({ building }: { building: Building }) {
  return (
    <Suspense fallback={<SectionSkeleton id="amenities" num="04 / 09" title="Building amenities." height={380} />}>
      <S04Inner building={building} />
    </Suspense>
  );
}
