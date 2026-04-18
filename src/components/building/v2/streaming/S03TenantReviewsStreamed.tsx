import { Suspense } from "react";
import { S03_TenantReviews } from "../sections/S03_TenantReviews";
import { loadReviewsData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";
import type { Building } from "@/types";

async function Inner({ building, seeAllUrl }: { building: Building; seeAllUrl: string }) {
  const reviews = await loadReviewsData(building.id);
  return <S03_TenantReviews reviews={reviews} seeAllUrl={seeAllUrl} />;
}

export function S03TenantReviewsStreamed({ building, seeAllUrl }: { building: Building; seeAllUrl: string }) {
  return (
    <Suspense fallback={<SectionSkeleton num="03 / 09" title="What tenants actually say." id="reviews" />}>
      <Inner building={building} seeAllUrl={seeAllUrl} />
    </Suspense>
  );
}
