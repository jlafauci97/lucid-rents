import { Suspense } from "react";
import { S10_ChicagoInsights } from "../sections/S10_ChicagoInsights";
import { loadChicagoData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";
import type { Building } from "@/types";

async function Inner({ building }: { building: Building }) {
  const chicagoData = await loadChicagoData(building.id);
  return <S10_ChicagoInsights building={building} chicagoData={chicagoData} />;
}

export function S10ChicagoInsightsStreamed({ building }: { building: Building }) {
  return (
    <Suspense fallback={<SectionSkeleton num="10 / 10" title="Chicago-specific insights." id="chicago-insights" />}>
      <Inner building={building} />
    </Suspense>
  );
}
