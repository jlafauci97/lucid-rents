/**
 * City-scoped neighborhoods index page.
 *
 * Lists every neighborhood we track for the city, grouped by borough/region,
 * each linking to the existing per-neighborhood slug page. Referenced by the
 * site's main nav (`cityPath("/neighborhoods", city)`) — before this route
 * existed, that link 404'd.
 *
 * Filtering (live search that promotes matches to the top) is handled by the
 * client-side <NeighborhoodsFilter /> below.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CITY_META, VALID_CITIES, type City } from "@/lib/cities";
import { getAllNeighborhoodsByCity, neighborhoodPageSlugByCity } from "@/lib/neighborhoods";
import { canonicalUrl, neighborhoodsUrl } from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { NeighborhoodsFilter } from "./NeighborhoodsFilter";

export const revalidate = 86400;

interface Props {
  params: Promise<{ city: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  if (!VALID_CITIES.includes(city as City)) {
    return { title: "Neighborhoods" };
  }
  const c = city as City;
  const meta = CITY_META[c];
  return {
    title: `${meta.fullName} Neighborhoods — Building Grades & Rent by Area`,
    description: `Every neighborhood we track in ${meta.fullName}. Compare rents, building grades, crime stats, and landlord quality by area.`,
    alternates: { canonical: canonicalUrl(neighborhoodsUrl(c)) },
  };
}

export default async function NeighborhoodsIndexPage({ params }: Props) {
  const { city } = await params;
  if (!VALID_CITIES.includes(city as City)) notFound();
  const c = city as City;
  const meta = CITY_META[c];

  const all = getAllNeighborhoodsByCity(c);
  if (!all.length) notFound();

  // Pre-compute slugs so the client filter doesn't need the neighborhood helper.
  const items = all.map((n) => ({
    zipCode: n.zipCode,
    name: n.name,
    region: n.region,
    slug: neighborhoodPageSlugByCity(n.zipCode, c),
  }));
  const regionsCount = new Set(items.map((i) => i.region)).size;
  const totalCount = items.length;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs
        items={[
          { label: meta.fullName, href: `/${meta.urlPrefix}` },
          { label: "Neighborhoods", href: `/${meta.urlPrefix}/neighborhoods` },
        ]}
      />

      <header className="mt-6 mb-4 pb-6 border-b border-[#e2e8f0]">
        <h1 className="text-4xl font-bold text-[#0F1D2E] tracking-tight">
          {meta.fullName} neighborhoods
        </h1>
        <p className="mt-3 text-[#475569] max-w-2xl">
          {totalCount.toLocaleString()} neighborhoods across {regionsCount} {meta.regionLabel.toLowerCase()}{regionsCount === 1 ? "" : "s"}.
          Each card links to a full neighborhood report with building grades, crime data, and median rents.
        </p>
      </header>

      <NeighborhoodsFilter
        cityPrefix={meta.urlPrefix}
        regionLabel={meta.regionLabel}
        items={items}
      />
    </main>
  );
}
