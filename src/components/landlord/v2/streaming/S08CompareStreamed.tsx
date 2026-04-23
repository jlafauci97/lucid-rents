import { Suspense } from "react";
import { S08_Compare } from "../sections/S08_Compare";
import { SectionSkeleton } from "@/components/building/v2/streaming/SectionSkeleton";
import { loadLandlordPeers } from "@/app/[city]/landlord/[name]/_data";
import type { City } from "@/lib/cities";

async function Inner({ slug, city, currentAvgScore }: { slug: string; city: City; currentAvgScore: number | null }) {
  const peers = await loadLandlordPeers(slug, city);
  return <S08_Compare peers={peers} city={city} currentAvgScore={currentAvgScore} />;
}

export function S08CompareStreamed({
  slug,
  city,
  currentAvgScore,
}: {
  slug: string;
  city: City;
  currentAvgScore: number | null;
}) {
  return (
    <Suspense fallback={<SectionSkeleton num="08 / 09" title="Compare & act." id="compare" />}>
      <Inner slug={slug} city={city} currentAvgScore={currentAvgScore} />
    </Suspense>
  );
}
