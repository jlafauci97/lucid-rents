import { Suspense } from "react";
import type { Building } from "@/types";
import { S10_HoustonInsights } from "../sections/S10_HoustonInsights";
import { loadHoustonData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";

async function S10HoustonInner({ building }: { building: Building }) {
  const houstonData = await loadHoustonData(building.id);
  return <S10_HoustonInsights building={building} houstonData={houstonData} />;
}

export function S10HoustonInsightsStreamed({ building }: { building: Building }) {
  return (
    <Suspense fallback={<SectionSkeleton id="houston-insights" num="10 / 10" title="Houston-specific insights." height={280} />}>
      <S10HoustonInner building={building} />
    </Suspense>
  );
}
