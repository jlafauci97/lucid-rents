import { notFound, permanentRedirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildingUrl } from "@/lib/seo";
import type { City } from "@/lib/cities";

interface BuildingPageProps {
  params: Promise<{ city: string; borough: string }>;
}

export default async function BuildingRedirectPage({ params }: BuildingPageProps) {
  const { city: cityParam, borough } = await params;
  const city = cityParam as City;

  const supabase = await createClient();

  // Case 1: UUID-based redirect (legacy links)
  if (borough.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/)) {
    const { data: building } = await supabase
      .from("buildings")
      .select("borough, slug")
      .eq("id", borough)
      .single();

    if (!building) notFound();
    permanentRedirect(buildingUrl(building, city));
  }

  // Case 2: Slug-only URL (missing borough segment, e.g. /building/124-w-kinzie-st)
  // Look up the building by slug and redirect to the canonical URL with borough
  const { data: building } = await supabase
    .from("buildings")
    .select("borough, slug, metro")
    .eq("slug", borough) // the "borough" param is actually the slug here
    .eq("metro", cityParam)
    .limit(1)
    .maybeSingle();

  if (building?.borough) {
    permanentRedirect(buildingUrl(building, city));
  }

  // Case 3: No match — try without metro filter as fallback
  const { data: fallback } = await supabase
    .from("buildings")
    .select("borough, slug, metro")
    .eq("slug", borough)
    .limit(1)
    .maybeSingle();

  if (fallback?.borough) {
    const fallbackCity = (fallback.metro === "los-angeles" ? "los-angeles" : fallback.metro === "chicago" ? "chicago" : fallback.metro === "miami" ? "miami" : "nyc") as City;
    permanentRedirect(buildingUrl(fallback, fallbackCity));
  }

  notFound();
}
