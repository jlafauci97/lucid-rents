import { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { canonicalUrl } from "@/lib/seo";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { PermitMap } from "@/components/permits/PermitMap";
import { PermitTable } from "@/components/permits/PermitTable";
import { WorkTypeBreakdown } from "@/components/permits/WorkTypeBreakdown";

export const metadata: Metadata = {
  title: "NYC Building Permits Tracker | Lucid Rents",
  description:
    "Track active DOB building permits across NYC. See permit density by neighborhood, work types, costs, and recently issued permits.",
  alternates: { canonical: canonicalUrl("/permits") },
  openGraph: {
    title: "NYC Building Permits Tracker",
    description:
      "Active DOB building permits across New York City — work types, costs, and neighborhood density. Powered by NYC DOB permit data.",
    url: canonicalUrl("/permits"),
    siteName: "Lucid Rents",
    type: "website",
    locale: "en_US",
  },
};

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

export default async function PermitsPage() {
  const [stats, zipData, typeData, recentPermits] = await Promise.all([
    fetchRpc("permit_stats"),
    fetchRpc("permits_by_zip"),
    fetchRpc("permits_by_type"),
    fetchRpc("permits_recent"),
  ]);

  const boroughStats = (stats || []) as {
    borough: string;
    active_count: number;
    top_work_type: string;
  }[];

  const totalActive = boroughStats.reduce((s, b) => s + b.active_count, 0);
  const topWorkType =
    boroughStats.length > 0 ? boroughStats[0].top_work_type : "\u2014";
  const topBorough =
    boroughStats.length > 0 ? boroughStats[0].borough : "\u2014";

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
              name: "NYC Building Permits Tracker",
              description:
                "Active DOB building permits across New York City, sourced from NYC DOB permit data.",
              url: "https://lucidrents.com/permits",
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
            <div className="p-2 bg-teal-50 rounded-lg">
              <ClipboardList className="w-6 h-6 text-[#0D9488]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
              NYC Permits Tracker
            </h1>
          </div>
          <p className="text-[#64748b] text-sm sm:text-base max-w-3xl">
            Track active DOB building permits across NYC. See what construction
            and work is happening in your neighborhood, including permit types,
            costs, and timelines. Data from NYC DOB permits.
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Active Permits
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
              {totalActive > 0 ? totalActive.toLocaleString() : "\u2014"}
            </p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Top Work Type
            </p>
            <p className="text-sm font-semibold text-[#0F1D2E] mt-2">
              {topWorkType}
            </p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Most Permits
            </p>
            <p className="text-sm font-semibold text-[#0F1D2E] mt-2">
              {BOROUGH_NAME[topBorough?.toUpperCase()] || topBorough}
            </p>
          </div>
        </div>

        {/* Section 1: Map */}
        <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-1">
            Permit Density Map
          </h2>
          <p className="text-sm text-[#64748b] mb-4">
            Active building permits by zip code. Darker areas have more active
            permits.
          </p>
          <PermitMap data={zipData || []} />
        </section>

        <AdBlock adSlot="PERMITS_TOP" adFormat="horizontal" />

        {/* Section 2: Recent Permits */}
        <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-1">
            Recently Issued Permits
          </h2>
          <p className="text-sm text-[#64748b] mb-4">
            Most recently issued active building permits across NYC.
          </p>
          <PermitTable data={recentPermits || []} />
        </section>

        <AdBlock adSlot="PERMITS_MID" adFormat="horizontal" />

        {/* Section 3: Work Type Breakdown */}
        <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-1">
            Work Type Breakdown
          </h2>
          <p className="text-sm text-[#64748b] mb-4">
            Active permit count by work type. Top 10 shown.
          </p>
          <WorkTypeBreakdown data={typeData || []} />
        </section>

        <AdBlock adSlot="PERMITS_BOTTOM" adFormat="horizontal" />
      </div>
    </AdSidebar>
  );
}
