import { Suspense } from "react";
import { S09_FAQ } from "../sections/S09_FAQ";
import {
  loadRentsData,
  loadIssuesData,
  loadReviewsData,
  loadAmenitiesData,
  loadLandlordData,
  loadLocationData,
  loadHistoryData,
  loadSimilarData,
  loadLAData,
  loadChicagoData,
  loadMiamiData,
  loadHoustonData,
  type BuildingV2Data,
} from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";
import type { Building } from "@/types";

// S09_FAQ consumes the full BuildingV2Data blob because the FAQ generator pulls
// facts from every section. We reassemble that shape in parallel here so the
// FAQ still streams independently of the earlier sections.
async function Inner({ building }: { building: Building }) {
  const [
    rentsSlice,
    issues,
    reviews,
    amenitiesSlice,
    landlord,
    locationSlice,
    historySlice,
    similar,
    laData,
    chicagoData,
    miamiData,
    houstonData,
  ] = await Promise.all([
    loadRentsData(building.id, building.metro, building.zip_code),
    loadIssuesData(building.id),
    loadReviewsData(building.id),
    loadAmenitiesData(building.id, building.zip_code, building.metro),
    loadLandlordData(building),
    loadLocationData(building),
    loadHistoryData(building),
    loadSimilarData(building.id, building.zip_code),
    building.metro === "los-angeles"
      ? loadLAData(building.id)
      : Promise.resolve({ buyouts: [], scepInspections: [], earthquakeRetrofit: null } as BuildingV2Data["laData"]),
    building.metro === "chicago"
      ? loadChicagoData(building.id)
      : Promise.resolve({ rltoViolations: [], demolitions: [], leadInspections: [], affordableUnits: [], energyRating: null } as BuildingV2Data["chicagoData"]),
    building.metro === "miami"
      ? loadMiamiData(building.id)
      : Promise.resolve({ recerts: [], unsafeStructures: [], stormDamage: [], floodClaims: [] } as BuildingV2Data["miamiData"]),
    building.metro === "houston"
      ? loadHoustonData(building.id)
      : Promise.resolve({ dangerousBuildings: [], industrialProximity: [], taxProtests: [], affordableHousing: [] } as BuildingV2Data["houstonData"]),
  ]);

  const data: BuildingV2Data = {
    building,
    energy: historySlice.energy,
    rents: {
      current: rentsSlice.current,
      historic: rentsSlice.historic,
      neighborhood: rentsSlice.neighborhood,
    },
    seasonalIndex: rentsSlice.seasonalIndex,
    amenityPremiums: amenitiesSlice.amenityPremiums,
    demographics: locationSlice.demographics,
    vibe: locationSlice.vibe,
    issues,
    reviews,
    nearby: locationSlice.nearby,
    crime: locationSlice.crime,
    neighborhoodStats: locationSlice.neighborhoodStats,
    amenities: amenitiesSlice.amenities,
    landlord,
    similar,
    timeline: historySlice.timeline,
    laData,
    chicagoData,
    miamiData,
    houstonData,
  };

  return <S09_FAQ building={building} data={data} />;
}

export function S09FAQStreamed({ building }: { building: Building }) {
  return (
    <Suspense fallback={<SectionSkeleton num="09 / 09" title="Frequently asked questions." id="faq" />}>
      <Inner building={building} />
    </Suspense>
  );
}
