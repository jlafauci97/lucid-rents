import { Suspense } from "react";
import { S01_Glance } from "../sections/S01_Glance";
import { SectionSkeleton } from "@/components/building/v2/streaming/SectionSkeleton";
import { loadLandlordGlance } from "@/app/[city]/landlord/[name]/_data";
import type { City } from "@/lib/cities";

interface Props {
  slug: string;
  city: City;
  avgScore: number | null;
  buildingCount: number;
}

async function Inner({ slug, city, avgScore, buildingCount }: Props) {
  const portfolio = await loadLandlordGlance(slug, city);
  // Unit count isn't needed at render time for this section — pass 0 as a
  // placeholder; S01 only uses it in the one-line summary and will gracefully
  // omit the "housing N tenants" phrase.
  return (
    <S01_Glance
      portfolio={portfolio}
      avgScore={avgScore}
      buildingCount={buildingCount}
      unitCount={0}
      city={city}
    />
  );
}

export function S01GlanceStreamed(props: Props) {
  return (
    <Suspense fallback={<SectionSkeleton num="01 / 09" title="Portfolio at a glance." id="glance" />}>
      <Inner {...props} />
    </Suspense>
  );
}
