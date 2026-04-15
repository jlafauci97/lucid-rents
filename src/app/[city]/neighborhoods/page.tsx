/**
 * City-scoped neighborhoods index page.
 *
 * Lists every neighborhood we track for the city, grouped by borough/region,
 * each linking to the existing per-neighborhood slug page. Referenced by the
 * site's main nav (`cityPath("/neighborhoods", city)`) — before this route
 * existed, that link 404'd.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { CITY_META, VALID_CITIES, type City } from "@/lib/cities";
import { getAllNeighborhoodsByCity, neighborhoodPageSlugByCity } from "@/lib/neighborhoods";
import { canonicalUrl, neighborhoodsUrl } from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

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

  // Group by region (borough / city-area).
  const byRegion = new Map<string, Array<{ zipCode: string; name: string }>>();
  for (const n of all) {
    const arr = byRegion.get(n.region) ?? [];
    arr.push({ zipCode: n.zipCode, name: n.name });
    byRegion.set(n.region, arr);
  }
  // Sort regions alphabetically; neighborhoods inside each region alphabetically.
  const regions = [...byRegion.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [, arr] of regions) arr.sort((a, b) => a.name.localeCompare(b.name));

  const totalCount = all.length;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <Breadcrumbs
        items={[
          { label: meta.fullName, href: `/${meta.urlPrefix}` },
          { label: "Neighborhoods", href: `/${meta.urlPrefix}/neighborhoods` },
        ]}
      />

      <header className="mt-6 mb-8 pb-6 border-b border-[#e2e8f0]">
        <h1 className="text-4xl font-bold text-[#0F1D2E] tracking-tight">
          {meta.fullName} neighborhoods
        </h1>
        <p className="mt-3 text-[#475569] max-w-2xl">
          {totalCount.toLocaleString()} neighborhoods across {regions.length} {meta.regionLabel.toLowerCase()}{regions.length === 1 ? "" : "s"}.
          Each card links to a full neighborhood report with building grades, crime data, and median rents.
        </p>
      </header>

      <div className="space-y-10">
        {regions.map(([region, nbhs]) => (
          <section key={region}>
            <h2 className="text-xl font-semibold text-[#0F1D2E] mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#3B82F6]" aria-hidden="true" />
              {region}
              <span className="text-sm font-normal text-[#64748b]">· {nbhs.length} neighborhood{nbhs.length === 1 ? "" : "s"}</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {nbhs.map((n) => {
                const slug = neighborhoodPageSlugByCity(n.zipCode, c);
                return (
                  <Link
                    key={n.zipCode}
                    href={`/${meta.urlPrefix}/neighborhood/${slug}`}
                    className="group flex items-center justify-between gap-3 p-4 bg-white border border-[#e2e8f0] rounded-lg hover:border-[#3B82F6] hover:shadow-sm transition"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-[#0F1D2E] truncate group-hover:text-[#3B82F6] transition">{n.name}</div>
                      <div className="text-xs text-[#64748b] font-mono mt-0.5">{n.zipCode}</div>
                    </div>
                    <span className="text-[#94a3b8] group-hover:text-[#3B82F6] transition" aria-hidden="true">→</span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
