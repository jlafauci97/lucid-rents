import { Suspense } from "react";
import { S10_LAInsights } from "../sections/S10_LAInsights";
import { loadLAData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";
import type { Building } from "@/types";

async function Inner({ building }: { building: Building }) {
  const laData = await loadLAData(building.id);
  return <S10_LAInsights building={building} laData={laData} />;
}

export function S10LAInsightsStreamed({ building }: { building: Building }) {
  return (
    <Suspense fallback={<SectionSkeleton num="10 / 10" title="LA-specific insights." id="la-insights" />}>
      <Inner building={building} />
    </Suspense>
  );
}
