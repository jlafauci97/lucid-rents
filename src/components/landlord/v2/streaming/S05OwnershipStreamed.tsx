import { Suspense } from "react";
import { S05_Ownership } from "../sections/S05_Ownership";
import { SectionSkeleton } from "@/components/building/v2/streaming/SectionSkeleton";
import { loadLandlordOwnership } from "@/app/[city]/landlord/[name]/_data";
import type { City } from "@/lib/cities";

async function Inner({ slug, city, displayName, buildingCount }: {
  slug: string;
  city: City;
  displayName: string;
  buildingCount: number;
}) {
  const ownership = await loadLandlordOwnership(slug, city);
  return <S05_Ownership ownership={ownership} displayName={displayName} buildingCount={buildingCount} />;
}

export function S05OwnershipStreamed(props: {
  slug: string;
  city: City;
  displayName: string;
  buildingCount: number;
}) {
  return (
    <Suspense fallback={<SectionSkeleton num="05 / 09" title="Ownership & operations." id="ownership" />}>
      <Inner {...props} />
    </Suspense>
  );
}
