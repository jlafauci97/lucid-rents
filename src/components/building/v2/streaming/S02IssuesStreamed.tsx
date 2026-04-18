import { Suspense } from "react";
import type { Building } from "@/types";
import { S02_Issues } from "../sections/S02_Issues";
import { loadIssuesData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";

interface Props {
  building: Building;
  cityPrefix: string;
  borough: string;
  slug: string;
}

async function S02Inner({ building, cityPrefix, borough, slug }: Props) {
  const issues = await loadIssuesData(building.id);
  return (
    <S02_Issues
      issues={issues}
      hpdViolations={issues.hpdViolations}
      buildingId={building.id}
      hpdCount={building.violation_count ?? 0}
      dobCount={building.dob_violation_count ?? 0}
      complaintsCount={building.complaint_count ?? 0}
      evictionsCount={building.eviction_count ?? 0}
      seeAllUrl={`/${cityPrefix}/building/${borough}/${slug}/violations`}
    />
  );
}

export function S02IssuesStreamed(props: Props) {
  return (
    <Suspense fallback={<SectionSkeleton id="issues" num="02 / 09" title="Violations, 311, & more." height={420} />}>
      <S02Inner {...props} />
    </Suspense>
  );
}
