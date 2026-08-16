import { notFound } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { createCacheClient } from "@/lib/supabase/cache-client";
import { BuildingCard } from "@/components/search/BuildingCard";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { SLUG_TO_BOROUGH, canonicalUrl, buildingUrl, cityPath } from "@/lib/seo";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { BoroughExploreLinks } from "@/components/seo/BoroughExploreLinks";
import { FAQSection } from "@/components/seo/FAQSection";
import { generateBoroughFAQ } from "@/lib/faq/area-faq";
import { CITY_META, type City } from "@/lib/cities";
import { BestApartments } from "@/components/neighborhood/BestApartments";
import type { Building } from "@/types";
import type { Metadata } from "next";

export const PAGE_SIZE = 25;

// Path helper shared by the base route (page 1) and /page/[n] (page 2+).
// Page 1 lives at the bare borough URL; /page/1 301s to it in proxy.ts.
export function boroughPagePath(city: City, boroughSlug: string, page: number): string {
  const base = cityPath(`/buildings/${boroughSlug}`, city);
  return page <= 1 ? base : `${base}/page/${page}`;
}

/** Metadata for a listing page. Every page is self-canonical — the fake
 * ?page=N era canonicalized everything to the base URL, which told Google
 * the deeper pages were duplicates and kept the corpus link-orphaned. */
export function boroughListingMetadata(cityParam: string, boroughSlug: string, page: number): Metadata {
  const borough = SLUG_TO_BOROUGH[boroughSlug];
  if (!borough) return { title: "Not Found" };
  const city = cityParam as City;

  const title = page <= 1 ? `${borough} Buildings` : `${borough} Buildings — Page ${page}`;
  const description = `Apartment hunting in ${borough}? Browse every building with violation scores, complaint history, and real tenant reviews.`;
  const url = canonicalUrl(boroughPagePath(city, boroughSlug, page));

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Lucid Rents",
      type: "website",
    },
  };
}

