import type { Metadata } from "next";
import { ClipboardCheck, Bell, ExternalLink } from "lucide-react";
import { CITY_META, type City } from "@/lib/cities";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  const meta = CITY_META[city as City];
  const cityName = meta?.fullName ?? "Los Angeles";
  const canonical = canonicalUrl(cityPath("/rent-registry", city as City));
  return {
    title: `${cityName} Rent Registry — Track Rents by Building | Lucid Rents`,
    description: `Los Angeles passed a mandatory rent registry ordinance requiring landlords to register rents annually. Track registered rents by building when data becomes available.`,
    alternates: { canonical },
  };
}

export default async function RentRegistryPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: cityParam } = await params;
  const city = cityParam as City;
  const meta = CITY_META[city];
  const cityName = meta?.fullName ?? "Los Angeles";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-teal-900 to-emerald-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: meta?.name ?? city, href: cityPath("", city) }, { label: "Rent Registry", href: cityPath("/rent-registry", city) }]} />
          <div className="max-w-3xl mt-4">
            <div className="flex items-center gap-2 text-teal-300 text-sm font-medium mb-3"><ClipboardCheck className="w-4 h-4" />Rent Registry</div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">{cityName} Rent Registry</h1>
            <p className="text-teal-100 text-lg leading-relaxed">Los Angeles has passed a mandatory rent registry ordinance requiring landlords to report rents annually. When this data becomes publicly available, we&apos;ll integrate it here for every building.</p>
          </div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-50 text-teal-600 mb-4"><Bell className="w-8 h-8" /></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Coming Soon</h2>
          <p className="text-gray-600 max-w-lg mx-auto mb-6">LA&apos;s rent registry is being implemented. Once LAHD begins publishing registered rent data, we&apos;ll automatically integrate it into every building page.</p>
          <div className="inline-flex items-center gap-2 bg-teal-50 text-teal-700 px-4 py-2 rounded-full text-sm font-medium"><Bell className="w-4 h-4" />We&apos;re monitoring housing.lacity.gov for data availability</div>
        </div>
        <div className="bg-teal-50 rounded-2xl border border-teal-200 p-6">
          <h3 className="text-lg font-bold text-teal-900 mb-3">In the Meantime</h3>
          <p className="text-sm text-teal-800 mb-4">While we wait for the rent registry data, you can still check rent prices and RSO status for any building.</p>
          <div className="flex flex-wrap gap-3">
            <a href="https://housing.lacity.gov/rental-property-owners/rso-property-search" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">LAHD RSO Search <ExternalLink className="w-3.5 h-3.5" /></a>
            <a href={cityPath("/rent-stabilization", city)} className="inline-flex items-center gap-1.5 bg-white border border-teal-300 text-teal-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-50 transition-colors">RSO Checker</a>
          </div>
        </div>
      </div>
    </div>
  );
}
