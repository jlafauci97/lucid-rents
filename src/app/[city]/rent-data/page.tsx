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
import { type City, CITY_META } from "@/lib/cities";

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  const { isValidCity, CITY_META } = await import("@/lib/cities");
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  return {
    title: `${meta.fullName} Rent Data & Trends | Lucid Rents`,
    description: `What should you actually pay for rent in ${meta.fullName}? See median prices by neighborhood, rent trends over time, and an interactive map.`,
    alternates: { canonical: canonicalUrl(cityPath("/rent-data", city)) },
    openGraph: {
      title: `${meta.fullName} Rent Data & Trends`,
      description: `What should you actually pay in ${meta.fullName}? Median rents by neighborhood, trends over time, and an interactive rent map.`,
      url: canonicalUrl(cityPath("/rent-data", city)),
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

export const revalidate = 86400;

async function fetchRpc(fnName: string, params: Record<string, string> = {}) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/${fnName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function RentDataPage({ params: routeParams }: { params: Promise<{ city: string }> }) {
  const { city: cityParam } = await routeParams;
  const city = cityParam as City;
  const meta = CITY_META[city];
  const isNyc = city === "nyc";

  const [citywideTrend, boroughTrend, zipCurrent] = await Promise.all([
    fetchRpc("rent_trend_citywide", { p_metro: city }),
    fetchRpc("rent_trend_by_borough", { p_metro: city }),
    fetchRpc("rent_by_zip_current", { p_metro: city }),
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
              name: `${meta.fullName} Rent Data & Trends`,
              description: `Median rent prices by zip code and ${meta.regionLabel.toLowerCase()} for ${meta.fullName}, sourced from the Zillow Observed Rent Index (ZORI).`,
              url: canonicalUrl(cityPath("/rent-data", city)),
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
              {meta.fullName} Rent Data & Trends
            </h1>
          </div>
          <p className="text-[#64748b] text-sm sm:text-base max-w-3xl">
            {isNyc
              ? `Explore median rent prices across NYC neighborhoods, track borough trends over time, and see how Rent Guidelines Board decisions affect stabilized tenants. Data from the Zillow Observed Rent Index (ZORI).`
              : `Explore median rent prices across ${meta.fullName} neighborhoods, track area trends over time, and compare rents by zip code. Data from the Zillow Observed Rent Index (ZORI).`}
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
            {meta.fullName} Median Rent Over Time
          </h2>
          <p className="text-sm text-[#64748b] mb-4">
            Average median rent across all tracked {meta.fullName} zip codes, monthly.
          </p>
          <CitywideTrendChart data={citywideTrend || []} />
        </section>

        {/* Section 2: Area/Borough Comparison */}
        <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-1">
            Rent Trends by {meta.regionLabel}
          </h2>
          <p className="text-sm text-[#64748b] mb-4">
            {isNyc
              ? "How median rents compare across NYC\u2019s five boroughs over time."
              : `How median rents compare across ${meta.fullName}\u2019s areas over time.`}
          </p>
          <BoroughRentChart data={boroughTrend || []} city={city} />
        </section>

        {/* Section 3: Zip Code Table */}
        <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-1">
            Rent by Neighborhood
          </h2>
          <p className="text-sm text-[#64748b] mb-4">
            Current median rent for each {meta.fullName} zip code. Filter by {meta.regionLabel.toLowerCase()} and
            sort by rent or zip code.
          </p>
          <ZipRentTable data={zipData} />
        </section>

        {/* Section 4: RGB History — NYC only */}
        {isNyc && (
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
        )}

        {/* Section 5: Rent Map */}
        <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-1">
            {meta.fullName} Rent Map
          </h2>
          <p className="text-sm text-[#64748b] mb-4">
            Interactive map showing current median rents by zip code. Hover over
            a neighborhood to see details.
          </p>
          <RentMap data={zipData} city={city} />
        </section>

        <AdBlock adSlot="RENT_DATA_BOTTOM" adFormat="horizontal" />
      </div>
    </AdSidebar>
  );
}
