import { Suspense } from "react";
import { SideRail } from "../SideRail";
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
import type { Building } from "@/types";
import type { City } from "@/lib/cities";

// SideRail reads from nearly every slice of BuildingV2Data (rent comparison,
// reviews, energy, nearby transit/schools/crime, vibe, similar buildings).
// We parallel-load those slices here so the rail streams independently of
// the main column and each individual section.
async function Inner({ building, city, cityPrefix }: { building: Building; city: City; cityPrefix: string }) {
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

  return <SideRail building={building} data={data} city={city} cityPrefix={cityPrefix} />;
}

function SideRailFallback() {
  return (
    <aside className="sr" aria-label="Building side info" aria-busy="true">
      <style>{`
        @keyframes v2-pulse {
          0%   { opacity: 0.6; }
          50%  { opacity: 0.3; }
          100% { opacity: 0.6; }
        }
      `}</style>
      {Array.from({ length: 4 }).map((_, i) => (
        <section
          key={i}
          className="sr-card"
          style={{
            minHeight: i === 0 ? 180 : 140,
            background: "rgba(219, 234, 254, 0.35)",
            animation: "v2-pulse 1.4s ease-in-out infinite",
          }}
        />
      ))}
    </aside>
  );
}

export function SideRailStreamed({ building, city, cityPrefix }: { building: Building; city: City; cityPrefix: string }) {
  return (
    <Suspense fallback={<SideRailFallback />}>
      <Inner building={building} city={city} cityPrefix={cityPrefix} />
    </Suspense>
  );
}
