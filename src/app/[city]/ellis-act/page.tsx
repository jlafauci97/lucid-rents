import type { Metadata } from "next";
import Link from "next/link";
import { Ban, Search, ExternalLink, AlertTriangle } from "lucide-react";
import { CITY_META, type City } from "@/lib/cities";
import { canonicalUrl, cityPath, buildingUrl } from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  const meta = CITY_META[city as City];
  const cityName = meta?.fullName ?? "Los Angeles";
  const canonical = canonicalUrl(cityPath("/ellis-act", city as City));
  return {
    title: `${cityName} Ellis Act Evictions — Lookup by Building`,
    description: `Check if a ${cityName} building has been subject to Ellis Act evictions. Research building history before signing a lease.`,
    alternates: { canonical },
  };
}

export default async function EllisActPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: cityParam } = await params;
  const city = cityParam as City;
  const meta = CITY_META[city];
  const cityName = meta?.fullName ?? "Los Angeles";
  const supabase = await createClient();

  const { data: ellisBuildings, count: totalEllis } = await supabase.from("buildings").select("id, full_address, borough, slug, ellis_act_date, residential_units, year_built", { count: "exact" }).eq("metro", city).eq("ellis_act_filing", true).order("ellis_act_date", { ascending: false }).limit(20);
  const { count: ellisEvictionCount } = await supabase.from("lahd_evictions").select("id", { count: "exact", head: true }).eq("metro", "los-angeles").ilike("eviction_category", "%Ellis%");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-rose-900 to-slate-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: meta?.name ?? city, href: cityPath("", city) }, { label: "Ellis Act Lookup", href: cityPath("/ellis-act", city) }]} />
          <div className="max-w-3xl mt-4">
            <div className="flex items-center gap-2 text-rose-300 text-sm font-medium mb-3"><Ban className="w-4 h-4" />Ellis Act Lookup</div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">{cityName} Ellis Act Eviction History</h1>
            <p className="text-rose-100 text-lg leading-relaxed">The Ellis Act allows landlords to permanently remove rental units from the market. Check if a building has Ellis Act history before you sign a lease.</p>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <section className="mb-10">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Check Any Building</h2>
            <Link href={cityPath("/search", city)} className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"><Search className="w-4 h-4" />Search Buildings</Link>
          </div>
        </section>
        <section className="mb-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5"><div className="text-3xl font-bold text-rose-600">{totalEllis ?? 0}</div><p className="text-sm text-gray-500 mt-1">Buildings with Ellis Act filings</p></div>
            <div className="bg-white rounded-xl border border-gray-200 p-5"><div className="text-3xl font-bold text-gray-900">{ellisEvictionCount ?? 0}</div><p className="text-sm text-gray-500 mt-1">LAHD Ellis Act eviction notices</p></div>
            <div className="bg-white rounded-xl border border-gray-200 p-5"><div className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" /><span className="text-sm font-medium text-gray-500">Why It Matters</span></div><p className="text-xs text-gray-600 mt-2">Buildings with prior Ellis Act filings may file again, displacing all tenants.</p></div>
          </div>
        </section>
        {ellisBuildings && ellisBuildings.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Ellis Act Filings</h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr><th className="text-left px-4 py-3 font-medium text-gray-500">Address</th><th className="text-left px-4 py-3 font-medium text-gray-500">Area</th><th className="text-left px-4 py-3 font-medium text-gray-500">Date</th><th className="text-right px-4 py-3 font-medium text-gray-500">Units</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {ellisBuildings.map((b) => (<tr key={b.id} className="hover:bg-gray-50"><td className="px-4 py-3"><Link href={buildingUrl(b, city)} className="font-medium text-rose-600 hover:text-rose-800">{b.full_address.split(",")[0]}</Link></td><td className="px-4 py-3 text-gray-600">{b.borough}</td><td className="px-4 py-3 text-gray-600">{b.ellis_act_date ? new Date(b.ellis_act_date).toLocaleDateString() : "—"}</td><td className="px-4 py-3 text-right text-gray-600">{b.residential_units ?? "—"}</td></tr>))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          <div className="bg-white rounded-xl border border-gray-200 p-6"><h3 className="text-lg font-bold text-gray-900 mb-3">What is the Ellis Act?</h3><p className="text-sm text-gray-600 leading-relaxed mb-3">The Ellis Act allows landlords to &quot;go out of the rental business&quot; by evicting all tenants and withdrawing rental units from the market.</p><a href="https://hcidla.lacity.gov/ellis-act" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-rose-600 hover:text-rose-800">LAHD Ellis Act Info <ExternalLink className="w-3.5 h-3.5" /></a></div>
          <div className="bg-white rounded-xl border border-gray-200 p-6"><h3 className="text-lg font-bold text-gray-900 mb-3">Your Rights</h3><div className="space-y-2 text-sm text-gray-600"><p><strong>120-day notice</strong> required (1 year for seniors/disabled).</p><p><strong>Relocation assistance</strong> — you&apos;re entitled to relocation payments.</p><p><strong>Right of return</strong> — if units re-rented within 10 years, former tenants have priority.</p></div></div>
        </section>
      </div>
    </div>
  );
}
