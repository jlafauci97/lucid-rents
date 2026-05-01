import type { Metadata } from "next";
import Link from "next/link";
import { Wind, Search, ShieldCheck } from "lucide-react";
import { CITY_META, type City } from "@/lib/cities";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 86400; // 24h ISR

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  const meta = CITY_META[city as City];
  const cityName = meta?.fullName ?? "Los Angeles";
  const canonical = canonicalUrl(cityPath("/air-quality", city as City));
  return {
    title: `${cityName} Air Quality & Pollution by Address`,
    description: `Check pollution levels for any ${cityName} building using CalEnviroScreen data. See PM2.5, ozone, diesel particulate, traffic density, and health indicators by neighborhood.`,
    alternates: { canonical },
  };
}

export default async function AirQualityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: cityParam } = await params;
  const city = cityParam as City;
  const meta = CITY_META[city];
  const cityName = meta?.fullName ?? "Los Angeles";
  const supabase = await createClient();

  const { data: worstZips } = await supabase.from("calenviroscreen").select("zip_code, ces_percentile, pm25_percentile, ozone_percentile, traffic_percentile").gte("ces_percentile", 75).order("ces_percentile", { ascending: false }).limit(10);
  const { count: highPollutionBuildings } = await supabase.from("buildings").select("id", { count: "exact", head: true }).eq("metro", city).gte("calenviroscreen_percentile", 75);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-sky-900 to-slate-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: meta?.name ?? city, href: cityPath("", city) }, { label: "Air Quality", href: cityPath("/air-quality", city) }]} />
          <div className="max-w-3xl mt-4">
            <div className="flex items-center gap-2 text-sky-300 text-sm font-medium mb-3"><Wind className="w-4 h-4" />Air Quality & Pollution</div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">{cityName} Air Quality by Neighborhood</h1>
            <p className="text-sky-100 text-lg leading-relaxed">California&apos;s CalEnviroScreen ranks every census tract by pollution burden and health vulnerability. Check how your neighborhood scores before signing a lease.</p>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <section className="mb-10">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Check Any Building&apos;s Air Quality</h2>
            <Link href={cityPath("/search", city)} className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"><Search className="w-4 h-4" />Search Buildings</Link>
          </div>
        </section>
        <section className="mb-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5"><div className="text-3xl font-bold text-gray-900">{(highPollutionBuildings ?? 0).toLocaleString()}</div><p className="text-sm text-gray-500 mt-1">buildings in top 25% most polluted tracts</p></div>
            <div className="bg-white rounded-xl border border-gray-200 p-5"><div className="text-xl font-bold text-gray-900">CalEnviroScreen 4.0</div><p className="text-sm text-gray-500 mt-1">California EPA official data</p></div>
            <div className="bg-white rounded-xl border border-gray-200 p-5"><div className="flex items-center gap-2 mb-1"><ShieldCheck className="w-5 h-5 text-emerald-500" /><span className="text-sm font-medium text-gray-500">Indicators</span></div><div className="text-3xl font-bold text-gray-900">20+</div><p className="text-xs text-gray-400 mt-1">pollution & socioeconomic indicators</p></div>
          </div>
        </section>
        {worstZips && worstZips.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Most Burdened Zip Codes</h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr><th className="text-left px-4 py-3 font-medium text-gray-500">Zip Code</th><th className="text-left px-4 py-3 font-medium text-gray-500">Overall</th><th className="text-left px-4 py-3 font-medium text-gray-500">PM2.5</th><th className="text-left px-4 py-3 font-medium text-gray-500">Ozone</th><th className="text-left px-4 py-3 font-medium text-gray-500">Traffic</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {worstZips.map((z) => (
                    <tr key={z.zip_code} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium"><Link href={cityPath(`/neighborhood/${z.zip_code}`, city)} className="text-sky-600 hover:text-sky-800">{z.zip_code}</Link></td>
                      <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${(z.ces_percentile ?? 0) >= 90 ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>{z.ces_percentile?.toFixed(0)}th</span></td>
                      <td className="px-4 py-3 text-gray-600">{z.pm25_percentile?.toFixed(0) ?? "—"}th</td>
                      <td className="px-4 py-3 text-gray-600">{z.ozone_percentile?.toFixed(0) ?? "—"}th</td>
                      <td className="px-4 py-3 text-gray-600">{z.traffic_percentile?.toFixed(0) ?? "—"}th</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
