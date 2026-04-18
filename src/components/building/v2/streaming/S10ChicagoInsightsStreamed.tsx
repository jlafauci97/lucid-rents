import { Suspense } from "react";
import type { Building } from "@/types";
import { S10_ChicagoInsights } from "../sections/S10_ChicagoInsights";
import { loadChicagoData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";

async function S10ChicagoInner({ building }: { building: Building }) {
  const chicagoData = await loadChicagoData(building.id);
  return <S10_ChicagoInsights building={building} chicagoData={chicagoData} />;
}

export function S10ChicagoInsightsStreamed({ building }: { building: Building }) {
  return (
    <Suspense fallback={<SectionSkeleton id="chicago-insights" num="10 / 10" title="Chicago-specific insights." height={280} />}>
      <S10ChicagoInner building={building} />
    </Suspense>
  );
}
