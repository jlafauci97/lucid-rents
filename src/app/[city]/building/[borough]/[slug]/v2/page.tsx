import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { regionFromSlug } from "@/lib/seo";
import { VALID_CITIES, type City } from "@/lib/cities";
import { cache } from "react";
import type { Building } from "@/types";

export const revalidate = 86400;

interface Props {
  params: Promise<{ city: string; borough: string; slug: string }>;
}

const getBuilding = cache(async (boroughSlug: string, slug: string, metro: string) => {
  const city = metro as City;
  const borough = regionFromSlug(boroughSlug, city);
  const supabase = await createClient();
  const { data } = await supabase
    .from("buildings")
    .select("*")
    .eq("slug", slug)
    .eq("borough", borough)
    .eq("metro", metro)
    .limit(1);
  return (data?.[0] as Building) ?? null;
});

export default async function BuildingV2Page({ params }: Props) {
  const { city, borough, slug } = await params;
  if (!VALID_CITIES.includes(city as City)) notFound();
  const building = await getBuilding(borough, slug, city);
  if (!building) notFound();

  return (
    <main style={{ padding: "40px 24px", maxWidth: 1200, margin: "0 auto" }}>
      <p style={{ fontFamily: "var(--v2-mono)", color: "var(--v2-ink-mute)", fontSize: 12 }}>
        V2 PREVIEW · {building.metro}
      </p>
      <h1 style={{ fontFamily: "var(--v2-serif)", fontSize: 48, margin: "12px 0" }}>
        {building.full_address}
      </h1>
      <p style={{ color: "var(--v2-ink-soft)" }}>
        Skeleton route live. Sections wire up in Phase 1+.
      </p>
    </main>
  );
}
