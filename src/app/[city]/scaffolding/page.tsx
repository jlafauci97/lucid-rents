import type { Metadata } from "next";
import { Construction } from "lucide-react";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { isValidCity, CITY_META } from "@/lib/cities";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { ScaffoldingMap } from "@/components/scaffolding/ScaffoldingMap";
import { ScaffoldingTable } from "@/components/scaffolding/ScaffoldingTable";
import dynamic from "next/dynamic";

const BoroughBreakdown = dynamic(() => import("@/components/scaffolding/BoroughBreakdown").then(m => m.BoroughBreakdown));

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  return {
    title: `${meta.fullName} Scaffolding & Sidewalk Sheds Tracker | Lucid Rents`,
    description: `Is there scaffolding on your block? Track every active sidewalk shed across ${meta.fullName} — see how long it's been up and when the permit expires.`,
    alternates: { canonical: canonicalUrl(cityPath("/scaffolding", city)) },
    openGraph: {
      title: `${meta.fullName} Scaffolding & Sidewalk Sheds Tracker`,
      description: `Is there scaffolding on your block? Every active sidewalk shed across ${meta.fullName} — duration, permits, and maps.`,
      url: canonicalUrl(cityPath("/scaffolding", city)),
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

export const revalidate = 86400;

async function fetchRpc(fnName: string) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/${fnName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function ScaffoldingPage() {
  const [stats, zipData, longestSheds] = await Promise.all([
    fetchRpc("scaffolding_stats"),
    fetchRpc("scaffolding_by_zip"),
    fetchRpc("scaffolding_longest"),
  ]);

  const boroughStats = (stats || []) as {
    borough: string;
    active_count: number;
    avg_days_up: number;
  }[];

  const totalActive = boroughStats.reduce((s, b) => s + b.active_count, 0);
  const overallAvgDays =
    boroughStats.length > 0
      ? Math.round(
          boroughStats.reduce((s, b) => s + b.avg_days_up * b.active_count, 0) /
            totalActive
        )
      : 0;
  const topBorough =
    boroughStats.length > 0 ? boroughStats[0].borough : "—";

  const BOROUGH_NAME: Record<string, string> = {
    MANHATTAN: "Manhattan",
    BROOKLYN: "Brooklyn",
    QUEENS: "Queens",
    BRONX: "Bronx",
    "STATEN ISLAND": "Staten Island",
  };

  return (
    <AdSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Dataset",
              name: "NYC Scaffolding & Sidewalk Sheds Tracker",
              description:
                "Active sidewalk shed permits across New York City, sourced from NYC DOB permit data.",
              url: "https://lucidrents.com/scaffolding",
              creator: {
                "@type": "Organization",
                name: "Lucid Rents",
                url: "https://lucidrents.com",
              },
            }),
          }}
        />

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Construction className="w-6 h-6 text-[#F59E0B]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
              NYC Scaffolding Tracker
            </h1>
          </div>
          <p className="text-[#64748b] text-sm sm:text-base max-w-3xl">
            Track active sidewalk sheds and scaffolding across NYC. See how long
            they&apos;ve been up, which neighborhoods have the most, and when
            permits expire. Data from NYC DOB permits.
          </p>
          <p className="text-[#94a3b8] text-xs mt-2 max-w-3xl">
            Sidewalk shed permits must be renewed every 3 months. Sheds that
            remain up for years reflect repeated renewals — not a single
            long-term permit.
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Active Sheds
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
              {totalActive > 0 ? totalActive.toLocaleString() : "—"}
            </p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Avg Duration
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
              {overallAvgDays > 0
                ? overallAvgDays > 365
                  ? `${Math.floor(overallAvgDays / 365)}y ${Math.floor((overallAvgDays % 365) / 30)}mo`
                  : `${Math.floor(overallAvgDays / 30)}mo`
                : "—"}
            </p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Most Sheds
            </p>
            <p className="text-sm font-semibold text-[#0F1D2E] mt-2">
              {BOROUGH_NAME[topBorough?.toUpperCase()] || topBorough}
            </p>
          </div>
        </div>

        {/* Section 1: Map */}
        <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-1">
            Scaffolding Density Map
          </h2>
          <p className="text-sm text-[#64748b] mb-4">
            Active sidewalk sheds by zip code. Darker areas have more active
            scaffolding.
          </p>
          <ScaffoldingMap data={zipData || []} />
        </section>

        {/* Section 2: Longest-standing sheds */}
        <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-1">
            Longest-Standing Sidewalk Sheds
          </h2>
          <p className="text-sm text-[#64748b] mb-4">
            Active sidewalk shed permits sorted by how long they&apos;ve been
            up. Sheds over a year are highlighted.
          </p>
          <ScaffoldingTable data={longestSheds || []} />
        </section>

        {/* Section 3: Borough Breakdown */}
        <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-1">
            Borough Breakdown
          </h2>
          <p className="text-sm text-[#64748b] mb-4">
            Active sidewalk shed count and average duration by borough.
          </p>
          <BoroughBreakdown data={boroughStats} />
        </section>

        {/* Editorial content */}
        <section className="mt-8 space-y-4 text-sm leading-relaxed text-[#334155]">
          <h2 className="text-lg font-bold text-[#0F1D2E]">
            Understanding NYC Sidewalk Sheds
          </h2>
          <p>
            Sidewalk sheds (commonly called scaffolding) are temporary overhead
            structures installed to protect pedestrians from falling debris
            during construction, facade repairs, or building inspections. Under
            NYC Local Law 11, buildings taller than six stories must undergo
            periodic facade inspections every five years. When inspectors find
            unsafe conditions, property owners are required to install a
            sidewalk shed until repairs are complete.
          </p>
          <p>
            While intended as a short-term safety measure, many sidewalk sheds
            remain in place for years &mdash; sometimes decades. The NYC
            Department of Buildings issues sidewalk shed permits that must be
            renewed every three months, but there is no hard limit on how many
            times a permit can be renewed. This has led to thousands of
            semi-permanent structures blocking sunlight, reducing foot traffic
            for local businesses, and creating safety concerns of their own.
          </p>
          <p>
            This tracker uses official NYC DOB permit data to show every active
            sidewalk shed in the city. You can see how long each shed has been
            up, which neighborhoods have the highest concentration, and when
            permits are set to expire. If you live near a long-standing
            sidewalk shed, you can contact your local Community Board or file
            a 311 complaint requesting an update on the construction timeline.
          </p>
        </section>

        <AdBlock adSlot="SCAFFOLDING_BOTTOM" adFormat="horizontal" />
      </div>
    </AdSidebar>
  );
}
