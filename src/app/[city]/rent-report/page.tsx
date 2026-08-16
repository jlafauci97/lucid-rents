import type { Metadata } from "next";
import Link from "next/link";
import { FileBarChart } from "lucide-react";
import { CITY_META, VALID_CITIES, isValidCity, type City } from "@/lib/cities";
import { canonicalUrl, cityPath, cityBreadcrumbs } from "@/lib/seo";
import { getAllNeighborhoodsByCity, neighborhoodPageSlugByCity } from "@/lib/neighborhoods";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { getCityReportIndex, monthLabel } from "./_data";

export const revalidate = 86400;

export function generateStaticParams() {
  return VALID_CITIES.map((city) => ({ city }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city: cityParam } = await params;
  if (!isValidCity(cityParam)) return {};
  const city = cityParam as City;
  const meta = CITY_META[city];
  const url = canonicalUrl(cityPath("/rent-report", city));
  const title = `${meta.fullName} Monthly Rent Reports`;
  const description = `Monthly neighborhood rent reports for ${meta.fullName}: median asking rents by bedroom count, month-over-month and year-over-year changes, and listing volume for every tracked zip code.`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "Lucid Rents", type: "website", locale: "en_US" },
  };
}

export default async function RentReportHubPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: cityParam } = await params;
  const city = cityParam as City;
  const meta = CITY_META[city];

  const index = await getCityReportIndex(city);
  const neighborhoods = getAllNeighborhoodsByCity(city);

  const breadcrumbs = cityBreadcrumbs(city, {
    label: "Rent Reports",
    href: cityPath("/rent-report", city),
  });

  // Group covered neighborhoods by region (borough/area), latest month only.
  const byRegion = new Map<string, { zip: string; name: string; months: string[] }[]>();
  let coveredCount = 0;
  if (index) {
    for (const n of neighborhoods) {
      const months = index.zipMonths[n.zipCode];
      if (!months || !months.includes(index.latestMonth)) continue;
      coveredCount++;
      const list = byRegion.get(n.region) ?? [];
      list.push({ zip: n.zipCode, name: n.name, months });
      byRegion.set(n.region, list);
    }
    for (const list of byRegion.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name) || a.zip.localeCompare(b.zip));
    }
  }
  const regions = Array.from(byRegion.keys()).sort();
  const priorMonths = index ? index.months.slice(1) : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${meta.fullName} Monthly Rent Reports`,
          description: `Index of monthly neighborhood rent reports for ${meta.fullName}, with median asking rents by bedroom count and month-over-month changes.`,
          url: canonicalUrl(cityPath("/rent-report", city)),
          publisher: { "@type": "Organization", name: "Lucid Rents", url: "https://lucidrents.com" },
        }}
      />
      <Breadcrumbs items={breadcrumbs} />

      <div className="mt-6 mb-8">
        <div className="flex items-center gap-2 text-[#3B82F6] text-sm font-medium mb-2">
          <FileBarChart className="w-4 h-4" />
          Monthly Rent Reports
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
          {meta.fullName} Monthly Rent Reports
        </h1>
        <p className="text-[#64748b] mt-1 max-w-3xl">
          Dated, citable rent snapshots for every tracked {meta.fullName} neighborhood: median asking rent by
          bedroom count, month-over-month and year-over-year changes, price spreads, and listing volume.
        </p>
        {index && (
          <p className="text-sm text-[#475569] mt-3">
            Latest reports: <span className="font-semibold text-[#0F1D2E]">{monthLabel(index.latestMonth)}</span>
            {" · "}
            {coveredCount.toLocaleString()} neighborhood{coveredCount !== 1 ? "s" : ""} covered
          </p>
        )}
      </div>

      {!index || coveredCount === 0 ? (
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-8 text-center text-[#64748b]">
          No rent reports are available for {meta.fullName} yet. Check back soon.
        </div>
      ) : (
        <>
          {regions.map((region) => (
            <section key={region} className="mb-8">
              <h2 className="text-lg font-bold text-[#0F1D2E] mb-3">{region}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {byRegion.get(region)!.map((n) => {
                  const reportSlug = neighborhoodPageSlugByCity(n.zip, city);
                  const prior = priorMonths.filter((m) => n.months.includes(m));
                  return (
                    <div key={n.zip} className="bg-white rounded-xl border border-[#e2e8f0] p-4">
                      <Link
                        href={cityPath(`/rent-report/${reportSlug}/${index.latestMonth}`, city)}
                        className="font-semibold text-[#0F1D2E] hover:text-[#3B82F6] transition-colors"
                      >
                        {n.name} ({n.zip})
                      </Link>
                      <p className="text-xs text-[#94a3b8] mt-1">
                        {monthLabel(index.latestMonth)} report
                        {prior.length > 0 && (
                          <>
                            {" · earlier: "}
                            {prior.map((m, i) => (
                              <span key={m}>
                                {i > 0 && ", "}
                                <Link
                                  href={cityPath(`/rent-report/${reportSlug}/${m}`, city)}
                                  className="text-[#3B82F6] hover:underline"
                                >
                                  {monthLabel(m)}
                                </Link>
                              </span>
                            ))}
                          </>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          <p className="text-xs text-[#94a3b8]">
            Reports are generated from listing data and refresh as new months of data arrive. Neighborhoods
            without enough listings in a given month are omitted for that month.
          </p>
        </>
      )}
    </div>
  );
}
