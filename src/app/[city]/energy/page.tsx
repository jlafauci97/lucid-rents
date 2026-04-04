import type { Metadata } from "next";
import { Zap } from "lucide-react";
import { canonicalUrl, cityPath, cityBreadcrumbs } from "@/lib/seo";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { EnergyMap } from "@/components/energy/EnergyMap";
import dynamic from "next/dynamic";

const ScoreDistribution = dynamic(() => import("@/components/energy/ScoreDistribution").then(m => m.ScoreDistribution), {
  loading: () => <div className="bg-white rounded-xl border border-[#E2E8F0] p-6"><div className="h-6 w-48 bg-[#e2e8f0] rounded animate-pulse mb-4" /><div className="h-[300px] bg-[#FAFBFD] rounded-lg animate-pulse" /></div>,
});
import { EnergyTable } from "@/components/energy/EnergyTable";

/* ---------------------------------------------------------------------------
 * City-specific energy config
 * -------------------------------------------------------------------------*/

interface EnergyConfig {
  pageTitle: string;
  metaDescription: string;
  headerTitle: string;
  headerDescription: string;
  programName: string; // e.g. "LL84" or "EBEWE"
  dataSourceLabel: string;
  jsonLdName: string;
  jsonLdDescription: string;
}

const ENERGY_CONFIG: Record<City, EnergyConfig> = {
  nyc: {
    pageTitle: "NYC Energy Scores",
    metaDescription:
      "How energy-efficient is your building? See ENERGY STAR scores, utility costs, and emissions data for New York City multifamily buildings.",
    headerTitle: "NYC Energy Scores",
    headerDescription:
      "See how energy-efficient NYC multifamily buildings are. ENERGY STAR scores, energy use intensity (EUI), and greenhouse gas emissions from NYC\u2019s Local Law 84 benchmarking data.",
    programName: "LL84",
    dataSourceLabel: "NYC LL84 Energy Benchmarking",
    jsonLdName: "NYC Building Energy Scores",
    jsonLdDescription:
      "ENERGY STAR scores and energy benchmarking data for NYC multifamily buildings, sourced from NYC LL84 data.",
  },
  "los-angeles": {
    pageTitle: "LA Energy Scores",
    metaDescription:
      "How energy-efficient is your building? See ENERGY STAR scores, utility costs, and emissions data for Los Angeles buildings from the EBEWE program.",
    headerTitle: "LA Energy Scores",
    headerDescription:
      "See how energy-efficient Los Angeles buildings are. ENERGY STAR scores, energy use intensity (EUI), and greenhouse gas emissions from LA\u2019s EBEWE (Existing Buildings Energy & Water Efficiency) benchmarking data.",
    programName: "EBEWE",
    dataSourceLabel: "LA EBEWE Energy Benchmarking",
    jsonLdName: "LA Building Energy Scores",
    jsonLdDescription:
      "ENERGY STAR scores and energy benchmarking data for Los Angeles buildings, sourced from the EBEWE program.",
  },
  chicago: {
    pageTitle: "Chicago Energy Scores",
    metaDescription:
      "How energy-efficient is your building? See ENERGY STAR scores, utility costs, and emissions data for Chicago buildings from the Chicago Energy Benchmarking program.",
    headerTitle: "Chicago Energy Scores",
    headerDescription:
      "See how energy-efficient Chicago buildings are. ENERGY STAR scores, energy use intensity (EUI), and greenhouse gas emissions from Chicago\u2019s Energy Benchmarking Ordinance data.",
    programName: "CEB",
    dataSourceLabel: "Chicago Energy Benchmarking",
    jsonLdName: "Chicago Building Energy Scores",
    jsonLdDescription:
      "ENERGY STAR scores and energy benchmarking data for Chicago buildings, sourced from the Chicago Energy Benchmarking program.",
  },
  miami: {
    pageTitle: "Miami Energy Scores",
    metaDescription:
      "How energy-efficient is your building? See ENERGY STAR scores, utility costs, and emissions data for Miami-Dade buildings.",
    headerTitle: "Miami Energy Scores",
    headerDescription:
      "See how energy-efficient Miami-Dade buildings are. ENERGY STAR scores, energy use intensity (EUI), and greenhouse gas emissions data for Miami multifamily buildings.",
    programName: "MDE",
    dataSourceLabel: "Miami-Dade Energy Benchmarking",
    jsonLdName: "Miami Building Energy Scores",
    jsonLdDescription:
      "ENERGY STAR scores and energy benchmarking data for Miami-Dade buildings.",
  },
  houston: {
    pageTitle: "Houston Energy Scores",
    metaDescription:
      "How energy-efficient is your building? See ENERGY STAR scores, utility costs, and emissions data for Houston buildings.",
    headerTitle: "Houston Energy Scores",
    headerDescription:
      "See how energy-efficient Houston buildings are. ENERGY STAR scores, energy use intensity (EUI), and greenhouse gas emissions data for Houston multifamily buildings.",
    programName: "HEBE",
    dataSourceLabel: "Houston Energy Benchmarking",
    jsonLdName: "Houston Building Energy Scores",
    jsonLdDescription:
      "ENERGY STAR scores and energy benchmarking data for Houston buildings.",
  },
};

