import { Suspense } from "react";
import type { Building } from "@/types";
import { S09_FAQ } from "../sections/S09_FAQ";
import { loadBuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";

/**
 * S09 FAQ pulls from nearly every slice of BuildingV2Data to generate its Q&A
 * set (rents, issues, amenities, nearby, crime, reviews). Rather than thread
 * eight separate loaders through it, we reuse the full `loadBuildingV2Data`
 * here — the cost lives entirely inside its own Suspense boundary, so the
 * rest of the page still streams in without waiting for it.
 *
 * Paired with <LazyOnScroll> at the call site, the network requests only
 * fire once the user scrolls the FAQ into view.
 */

async function S09Inner({ building }: { building: Building }) {
  const data = await loadBuildingV2Data(building);
  return <S09_FAQ building={building} data={data} />;
}

export function S09FAQStreamed({ building }: { building: Building }) {
  return (
    <Suspense fallback={<SectionSkeleton id="faq" num="09 / 09" title="Frequently asked questions." height={420} />}>
      <S09Inner building={building} />
    </Suspense>
  );
}
