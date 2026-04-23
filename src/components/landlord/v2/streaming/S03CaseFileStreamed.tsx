import { Suspense } from "react";
import { S03_CaseFile } from "../sections/S03_CaseFile";
import { SectionSkeleton } from "@/components/building/v2/streaming/SectionSkeleton";
import { loadLandlordCaseFile } from "@/app/[city]/landlord/[name]/_data";
import type { City } from "@/lib/cities";

async function Inner({ slug, city }: { slug: string; city: City }) {
  const caseFile = await loadLandlordCaseFile(slug, city);
  if (!caseFile) return null;
  return <S03_CaseFile caseFile={caseFile} city={city} />;
}

export function S03CaseFileStreamed({ slug, city }: { slug: string; city: City }) {
  return (
    <Suspense fallback={<SectionSkeleton num="03 / 09" title="Case file." id="casefile" />}>
      <Inner slug={slug} city={city} />
    </Suspense>
  );
}
