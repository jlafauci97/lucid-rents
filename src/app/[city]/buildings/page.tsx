import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Building2, AlertTriangle, MessageSquare, Users, ShieldAlert, MapPin, TrendingDown } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { BOROUGH_SLUGS, regionSlug, canonicalUrl, cityPath } from "@/lib/seo";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import type { Metadata } from "next";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  return {
    title: `${meta.fullName} Buildings Directory | Lucid Rents`,
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

interface BoroughStats {
  borough: string;
  count: number;
  total_violations: number;
  total_complaints: number;
}

async function getBoroughStats(city: City): Promise<BoroughStats[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Single RPC call replaces N sequential fetches of 50K+ rows each
  const res = await fetch(
    `${supabaseUrl}/rest/v1/rpc/borough_stats_by_city`,
    {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ target_metro: city }),
      next: { revalidate: 3600 },
    }
  );

  if (!res.ok) return [];
  const data = await res.json();

  return (data || []).map((row: { borough: string; building_count: number; total_violations: number; total_complaints: number }) => ({
    borough: row.borough,
    count: Number(row.building_count),
    total_violations: Number(row.total_violations),
    total_complaints: Number(row.total_complaints),
  }));
}

export default async function BuildingsIndexPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const meta = CITY_META[city as City] || CITY_META.nyc;
  const stats = await getBoroughStats(city as City);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${meta.fullName} Building Directories`,
    numberOfItems: stats.length,
    itemListElement: stats.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${s.borough} Buildings`,
      url: canonicalUrl(cityPath(`/buildings/${regionSlug(s.borough)}`, city as City)),
    })),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Buildings", href: cityPath("/buildings", city as City) }]} />

      <h1 className="text-3xl font-bold text-[#0F1D2E] mt-6 mb-2">
        {meta.fullName} Buildings Directory
      </h1>
      <p className="text-[#64748b] mb-8">
        Browse apartment buildings across {meta.fullName}. View violations, complaints, and tenant reviews.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((s) => (
          <Link key={s.borough} href={cityPath(`/buildings/${regionSlug(s.borough)}`, city as City)}>
            <Card hover>
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-[#0F1D2E] mb-4">
                  {s.borough}
                </h2>
                <div className="space-y-2 text-sm text-[#64748b]">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <span>{s.count.toLocaleString()} buildings</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span>{s.total_violations.toLocaleString()} violations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-amber-500" />
                    <span>{s.total_complaints.toLocaleString()} complaints</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Cross-links to related sections */}
      <section className="mt-12">
        <h2 className="text-xl font-bold text-[#0F1D2E] mb-4">Explore More</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href={cityPath("/worst-rated-buildings", city as City)}
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
