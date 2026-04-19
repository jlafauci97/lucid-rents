import { Suspense } from "react";
import { S10_MiamiInsights } from "../sections/S10_MiamiInsights";
import { loadMiamiData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";
import type { Building } from "@/types";

async function Inner({ building }: { building: Building }) {
  const miamiData = await loadMiamiData(building.id);
  return <S10_MiamiInsights building={building} miamiData={miamiData} />;
}

export function S10MiamiInsightsStreamed({ building }: { building: Building }) {
  return (
    <Suspense fallback={<SectionSkeleton num="10 / 10" title="Miami-specific insights." id="miami-insights" />}>
      <Inner building={building} />
    </Suspense>
  );
}
