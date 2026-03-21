import { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { CitywideTrendChart } from "@/components/rent-data/CitywideTrendChart";
import { BoroughRentChart } from "@/components/rent-data/BoroughRentChart";
import { ZipRentTable } from "@/components/rent-data/ZipRentTable";
import { RGBChart } from "@/components/rent-data/RGBChart";
import { RentMap } from "@/components/rent-data/RentMap";

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  const { isValidCity, CITY_META } = await import("@/lib/cities");
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  return {
    title: `${meta.fullName} Rent Data & Trends | Lucid Rents`,
    description: `Explore ${meta.fullName} rent prices by neighborhood and zip code. View median rent trends, area comparisons, and an interactive rent map.`,
    alternates: { canonical: canonicalUrl(cityPath("/rent-data", city)) },
    openGraph: {
      title: `${meta.fullName} Rent Data & Trends`,
      description: `Median rent prices, area comparisons, and neighborhood rent maps for ${meta.fullName}. Powered by Zillow ZORI data.`,
      url: canonicalUrl(cityPath("/rent-data", city)),
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
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function RentDataPage() {
  const [citywideTrend, boroughTrend, zipCurrent] = await Promise.all([
    fetchRpc("rent_trend_citywide"),
    fetchRpc("rent_trend_by_borough"),
    fetchRpc("rent_by_zip_current"),
  ]);

  // Compute summary stats from zipCurrent
  const zipData = (zipCurrent || []) as {
    zip_code: string;
    borough: string;
    median_rent: number;
    month: string;
  }[];

  const avgRent =
    zipData.length > 0
      ? Math.round(
          zipData.reduce((s, z) => s + z.median_rent, 0) / zipData.length
        )
      : 0;

  const latestMonth =
    zipData.length > 0 && zipData[0].month
      ? new Date(zipData[0].month).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })
      : "—";

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
              name: "NYC Rent Data & Trends",
              description:
                "Median rent prices by zip code and borough for New York City, sourced from the Zillow Observed Rent Index (ZORI).",
              url: canonicalUrl(cityPath("/rent-data")),
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
            <div className="p-2 bg-blue-50 rounded-lg">
              <BarChart3 className="w-6 h-6 text-[#3B82F6]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
              NYC Rent Data & Trends
            </h1>
          </div>
          <p className="text-[#64748b] text-sm sm:text-base max-w-3xl">
            Explore median rent prices across NYC neighborhoods, track borough
            trends over time, and see how Rent Guidelines Board decisions affect
            stabilized tenants. Data from the Zillow Observed Rent Index (ZORI).
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Avg Median Rent
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
              {avgRent > 0 ? `$${avgRent.toLocaleString()}` : "—"}
            </p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Zip Codes Tracked
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
              {zipData.length || "—"}
            </p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Latest Data
            </p>
            <p className="text-sm font-semibold text-[#0F1D2E] mt-2">
              {latestMonth}
            </p>
          </div>
        </div>

        {/* Section 1: Citywide Trend */}
        <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-1">
            NYC Median Rent Over Time
          </h2>
          <p className="text-sm text-[#64748b] mb-4">
            Average median rent across all tracked NYC zip codes, monthly.
          </p>
          <CitywideTrendChart data={citywideTrend || []} />
        </section>

        {/* Section 2: Borough Comparison */}
        <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-1">
            Rent Trends by Borough
          </h2>
          <p className="text-sm text-[#64748b] mb-4">
            How median rents compare across NYC&apos;s five boroughs over time.
          </p>
          <BoroughRentChart data={boroughTrend || []} />
        </section>

        {/* Section 3: Zip Code Table */}
        <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-1">
            Rent by Neighborhood
          </h2>
          <p className="text-sm text-[#64748b] mb-4">
            Current median rent for each NYC zip code. Filter by borough and
            sort by rent or zip code.
          </p>
          <ZipRentTable data={zipData} />
        </section>

        {/* Section 4: RGB History */}
        <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-1">
            Rent Guidelines Board Rate History
          </h2>
          <p className="text-sm text-[#64748b] mb-4">
            Maximum annual rent increases set by the NYC Rent Guidelines Board
            for rent-stabilized apartments.
          </p>
          <RGBChart />
        </section>

        {/* Section 5: Rent Map */}
        <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-1">
            NYC Rent Map
          </h2>
          <p className="text-sm text-[#64748b] mb-4">
            Interactive map showing current median rents by zip code. Hover over
            a neighborhood to see details.
          </p>
          <RentMap data={zipData} />
        </section>

        <AdBlock adSlot="RENT_DATA_BOTTOM" adFormat="horizontal" />
      </div>
    </AdSidebar>
  );
}
