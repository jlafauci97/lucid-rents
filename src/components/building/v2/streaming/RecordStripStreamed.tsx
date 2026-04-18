import { Suspense } from "react";
import type { Building } from "@/types";
import { RecordStrip } from "../RecordStrip";
import { loadReviewsData } from "@/app/[city]/building/[borough]/[slug]/_data";

async function RecordStripInner({ building }: { building: Building }) {
  const reviews = await loadReviewsData(building.id);
  return <RecordStrip building={building} reviews={reviews} />;
}

function RecordStripSkeleton() {
  return (
    <div
      className="v2-skeleton"
      style={{ height: 88, background: "var(--v2-border, rgba(0,0,0,0.06))", borderRadius: 14 }}
    />
  );
}

export function RecordStripStreamed({ building }: { building: Building }) {
  return (
    <Suspense fallback={<RecordStripSkeleton />}>
      <RecordStripInner building={building} />
    </Suspense>
  );
}
