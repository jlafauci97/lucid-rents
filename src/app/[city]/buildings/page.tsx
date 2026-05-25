import { Suspense } from "react";
import Link from "next/link";
import { Users, ShieldAlert, MapPin, TrendingDown } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { SearchBar } from "@/components/search/SearchBar";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { VALID_CITIES, isValidCity, CITY_META, type City } from "@/lib/cities";
import type { Metadata } from "next";
import { BoroughGrid } from "./BoroughGrid";
import { BoroughGridSkeleton } from "./BoroughGridSkeleton";

export const revalidate = 3600;


export function generateStaticParams() {
  return VALID_CITIES.map((city) => ({ city }));
}
export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  return {
    title: `${meta.fullName} Buildings Directory`,
    description: `Every apartment building in ${meta.fullName} — searchable by borough, with violations, complaints, and tenant reviews at a glance.`,
    alternates: { canonical: canonicalUrl(cityPath("/buildings", city)) },
    openGraph: {
      title: `${meta.fullName} Buildings Directory | Lucid Rents`,
      description: `Every apartment building in ${meta.fullName} — violations, complaints, and tenant reviews at a glance.`,
      url: canonicalUrl(cityPath("/buildings", city)),
      siteName: "Lucid Rents",
      type: "website",
    },
  };
}

export default async function BuildingsIndexPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const meta = CITY_META[city as City] || CITY_META.nyc;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Buildings", href: cityPath("/buildings", city as City) }]} />

      <h1 className="text-3xl font-bold text-[#0F1D2E] mt-6 mb-2">
        {meta.fullName} Buildings Directory
      </h1>
      <p className="text-[#64748b] mb-6">
        Search any building in {meta.fullName} by address, neighborhood, or zip — or browse by {meta.fullName === "New York City" ? "borough" : "area"} below.
      </p>

      {/* Address search — instant autocomplete + jump to building, neighborhood, or full results */}
      <div className="mb-10">
        <SearchBar
          size="hero"
          placeholder={`Search ${meta.fullName} buildings by address, neighborhood, or zip…`}
        />
      </div>

      <h2 className="text-sm font-semibold uppercase tracking-wider text-[#64748b] mb-4">
        Browse by {meta.fullName === "New York City" ? "borough" : "area"}
      </h2>
      {/* Borough grid — streamed via Suspense so the search bar + cross-links paint first. */}
      <Suspense fallback={<BoroughGridSkeleton />}>
        <BoroughGrid city={city as City} />
      </Suspense>

      {/* Cross-links to related sections */}
      <section className="mt-12">
        <h2 className="text-xl font-bold text-[#0F1D2E] mb-4">Explore More</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href={cityPath("/building-rankings", city as City)}
            className="group flex items-center gap-3 p-4 bg-white border border-[#e2e8f0] rounded-xl hover:shadow-md hover:border-red-300 transition-all"
          >
            <div className="p-2 rounded-lg bg-red-50">
              <TrendingDown className="w-5 h-5 text-[#ef4444]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0F1D2E] group-hover:text-[#ef4444] transition-colors">Worst Rated Buildings</p>
              <p className="text-xs text-[#64748b]">Ranked by violations</p>
            </div>
          </Link>

          <Link
            href={cityPath("/landlords", city as City)}
            className="group flex items-center gap-3 p-4 bg-white border border-[#e2e8f0] rounded-xl hover:shadow-md hover:border-purple-300 transition-all"
          >
            <div className="p-2 rounded-lg bg-purple-50">
              <Users className="w-5 h-5 text-[#8B5CF6]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0F1D2E] group-hover:text-[#8B5CF6] transition-colors">Landlord Directory</p>
              <p className="text-xs text-[#64748b]">Search by owner name</p>
            </div>
          </Link>

          <Link
            href={cityPath("/crime", city as City)}
            className="group flex items-center gap-3 p-4 bg-white border border-[#e2e8f0] rounded-xl hover:shadow-md hover:border-amber-300 transition-all"
          >
            <div className="p-2 rounded-lg bg-amber-50">
              <ShieldAlert className="w-5 h-5 text-[#d97706]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0F1D2E] group-hover:text-[#d97706] transition-colors">Crime Data</p>
              <p className="text-xs text-[#64748b]">Safety by zip code</p>
            </div>
          </Link>

          <Link
            href={cityPath("/rent-data", city as City)}
            className="group flex items-center gap-3 p-4 bg-white border border-[#e2e8f0] rounded-xl hover:shadow-md hover:border-emerald-300 transition-all"
          >
            <div className="p-2 rounded-lg bg-emerald-50">
              <MapPin className="w-5 h-5 text-[#10b981]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0F1D2E] group-hover:text-[#10b981] transition-colors">Rent Data</p>
              <p className="text-xs text-[#64748b]">Market prices by area</p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
