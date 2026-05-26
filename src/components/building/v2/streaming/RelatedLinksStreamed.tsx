import { Suspense } from "react";
import { RelatedLinks } from "../RelatedLinks";
import { loadLandlordData } from "@/app/[city]/building/[borough]/[slug]/_data";
import type { Building } from "@/types";
import type { City } from "@/lib/cities";

async function Inner({ building, city }: { building: Building; city: City }) {
  const landlord = await loadLandlordData(building);
  return <RelatedLinks building={building} landlord={landlord} city={city} />;
}

export function RelatedLinksStreamed({ building, city }: { building: Building; city: City }) {
  return (
    <Suspense fallback={null}>
      <Inner building={building} city={city} />
    </Suspense>
  );
}
