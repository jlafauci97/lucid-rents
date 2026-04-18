import { Suspense } from "react";
import type { Building } from "@/types";
import { S10_LAInsights } from "../sections/S10_LAInsights";
import { loadLAData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";

async function S10LAInner({ building }: { building: Building }) {
  const laData = await loadLAData(building.id);
  return <S10_LAInsights building={building} laData={laData} />;
}

export function S10LAInsightsStreamed({ building }: { building: Building }) {
  return (
    <Suspense fallback={<SectionSkeleton id="la-insights" num="10 / 10" title="Los Angeles-specific insights." height={280} />}>
      <S10LAInner building={building} />
    </Suspense>
  );
}
