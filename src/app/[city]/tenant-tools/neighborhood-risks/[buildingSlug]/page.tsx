import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { isValidCity } from "@/lib/cities";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { fetchNeighborhoodRisks } from "@/lib/neighborhood-risks/queries";
import { CATEGORY_ORDER } from "@/lib/neighborhood-risks/colors";
import { NeighborhoodRisksHero } from "@/components/neighborhood-risks/NeighborhoodRisksHero";
import { NeighborhoodRisksJumpNav } from "@/components/neighborhood-risks/NeighborhoodRisksJumpNav";
import { NeighborhoodRisksSection } from "@/components/neighborhood-risks/NeighborhoodRisksSection";

export const revalidate = 21600; // 6 hours

interface BuildingRow {
  id: string;
  name: string | null;
  full_address: string;
  borough: string;
  neighborhood: string | null;
  lat: number;
  lng: number;
  slug: string;
}

async function getBuilding(slug: string): Promise<BuildingRow | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data } = await supabase
    .from("buildings")
    .select("id, name, full_address, borough, neighborhood, lat, lng, slug")
    .eq("metro", "nyc")
    .eq("slug", slug)
    .single();
  return (data as BuildingRow | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; buildingSlug: string }>;
}): Promise<Metadata> {
  const { city, buildingSlug } = await params;
  if (!isValidCity(city) || city !== "nyc") return {};
  const b = await getBuilding(buildingSlug);
  if (!b) return {};
  const displayName = b.name ?? b.full_address;
  return {
    title: `Neighborhood Risks for ${displayName} | NYC`,
    description: `What's nearby at ${b.full_address} — shelters, sirens, brownfields, rats, and more within 0.75 mi.`,
    alternates: {
      canonical: canonicalUrl(
        cityPath(`/tenant-tools/neighborhood-risks/${buildingSlug}`, "nyc"),
      ),
    },
  };
}

export default async function NeighborhoodRisksResultsPage({
  params,
}: {
  params: Promise<{ city: string; buildingSlug: string }>;
}) {
  const { city, buildingSlug } = await params;
  if (!isValidCity(city) || city !== "nyc") notFound();
  const b = await getBuilding(buildingSlug);
  if (!b) notFound();

  const result = await fetchNeighborhoodRisks({
    id: b.id,
    name: b.name ?? b.full_address,
    address: b.full_address,
    borough: b.borough,
    neighborhood: b.neighborhood ?? "",
    lat: b.lat,
    lng: b.lng,
    slug: b.slug,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <NeighborhoodRisksHero result={result} />
      <NeighborhoodRisksJumpNav result={result} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {CATEGORY_ORDER.map((cat) => (
          <NeighborhoodRisksSection key={cat} category={cat} result={result} />
        ))}
        <div className="mt-12 bg-white border border-[#e2e8f0] rounded-xl p-5 text-xs text-[#64748b] leading-relaxed">
          <strong>About this report:</strong> Locations are aggregated from city data, DOB filings, and public advocacy directories. Family shelter addresses are intentionally protected by NYC DHS — this list may be incomplete. Sex offender data is sourced from the NYS DCJS registry and shown as counts only; for details, visit the official registry.
        </div>
      </main>
    </div>
  );
}
