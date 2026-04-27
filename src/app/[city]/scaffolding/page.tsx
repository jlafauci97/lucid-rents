import type { Metadata } from "next";
import { canonicalUrl, cityPath, cityBreadcrumbs } from "@/lib/seo";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { ScaffoldingMap } from "@/components/scaffolding/ScaffoldingMap";
import { ScaffoldingTable } from "@/components/scaffolding/ScaffoldingTable";
import { ScaffoldingHero } from "@/components/scaffolding/ScaffoldingHero";
import { HallOfShame } from "@/components/scaffolding/HallOfShame";
import dynamic from "next/dynamic";

const BoroughBreakdown = dynamic(
  () =>
    import("@/components/scaffolding/BoroughBreakdown").then(
      (m) => m.BoroughBreakdown
    ),
  {
    loading: () => (
      <div className="bg-white rounded-xl border border-[#e2e8f0] p-6">
        <div className="h-6 w-48 bg-[#e2e8f0] rounded animate-pulse mb-4" />
        <div className="h-[300px] bg-[#f8fafc] rounded-lg animate-pulse" />
      </div>
    ),
  }
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  return {
    title: `${meta.fullName} Scaffolding & Sidewalk Sheds Tracker`,
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
          boroughStats.reduce(
            (s, b) => s + b.avg_days_up * b.active_count,
            0
          ) / totalActive
        )
      : 0;

  const oldestDays =
    longestSheds.length > 0
      ? Math.max(...longestSheds.map((s: { total_days: number }) => s.total_days || 0))
      : 0;
  const oldestYears = Math.floor(oldestDays / 365);

  return (
    <AdSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Dataset",
              name: "NYC Scaffolding & Sidewalk Sheds Tracker",
              description:
                "Active sidewalk shed permits across New York City, sourced from NYC DOB permit data going back to 1989.",
              url: "https://lucidrents.com/nyc/scaffolding",
              creator: {
                "@type": "Organization",
                name: "Lucid Rents",
                url: "https://lucidrents.com",
              },
            }),
          }}
        />

        <Breadcrumbs
          items={cityBreadcrumbs("nyc" as City, {
            label: "Scaffolding",
            href: cityPath("/scaffolding", "nyc" as City),
          })}
        />

        <div className="mt-4">
          <ScaffoldingHero
            totalActive={totalActive}
            oldestYears={oldestYears}
            longestSheds={longestSheds || []}
            zipData={zipData || []}
          />
        </div>

        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
          <div className="bg-white border border-[#e2e8f0] rounded-xl px-4 py-3 sm:px-5 sm:py-4">
            <p className="text-[10px] sm:text-xs text-[#64748b] font-semibold uppercase tracking-wider">
              Active Sheds
            </p>
            <p className="text-xl sm:text-2xl font-bold text-[#0F1D2E] mt-1 tabular-nums">
              {totalActive > 0 ? totalActive.toLocaleString() : "—"}
            </p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl px-4 py-3 sm:px-5 sm:py-4">
            <p className="text-[10px] sm:text-xs text-[#64748b] font-semibold uppercase tracking-wider">
              Avg Duration
            </p>
            <p className="text-xl sm:text-2xl font-bold text-[#0F1D2E] mt-1 tabular-nums">
              {overallAvgDays > 0
                ? overallAvgDays > 365
                  ? `${Math.floor(overallAvgDays / 365)}y ${Math.floor((overallAvgDays % 365) / 30)}mo`
                  : `${Math.floor(overallAvgDays / 30)}mo`
                : "—"}
            </p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl px-4 py-3 sm:px-5 sm:py-4">
            <p className="text-[10px] sm:text-xs text-[#64748b] font-semibold uppercase tracking-wider">
              Oldest
            </p>
            <p className="text-xl sm:text-2xl font-bold text-red-600 mt-1 tabular-nums">
              {oldestYears > 0 ? `${oldestYears}y` : "—"}
            </p>
          </div>
        </div>

        <HallOfShame data={longestSheds || []} />

        <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-6">
          <div className="flex items-baseline justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-bold text-[#0F1D2E]">
                Density by Zip Code
              </h2>
              <p className="text-sm text-[#64748b] mt-0.5">
                Darker areas have more active scaffolding.
              </p>
            </div>
          </div>
          <ScaffoldingMap data={zipData || []} />
        </section>

        <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-[#0F1D2E]">
              Borough Breakdown
            </h2>
            <p className="text-sm text-[#64748b] mt-0.5">
              Active count and average duration by borough.
            </p>
          </div>
          <BoroughBreakdown data={boroughStats} />
        </section>

        <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6 mb-8">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-[#0F1D2E]">
              All Long-Standing Sheds
            </h2>
            <p className="text-sm text-[#64748b] mt-0.5">
              The 500 longest-running active sheds in NYC. Sort by duration,
              renewals, or first permit date.
            </p>
          </div>
          <ScaffoldingTable data={longestSheds || []} />
        </section>

        <section className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-5 sm:p-6 mt-2 space-y-4 text-sm leading-relaxed text-[#334155]">
          <h2 className="text-base font-bold text-[#0F1D2E]">
            About this tracker
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
            times a permit can be renewed. The result: thousands of
            semi-permanent structures blocking sunlight, hurting foot traffic
            for local businesses, and creating safety concerns of their own.
          </p>
          <p>
            This tracker uses official NYC DOB NOW permit data (2017 onward).
            A long &ldquo;first permit&rdquo; date at an address means there
            has been at least one shed there since that year, with renewals
            since &mdash; not necessarily that the same shed has been up
            continuously. Sheds often come down and go back up across separate
            construction projects on the same building. If you live near a
            long-standing sidewalk shed, you can contact your local Community
            Board or file a 311 complaint requesting an update on the
            construction timeline.
          </p>
        </section>
      </div>
    </AdSidebar>
  );
}
