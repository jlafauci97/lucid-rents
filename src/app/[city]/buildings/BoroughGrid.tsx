import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Building2, AlertTriangle, MessageSquare } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { regionSlug, canonicalUrl, cityPath } from "@/lib/seo";
import { CITY_META, type City } from "@/lib/cities";

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

export async function BoroughGrid({ city }: { city: City }) {
  const meta = CITY_META[city] || CITY_META.nyc;
  const allStats = await getBoroughStats(city);

  // Restrict to canonical regions for this city — buildings table contains
  // metro-wide rows (e.g. NYC includes Long Island, NJ, Westchester) so we
  // filter to the 5 boroughs / official neighborhoods here.
  const validRegions = new Set<string>(meta.regions);
  const stats = allStats.filter((s) => validRegions.has(s.borough));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${meta.fullName} Building Directories`,
    numberOfItems: stats.length,
    itemListElement: stats.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${s.borough} Buildings`,
      url: canonicalUrl(cityPath(`/buildings/${regionSlug(s.borough)}`, city)),
    })),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((s) => (
          <Link key={s.borough} href={cityPath(`/buildings/${regionSlug(s.borough)}`, city)}>
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
    </>
  );
}
