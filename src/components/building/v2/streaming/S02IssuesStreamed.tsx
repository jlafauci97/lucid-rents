import { Suspense } from "react";
import { S02_Issues } from "../sections/S02_Issues";
import { loadIssuesData } from "@/app/[city]/building/[borough]/[slug]/_data";
import { SectionSkeleton } from "./SectionSkeleton";
import type { Building } from "@/types";

async function Inner({ building, seeAllUrl }: { building: Building; seeAllUrl: string }) {
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
      seeAllUrl={seeAllUrl}
    />
  );
}

export function S02IssuesStreamed({ building, seeAllUrl }: { building: Building; seeAllUrl: string }) {
  return (
    <Suspense fallback={<SectionSkeleton num="02 / 09" title="Violations, 311, & more." id="record" />}>
      <Inner building={building} seeAllUrl={seeAllUrl} />
    </Suspense>
  );
}