export async function BoroughListing({
  cityParam,
  boroughSlug,
  page,
}: {
  cityParam: string;
  boroughSlug: string;
  page: number;
}) {
  const borough = SLUG_TO_BOROUGH[boroughSlug];
  if (!borough) notFound();
  const city = cityParam as City;
  const offset = (page - 1) * PAGE_SIZE;
  const sortColumn = "violation_count";

  let total = 0;
  let buildingList: Building[] = [];

  try {
    const supabase = createCacheClient();

    // Get total count and paginated buildings in parallel.
    // `count: "planned"` uses the planner's row-estimate instead of running
    // a real COUNT(*) — instant vs. multi-second on filtered borough queries.
    // Approximate, but plenty accurate for "N buildings" UI + pagination.
    const [countRes, buildingsRes] = await Promise.all([
      supabase
        .from("buildings")
        .select("id", { count: "planned", head: true })
        .eq("borough", borough)
        .eq("metro", cityParam),
      supabase
        .from("buildings")
        .select("*")
        .eq("borough", borough)
        .eq("metro", cityParam)
        .order(sortColumn, { ascending: false, nullsFirst: false })
        .range(offset, offset + PAGE_SIZE - 1),
    ]);

    buildingList = (buildingsRes.data || []) as Building[];
    // Floor the count by (offset + rows returned) so pagination never reports
    // fewer pages than we've already proven to exist, even if the planner's
    // row-estimate comes back low.
    total = Math.max(countRes.count || 0, offset + buildingList.length);
  } catch (err) {
    console.error("BoroughListing query error:", err);
  }

  // A deep page past the real end of the list (planner estimates overshoot)
  // must 404, not render an empty self-canonical page.
  if (page > 1 && buildingList.length === 0) notFound();

  // Best-apartments tiers are page-1 only: repeating them on every deep page
  // would duplicate a large content block across the whole pagination set.
  let bestApartmentTiers: { label: string; max: number; buildings: { id: string; full_address: string; borough: string; slug: string; overall_score: number | null; median_rent: number; buildingUrl: string }[] }[] = [];
  if (page === 1) {
    try {
      const supabase = createCacheClient();
      const PRICE_TIERS = [
        { label: "$1.5K", max: 1500 },
        { label: "$2K", max: 2000 },
        { label: "$2.5K", max: 2500 },
        { label: "$3K", max: 3000 },
      ];
      const { data: rentData } = await supabase
        .from("building_rents")
        .select("building_id, median_rent, buildings!inner(id, full_address, borough, slug, metro, overall_score)")
        .eq("buildings.borough", borough)
        .eq("buildings.metro", cityParam)
        .gt("median_rent", 0)
        .order("median_rent", { ascending: true })
        .limit(500);

      const seen = new Set<string>();
      const allWithRent = ((rentData || []) as unknown as { building_id: string; median_rent: number; buildings: { id: string; full_address: string; borough: string; slug: string; metro: string; overall_score: number | null } }[])
        .filter((r) => {
          if (seen.has(r.building_id)) return false;
          seen.add(r.building_id);
          return true;
        })
        .map((r) => ({
          id: r.buildings.id,
          full_address: r.buildings.full_address,
          borough: r.buildings.borough,
          slug: r.buildings.slug,
          overall_score: r.buildings.overall_score,
          median_rent: r.median_rent,
          buildingUrl: buildingUrl(r.buildings, city),
        }))
        .sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0));

      bestApartmentTiers = PRICE_TIERS.map((tier) => ({
        ...tier,
        buildings: allWithRent.filter((b) => b.median_rent <= tier.max).slice(0, 5),
      }));
    } catch {
      // Non-critical
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const prevUrl = page > 1 ? canonicalUrl(boroughPagePath(city, boroughSlug, page - 1)) : null;
  const nextUrl = page < totalPages ? canonicalUrl(boroughPagePath(city, boroughSlug, page + 1)) : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: page <= 1 ? `${borough} Buildings` : `${borough} Buildings — Page ${page}`,
    numberOfItems: total,
    itemListElement: buildingList.map((b, i) => ({
      "@type": "ListItem",
      position: offset + i + 1,
      name: b.full_address,
      url: canonicalUrl(buildingUrl(b, city)),
    })),
  };

  return (
    <AdSidebar>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {prevUrl && <link rel="prev" href={prevUrl} />}
      {nextUrl && <link rel="next" href={nextUrl} />}
      <JsonLd data={jsonLd} />
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Buildings", href: cityPath("/buildings", city) },
          { label: borough, href: cityPath(`/buildings/${boroughSlug}`, city) },
          ...(page > 1 ? [{ label: `Page ${page}`, href: boroughPagePath(city, boroughSlug, page) }] : []),
        ]}
      />

      <h1 className="text-3xl font-bold text-[#0F1D2E] mt-6 mb-2">
        {borough} Buildings{page > 1 ? ` — Page ${page}` : ""}
      </h1>
      <p className="text-[#64748b] mb-6">
        {total.toLocaleString()} buildings in {borough}
      </p>

      <div className="space-y-3">
        {buildingList.map((building) => (
          <BuildingCard key={building.id} building={building} />
        ))}
      </div>

      {/* Pagination — real path-segment pages, each ISR-cached and
          self-canonical, so crawlers can walk the whole corpus. */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {page > 1 && (
            <Link
              href={boroughPagePath(city, boroughSlug, page - 1)}
              className="px-4 py-2 rounded-lg bg-gray-100 text-sm font-medium text-[#0F1D2E] hover:bg-gray-200 transition-colors"
            >
              Previous
            </Link>
          )}
          <span className="px-4 py-2 text-sm text-[#64748b]">
            Page {page} of {totalPages.toLocaleString()}
          </span>
          {page < totalPages && (
            <Link
              href={boroughPagePath(city, boroughSlug, page + 1)}
              className="px-4 py-2 rounded-lg bg-gray-100 text-sm font-medium text-[#0F1D2E] hover:bg-gray-200 transition-colors"
            >
              Next
            </Link>
          )}
        </div>
      )}
      {/* Page-1-only content blocks (avoid duplicating across the set) */}
      {page === 1 && bestApartmentTiers.some((t) => t.buildings.length > 0) && (
        <BestApartments tiers={bestApartmentTiers} areaName={borough} />
      )}

      {page === 1 && (
        <>
          {/* Cross-links: neighborhoods, landlords, explore */}
          <Suspense fallback={null}>
            <BoroughExploreLinks borough={borough} boroughSlug={boroughSlug} />
          </Suspense>

          <FAQSection
            items={generateBoroughFAQ({
              borough,
              total,
              cityName: CITY_META[cityParam as keyof typeof CITY_META]?.name || "New York City",
            })}
            title={`Frequently Asked Questions About ${borough}`}
          />
        </>
      )}
    </div>
    </AdSidebar>
  );
}
