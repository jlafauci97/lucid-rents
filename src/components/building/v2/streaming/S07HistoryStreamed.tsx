import { Suspense } from "react";
import type { Building } from "@/types";
import { S07_History } from "../sections/S07_History";
import { loadHistoryData, loadLandlordData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";

async function S07Inner({ building }: { building: Building }) {
  // S07 renders the landlord identity on the right-hand ownership column,
  // so we need both the timeline and landlord data here. Run them in parallel.
  const [historyBundle, landlord] = await Promise.all([
    loadHistoryData(building.id),
    loadLandlordData(building),
  ]);
  return (
    <S07_History
      building={building}
      landlord={landlord}
      timeline={historyBundle.timeline}
    />
  );
}

export function S07HistoryStreamed({ building }: { building: Building }) {
  return (
    <Suspense fallback={<SectionSkeleton id="history" num="07 / 09" title="History of the building." height={320} />}>
      <S07Inner building={building} />
    </Suspense>
  );
}
