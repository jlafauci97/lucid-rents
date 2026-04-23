import { Suspense } from "react";
import { S09_FAQ } from "../sections/S09_FAQ";
import { SectionSkeleton } from "@/components/building/v2/streaming/SectionSkeleton";
import { loadLandlordFAQ } from "@/app/[city]/landlord/[name]/_data";
import type { City } from "@/lib/cities";

async function Inner({ slug, city }: { slug: string; city: City }) {
  const items = await loadLandlordFAQ(slug, city);
  return <S09_FAQ items={items} />;
}

export function S09FAQStreamed({ slug, city }: { slug: string; city: City }) {
  return (
    <Suspense fallback={<SectionSkeleton num="09 / 09" title="Questions, answered." id="faq" />}>
      <Inner slug={slug} city={city} />
    </Suspense>
  );
}
