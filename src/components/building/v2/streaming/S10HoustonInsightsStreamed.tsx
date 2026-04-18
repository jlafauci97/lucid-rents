import { Suspense } from "react";
import { S10_HoustonInsights } from "../sections/S10_HoustonInsights";
import { loadHoustonData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";
import type { Building } from "@/types";

async function Inner({ building }: { building: Building }) {
  const houstonData = await loadHoustonData(building.id);
  return <S10_HoustonInsights building={building} houstonData={houstonData} />;
}

export function S10HoustonInsightsStreamed({ building }: { building: Building }) {
  return (
    <Suspense fallback={<SectionSkeleton num="10 / 10" title="Houston-specific insights." id="houston-insights" />}>
      <Inner building={building} />
    </Suspense>
  );
}
