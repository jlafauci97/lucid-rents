import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { canonicalUrl, cityPath, cityBreadcrumbs } from "@/lib/seo";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { VIOLATION_AGENCIES } from "@/lib/constants";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { PermitMap } from "@/components/permits/PermitMap";
import { PermitTable } from "@/components/permits/PermitTable";
import dynamic from "next/dynamic";

const WorkTypeBreakdown = dynamic(() => import("@/components/permits/WorkTypeBreakdown").then(m => m.WorkTypeBreakdown), {
  loading: () => <div className="bg-white rounded-xl border border-[#E2E8F0] p-6"><div className="h-6 w-48 bg-[#e2e8f0] rounded animate-pulse mb-4" /><div className="h-[300px] bg-[#FAFBFD] rounded-lg animate-pulse" /></div>,
});

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  return {
    title: `${meta.fullName} Building Permits Tracker | Lucid Rents`,
    description: `What construction is happening near you? Track active building permits across ${meta.fullName} — see work types, costs, and neighborhood hotspots.`,
    alternates: { canonical: canonicalUrl(cityPath("/permits", city)) },
    openGraph: {
      title: `${meta.fullName} Building Permits Tracker`,
      description: `What construction is happening near you? Active building permits across ${meta.fullName} with work types, costs, and maps.`,
      url: canonicalUrl(cityPath("/permits", city)),
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

export const revalidate = 86400;

async function fetchRpc(fnName: string, body: Record<string, unknown> = {}) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/${fnName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

/** City-specific permit labels */
function getPermitLabels(city: City) {
  const agency = VIOLATION_AGENCIES[city].building;
  if (city === "los-angeles") {
    return {
      agency,
      agencyFull: "LA Department of Building and Safety",
      regionLabel: CITY_META[city].regionLabel,
      dataSource: "LADBS Permits",
    };
  }
  if (city === "chicago") {
    return {
      agency,
      agencyFull: "Chicago Department of Buildings",
      regionLabel: CITY_META[city].regionLabel,
      dataSource: "CDBS Permits",
    };
  }
  if (city === "miami") {
    return {
      agency,
      agencyFull: "Miami-Dade Regulatory & Economic Resources",
      regionLabel: CITY_META[city].regionLabel,
      dataSource: "Miami-Dade Permits",
    };
  }
  return {
    agency,
    agencyFull: "Department of Buildings",
    regionLabel: CITY_META[city].regionLabel,
    dataSource: "NYC DOB Permits",
  };
}

export default async function PermitsPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: citySlug } = await params;
  if (!isValidCity(citySlug)) return null;

  const city = citySlug as City;
  const meta = CITY_META[city];
  const labels = getPermitLabels(city);
  const metro = city;

  const [stats, zipData, typeData, recentPermits] = await Promise.all([
    fetchRpc("permit_stats", { p_metro: metro }),
    fetchRpc("permits_by_zip", { p_metro: metro }),
    fetchRpc("permits_by_type", { p_metro: metro }),
    fetchRpc("permits_recent", { p_metro: metro }),
  ]);

  const areaStats = (stats || []) as {
    borough: string;
    active_count: number;
    top_work_type: string;
  }[];

  const totalActive = areaStats.reduce((s, b) => s + b.active_count, 0);
  const topWorkType =
    areaStats.length > 0 ? areaStats[0].top_work_type : "\u2014";
  const topArea =
    areaStats.length > 0 ? areaStats[0].borough : "\u2014";

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
              name: `${meta.fullName} Building Permits Tracker`,
              description: `Active ${labels.agency} building permits across ${meta.fullName}, sourced from ${labels.dataSource}.`,
              url: canonicalUrl(cityPath("/permits", city)),
              creator: {
                "@type": "Organization",
                name: "Lucid Rents",
                url: "https://lucidrents.com",
              },
            }),
          }}
        />

        <Breadcrumbs items={cityBreadcrumbs(city, { label: "Permits", href: cityPath("/permits", city) })} />

        {/* Header */}
        <div className="mb-8 mt-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-teal-50 rounded-lg">
              <ClipboardList className="w-6 h-6 text-[#0D9488]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1F36]">
              {meta.name} Permits Tracker
            </h1>
          </div>
          <p className="text-[#5E6687] text-sm sm:text-base max-w-3xl">
            Track active {labels.agency} building permits across {meta.fullName}. See what construction
            and work is happening in your neighborhood, including permit types,
            costs, and timelines. Data from {labels.dataSource}.
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <p className="text-xs text-[#5E6687] font-medium uppercase tracking-wide">
              Active Permits
            </p>
            <p className="text-2xl font-bold text-[#1A1F36] mt-1">
              {totalActive > 0 ? totalActive.toLocaleString() : "\u2014"}
            </p>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <p className="text-xs text-[#5E6687] font-medium uppercase tracking-wide">
              Top Work Type
            </p>
            <p className="text-sm font-semibold text-[#1A1F36] mt-2">
              {topWorkType}
            </p>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <p className="text-xs text-[#5E6687] font-medium uppercase tracking-wide">
              Most Permits
            </p>
            <p className="text-sm font-semibold text-[#1A1F36] mt-2">
              {topArea}
            </p>
          </div>
        </div>

        {/* Section 1: Map */}
        <section className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#1A1F36] mb-1">
            Permit Density Map
          </h2>
          <p className="text-sm text-[#5E6687] mb-4">
            Active building permits by zip code. Darker areas have more active
            permits.
          </p>
          <PermitMap data={zipData || []} city={city} />
        </section>

        {/* Section 2: Recent Permits */}
        <section className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#1A1F36] mb-1">
            Recently Issued Permits
          </h2>
          <p className="text-sm text-[#5E6687] mb-4">
            Most recently issued active building permits across {meta.fullName}.
          </p>
          <PermitTable data={recentPermits || []} />
        </section>

        {/* Section 3: Work Type Breakdown */}
        <section className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#1A1F36] mb-1">
            Work Type Breakdown
          </h2>
          <p className="text-sm text-[#5E6687] mb-4">
            Active permit count by work type. Top 10 shown.
          </p>
          <WorkTypeBreakdown data={typeData || []} />
        </section>

        <AdBlock adSlot="PERMITS_BOTTOM" adFormat="horizontal" />
      </div>
    </AdSidebar>
  );
}
