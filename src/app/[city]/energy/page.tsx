import type { Metadata } from "next";
import { Zap } from "lucide-react";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { isValidCity, CITY_META } from "@/lib/cities";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { EnergyMap } from "@/components/energy/EnergyMap";
import { ScoreDistribution } from "@/components/energy/ScoreDistribution";
import { EnergyTable } from "@/components/energy/EnergyTable";

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  return {
    title: `${meta.fullName} Building Energy Scores | Lucid Rents`,
    description: `See ENERGY STAR scores, energy use intensity, and greenhouse gas emissions for ${meta.fullName} multifamily buildings.`,
    alternates: { canonical: canonicalUrl(cityPath("/energy", city)) },
    openGraph: {
      title: `${meta.fullName} Building Energy Scores`,
      description: `ENERGY STAR scores and energy benchmarking data for ${meta.fullName} multifamily buildings.`,
      url: canonicalUrl(cityPath("/energy", city)),
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

export default async function EnergyPage() {
  const [stats, zipData, distribution, topBuildings] = await Promise.all([
    fetchRpc("energy_stats"),
    fetchRpc("energy_by_zip"),
    fetchRpc("energy_score_distribution"),
    fetchRpc("energy_top_buildings"),
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
              name: "NYC Building Energy Scores",
              description:
                "ENERGY STAR scores and energy benchmarking data for NYC multifamily buildings, sourced from NYC LL84 data.",
              url: "https://lucidrents.com/energy",
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
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Zap className="w-6 h-6 text-[#059669]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
              NYC Energy Scores
            </h1>
          </div>
          <p className="text-[#64748b] text-sm sm:text-base max-w-3xl">
            See how energy-efficient NYC multifamily buildings are. ENERGY STAR
            scores, energy use intensity (EUI), and greenhouse gas emissions from
            NYC&apos;s Local Law 84 benchmarking data.
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Avg Score
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">{avgScore}</p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Buildings Benchmarked
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
              {totalBuildings > 0 ? totalBuildings.toLocaleString() : "\u2014"}
            </p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Highest Avg Score
            </p>
            <p className="text-sm font-semibold text-emerald-600 mt-2">
              {highestBorough}
            </p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Lowest Avg Score
            </p>
            <p className="text-sm font-semibold text-red-600 mt-2">
              {lowestBorough}
            </p>
          </div>
        </div>

        {/* Section 1: Map */}
        <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-1">
            Energy Score Map
          </h2>
          <p className="text-sm text-[#64748b] mb-4">
            Average ENERGY STAR score by zip code. Green areas have higher
            efficiency, red areas have lower efficiency.
          </p>
          <EnergyMap data={zipData || []} />
        </section>

        {/* Section 2: Score Distribution */}
        <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-1">
            Score Distribution
          </h2>
          <p className="text-sm text-[#64748b] mb-4">
            How multifamily buildings score across the ENERGY STAR scale (1-100).
          </p>
          <ScoreDistribution data={distribution || []} />
        </section>

        {/* Section 3: Top Buildings */}
        <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-1">
            Top-Scored Buildings
          </h2>
          <p className="text-sm text-[#64748b] mb-4">
            Multifamily buildings with the highest ENERGY STAR scores.
          </p>
          <EnergyTable data={topBuildings || []} />
        </section>

        <AdBlock adSlot="ENERGY_BOTTOM" adFormat="horizontal" />
      </div>
    </AdSidebar>
  );
}
