import { Suspense } from "react";
import { S07_History } from "../sections/S07_History";
import {
  loadHistoryData,
  loadLandlordData,
} from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";
import type { Building } from "@/types";

async function Inner({ building }: { building: Building }) {
  // S07 displays both the ownership-timeline facts (from landlord) and the
  // event timeline, so we parallel-load both loaders here.
  const [history, landlord] = await Promise.all([
    loadHistoryData(building),
    loadLandlordData(building),
  ]);
  return (
    <S07_History
      building={building}
      landlord={landlord}
      timeline={history.timeline}
    />
  );
}

export function S07HistoryStreamed({ building }: { building: Building }) {
  return (
    <Suspense fallback={<SectionSkeleton num="07 / 09" title="History of the building." id="history" />}>
      <Inner building={building} />
    </Suspense>
  );
}
