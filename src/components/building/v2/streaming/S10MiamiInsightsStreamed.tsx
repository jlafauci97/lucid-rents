import { Suspense } from "react";
import type { Building } from "@/types";
import { S10_MiamiInsights } from "../sections/S10_MiamiInsights";
import { loadMiamiData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";

async function S10MiamiInner({ building }: { building: Building }) {
  const miamiData = await loadMiamiData(building.id);
  return <S10_MiamiInsights building={building} miamiData={miamiData} />;
}

export function S10MiamiInsightsStreamed({ building }: { building: Building }) {
  return (
    <Suspense fallback={<SectionSkeleton id="miami-insights" num="10 / 10" title="Miami-specific insights." height={280} />}>
      <S10MiamiInner building={building} />
    </Suspense>
  );
}
