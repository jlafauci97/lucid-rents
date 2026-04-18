import { Suspense } from "react";
import type { Building } from "@/types";
import { S03_TenantReviews } from "../sections/S03_TenantReviews";
import { loadReviewsData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";

interface Props {
  building: Building;
  cityPrefix: string;
  borough: string;
  slug: string;
}

async function S03Inner({ building, cityPrefix, borough, slug }: Props) {
  const reviews = await loadReviewsData(building.id);
  return (
    <S03_TenantReviews
      reviews={reviews}
      seeAllUrl={`/${cityPrefix}/building/${borough}/${slug}/reviews`}
    />
  );
}

export function S03TenantReviewsStreamed(props: Props) {
  return (
    <Suspense fallback={<SectionSkeleton id="reviews" num="03 / 09" title="What tenants actually say." height={300} />}>
      <S03Inner {...props} />
    </Suspense>
  );
}
