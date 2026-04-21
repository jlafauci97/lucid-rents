import type { Metadata } from "next";
import Link from "next/link";
import { Flame, ShieldCheck, AlertTriangle, ExternalLink, Search } from "lucide-react";
import { CITY_META, type City } from "@/lib/cities";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  const meta = CITY_META[city as City];
  const cityName = meta?.fullName ?? "Los Angeles";
  const canonical = canonicalUrl(cityPath("/fire-safety", city as City));
  return {
    title: `${cityName} Wildfire Risk Checker — Fire Hazard Zones | Lucid Rents`,
    description: `Check if your building is in a Very High Fire Hazard Severity Zone in ${cityName}. See CAL FIRE data, FAIR Plan insurance risk, and soft-story retrofit status.`,
    alternates: { canonical },
  };
}

export default async function FireSafetyPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: cityParam } = await params;
  const city = cityParam as City;
  const meta = CITY_META[city];
  const cityName = meta?.fullName ?? "Los Angeles";
  const supabase = await createClient();

  const { count: vhfhszCount } = await supabase.from("buildings").select("id", { count: "exact", head: true }).eq("metro", city).eq("fire_hazard_zone", "VHFHSZ");
  const { count: fairPlanCount } = await supabase.from("buildings").select("id", { count: "exact", head: true }).eq("metro", city).eq("fair_plan_risk", true);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-red-900 via-orange-900 to-amber-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: meta?.name ?? city, href: cityPath("", city) }, { label: "Fire Safety", href: cityPath("/fire-safety", city) }]} />
          <div className="max-w-3xl mt-4">
            <div className="flex items-center gap-2 text-orange-300 text-sm font-medium mb-3"><Flame className="w-4 h-4" />Wildfire Risk Checker</div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">{cityName} Wildfire Risk & Fire Safety</h1>
            <p className="text-orange-100 text-lg leading-relaxed">After the devastating January 2025 wildfires, knowing your building&apos;s fire risk is essential. Check fire hazard zones, insurance availability, and seismic retrofit status for any {cityName} address.</p>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <section className="mb-10">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Check Any Building</h2>
            <p className="text-gray-500 text-sm mb-4">Search for a building to see its fire hazard zone, FAIR Plan insurance risk, and safety status.</p>
            <Link href={cityPath("/search", city)} className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"><Search className="w-4 h-4" />Search Buildings</Link>
          </div>
        </section>
        <section className="mb-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5"><div className="flex items-center gap-2 mb-2"><Flame className="w-5 h-5 text-red-500" /><span className="text-sm font-medium text-gray-500">Very High Fire Hazard Zone</span></div><div className="text-3xl font-bold text-gray-900">{(vhfhszCount ?? 0).toLocaleString()}</div><p className="text-xs text-gray-400 mt-1">buildings in VHFHSZ areas</p></div>
            <div className="bg-white rounded-xl border border-gray-200 p-5"><div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-5 h-5 text-amber-500" /><span className="text-sm font-medium text-gray-500">FAIR Plan Risk</span></div><div className="text-3xl font-bold text-gray-900">{(fairPlanCount ?? 0).toLocaleString()}</div><p className="text-xs text-gray-400 mt-1">buildings may need FAIR Plan insurance</p></div>
            <div className="bg-white rounded-xl border border-gray-200 p-5"><div className="flex items-center gap-2 mb-2"><ShieldCheck className="w-5 h-5 text-emerald-500" /><span className="text-sm font-medium text-gray-500">Fire Zones Tracked</span></div><div className="text-3xl font-bold text-gray-900">5</div><p className="text-xs text-gray-400 mt-1">hazard categories monitored per building</p></div>
          </div>
        </section>
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          <div className="bg-white rounded-xl border border-gray-200 p-6"><h3 className="text-lg font-bold text-gray-900 mb-3">What is a Fire Hazard Severity Zone?</h3><p className="text-sm text-gray-600 leading-relaxed mb-3">CAL FIRE designates Fire Hazard Severity Zones (FHSZ) based on terrain, vegetation, weather patterns, and fire history. Zones are rated as <strong>Moderate</strong>, <strong>High</strong>, or <strong>Very High</strong> severity.</p><a href="https://osfm.fire.ca.gov/what-we-do/community-wildfire-preparedness-and-mitigation/fire-hazard-severity-zones" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-800">CAL FIRE FHSZ Maps <ExternalLink className="w-3.5 h-3.5" /></a></div>
          <div className="bg-white rounded-xl border border-gray-200 p-6"><h3 className="text-lg font-bold text-gray-900 mb-3">What is the California FAIR Plan?</h3><p className="text-sm text-gray-600 leading-relaxed mb-3">The California FAIR Plan is the state&apos;s insurer of last resort. When buildings in high fire risk areas can&apos;t get standard insurance, they may need to use the FAIR Plan, which typically offers less coverage at higher premiums.</p><a href="https://www.cfpnet.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-800">California FAIR Plan <ExternalLink className="w-3.5 h-3.5" /></a></div>
        </section>
        <section className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-6 mb-10">
          <h3 className="text-lg font-bold text-amber-900 mb-3">After the January 2025 Wildfires</h3>
          <div className="text-sm text-amber-800 space-y-2">
            <p>The Palisades and Eaton fires displaced thousands of LA residents and destroyed over 12,000 structures.</p>
            <p><strong>Price gouging protections</strong> are in effect for fire-affected areas. Landlords cannot raise rent more than 10% above pre-disaster levels during the state of emergency.</p>
            <p><strong>Eviction protections</strong> apply to tenants whose income was affected by the fires through July 2025.</p>
          </div>
          <div className="mt-4"><a href="https://housing.lacity.gov/renter-protections-2" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">LAHD Renter Protections <ExternalLink className="w-3.5 h-3.5" /></a></div>
        </section>
      </div>
    </div>
  );
}