/* ---------------------------------------------------------------------------
 * Metadata
 * -------------------------------------------------------------------------*/

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  const cfg = ENERGY_CONFIG[city];
  return {
    title: `${meta.fullName} Building Energy Scores | Lucid Rents`,
    description: cfg.metaDescription,
    alternates: { canonical: canonicalUrl(cityPath("/energy", city)) },
    openGraph: {
      title: `${meta.fullName} Building Energy Scores`,
      description: cfg.metaDescription,
      url: canonicalUrl(cityPath("/energy", city)),
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

export const revalidate = 86400;

/* ---------------------------------------------------------------------------
 * Data fetching — passes metro to RPCs
 * -------------------------------------------------------------------------*/

async function fetchRpc(fnName: string, metro: string) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/${fnName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_metro: metro }),
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  return res.json();
}

/* ---------------------------------------------------------------------------
 * Page
 * -------------------------------------------------------------------------*/

export default async function EnergyPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: cityParam } = await params;
  if (!isValidCity(cityParam)) return null;

  const city = cityParam as City;
  const meta = CITY_META[city];
  const cfg = ENERGY_CONFIG[city];

  // metro value matches City key
  const metro = city;

  const [stats, zipData, distribution, topBuildings] = await Promise.all([
    fetchRpc("energy_stats", metro),
    fetchRpc("energy_by_zip", metro),
    fetchRpc("energy_score_distribution", metro),
    fetchRpc("energy_top_buildings", metro),
  ]);

  const boroughStats = (stats || []) as {
    borough: string;
    avg_score: number;
    building_count: number;
  }[];

  const totalBuildings = boroughStats.reduce((s, b) => s + Number(b.building_count), 0);
  const avgScore =
    boroughStats.length > 0
      ? (
          boroughStats.reduce((s, b) => s + Number(b.avg_score) * Number(b.building_count), 0) /
          totalBuildings
        ).toFixed(0)
      : "\u2014";
  const highestBorough = boroughStats.length > 0 ? boroughStats[0].borough : "\u2014";
  const lowestBorough = boroughStats.length > 0 ? boroughStats[boroughStats.length - 1].borough : "\u2014";

  const regionLabel = meta.regionLabel;
  const hasData = totalBuildings > 0;

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
              name: cfg.jsonLdName,
              description: cfg.jsonLdDescription,
              url: canonicalUrl(cityPath("/energy", city)),
              creator: {
                "@type": "Organization",
                name: "Lucid Rents",
                url: "https://lucidrents.com",
              },
            }),
          }}
        />

        <Breadcrumbs items={cityBreadcrumbs(city, { label: "Energy", href: cityPath("/energy", city) })} />

        {/* Header */}
        <div className="mb-8 mt-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Zap className="w-6 h-6 text-[#059669]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1F36]">
              {cfg.headerTitle}
            </h1>
          </div>
          <p className="text-[#5E6687] text-sm sm:text-base max-w-3xl">
            {cfg.headerDescription}
          </p>
        </div>

        {!hasData ? (
          /* No data message */
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 text-center">
            <Zap className="w-10 h-10 text-[#A3ACBE] mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
              Energy Data Coming Soon
            </h2>
            <p className="text-sm text-[#5E6687] max-w-md mx-auto">
              We&apos;re working on importing {meta.fullName} energy benchmarking data
              from the {cfg.programName} program. Check back soon for ENERGY STAR
              scores, EUI, and emissions data for {meta.fullName} buildings.
            </p>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
                <p className="text-xs text-[#5E6687] font-medium uppercase tracking-wide">
                  Avg Score
                </p>
                <p className="text-2xl font-bold text-[#1A1F36] mt-1">{avgScore}</p>
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
                <p className="text-xs text-[#5E6687] font-medium uppercase tracking-wide">
                  Buildings Benchmarked
                </p>
                <p className="text-2xl font-bold text-[#1A1F36] mt-1">
                  {totalBuildings > 0 ? totalBuildings.toLocaleString() : "\u2014"}
                </p>
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
                <p className="text-xs text-[#5E6687] font-medium uppercase tracking-wide">
                  Highest Avg {regionLabel}
                </p>
                <p className="text-sm font-semibold text-emerald-600 mt-2">
                  {highestBorough}
                </p>
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
                <p className="text-xs text-[#5E6687] font-medium uppercase tracking-wide">
                  Lowest Avg {regionLabel}
                </p>
                <p className="text-sm font-semibold text-red-600 mt-2">
                  {lowestBorough}
                </p>
              </div>
            </div>

            {/* Section 1: Map */}
            <section className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-6 mb-6">
              <h2 className="text-lg font-bold text-[#1A1F36] mb-1">
                Energy Score Map
              </h2>
              <p className="text-sm text-[#5E6687] mb-4">
                Average ENERGY STAR score by zip code. Green areas have higher
                efficiency, red areas have lower efficiency.
              </p>
              <EnergyMap data={zipData || []} city={city} />
            </section>

            {/* Section 2: Score Distribution */}
            <section className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-6 mb-6">
              <h2 className="text-lg font-bold text-[#1A1F36] mb-1">
                Score Distribution
              </h2>
              <p className="text-sm text-[#5E6687] mb-4">
                How buildings score across the ENERGY STAR scale (1-100).
              </p>
              <ScoreDistribution data={distribution || []} />
            </section>

            {/* Section 3: Top Buildings */}
            <section className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-6 mb-6">
              <h2 className="text-lg font-bold text-[#1A1F36] mb-1">
                Top-Scored Buildings
              </h2>
              <p className="text-sm text-[#5E6687] mb-4">
                Buildings with the highest ENERGY STAR scores.
              </p>
              <EnergyTable data={topBuildings || []} dataSourceLabel={cfg.dataSourceLabel} />
            </section>
          </>
        )}

        <AdBlock adSlot="ENERGY_BOTTOM" adFormat="horizontal" />
      </div>
    </AdSidebar>
  );
}
