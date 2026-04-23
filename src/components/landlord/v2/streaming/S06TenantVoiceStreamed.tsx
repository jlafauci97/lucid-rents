import { Suspense } from "react";
import { S06_TenantVoice } from "../sections/S06_TenantVoice";
import { SectionSkeleton } from "@/components/building/v2/streaming/SectionSkeleton";
import { loadLandlordTenantVoice } from "@/app/[city]/landlord/[name]/_data";
import type { City } from "@/lib/cities";

async function Inner({ slug, city }: { slug: string; city: City }) {
  const voice = await loadLandlordTenantVoice(slug, city);
  if (voice.totalReviews === 0) return null;
  return <S06_TenantVoice voice={voice} />;
}

export function S06TenantVoiceStreamed({ slug, city }: { slug: string; city: City }) {
  return (
    <Suspense fallback={<SectionSkeleton num="06 / 09" title="Tenant voice." id="voice" />}>
      <Inner slug={slug} city={city} />
    </Suspense>
  );
}
