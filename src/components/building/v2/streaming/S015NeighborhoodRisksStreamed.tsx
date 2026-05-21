import { Suspense } from "react";
import { S015_NeighborhoodRisks } from "../sections/S015_NeighborhoodRisks";
import { fetchNeighborhoodRisks } from "@/lib/neighborhood-risks/queries";
import { SectionSkeleton } from "./SectionSkeleton";
import type { Building } from "@/types";

async function Inner({ building }: { building: Building }) {
  if (building.metro !== "nyc") return null; // tool is NYC-only at v1
  // Building latitude/longitude may be null or string-numeric from the DB.
  const lat =
    typeof building.latitude === "number"
      ? building.latitude
      : building.latitude == null
        ? NaN
        : Number(building.latitude);
  const lng =
    typeof building.longitude === "number"
      ? building.longitude
      : building.longitude == null
        ? NaN
        : Number(building.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const result = await fetchNeighborhoodRisks({
    id: building.id,
    name: building.name ?? building.full_address,
    address: building.full_address,
    borough: building.borough,
    neighborhood: "",
    lat,
    lng,
    slug: building.slug,
  });

  return <S015_NeighborhoodRisks result={result} city="nyc" />;
}

/**
 * Streaming wrapper for the Neighborhood Risks preview section. NYC-only:
 * other cities render nothing (the data layer isn't wired for them yet).
 */
export function S015NeighborhoodRisksStreamed({ building }: { building: Building }) {
  if (building.metro !== "nyc") return null;
  return (
    <Suspense
      fallback={
        <SectionSkeleton
          num="02 / 10"
          title="Neighborhood risks."
          id="neighborhood-risks"
        />
      }
    >
      <Inner building={building} />
    </Suspense>
  );
}
