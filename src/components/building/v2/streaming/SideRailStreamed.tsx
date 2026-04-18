import { Suspense } from "react";
import type { Building } from "@/types";
import type { City } from "@/lib/cities";
import { SideRail } from "../SideRail";
import { loadBuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SideRailSkeleton } from "./SectionSkeleton";

/**
 * SideRail reaches into ~every slice of BuildingV2Data (rents, reviews, energy,
 * transit, schools, crime, similar, vibe). We load the full bag inside its own
 * Suspense boundary so it streams independently of the main column — if any
 * one query is slow it only blocks the rail, never the hero or above-fold
 * sections.
 */

interface Props {
  building: Building;
  city: City;
  cityPrefix: string;
}

async function SideRailInner({ building, city, cityPrefix }: Props) {
  const data = await loadBuildingV2Data(building);
  return <SideRail building={building} data={data} city={city} cityPrefix={cityPrefix} />;
}

export function SideRailStreamed(props: Props) {
  return (
    <Suspense fallback={<SideRailSkeleton />}>
      <SideRailInner {...props} />
    </Suspense>
  );
}
