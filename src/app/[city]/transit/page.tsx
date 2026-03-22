import { createClient } from "@/lib/supabase/server";
import { TrainFront, Bus, ChevronRight } from "lucide-react";
import Link from "next/link";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import {
  SUBWAY_LINES,
  transitLineUrl,
  busRouteSlug,
} from "@/lib/subway-lines";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Apartments Near Transit | NYC Subway & Bus Lines | Lucid Rents",
  description:
    "Find NYC apartments near subway stations and bus stops. Browse buildings within walking distance of every MTA subway line and bus route.",
  alternates: { canonical: canonicalUrl(cityPath("/transit")) },
  openGraph: {
    title: "Apartments Near Transit",
    description:
      "Find NYC apartments near subway stations and bus stops. Browse every MTA line.",
    url: canonicalUrl(cityPath("/transit")),
    siteName: "Lucid Rents",
    type: "website",
    locale: "en_US",
  },
};

export const revalidate = 86400;

const SUBWAY_GROUPS = [
  { group: "1/2/3", lines: SUBWAY_LINES.filter((l) => l.group === "1/2/3") },
  { group: "4/5/6", lines: SUBWAY_LINES.filter((l) => l.group === "4/5/6") },
  { group: "7", lines: SUBWAY_LINES.filter((l) => l.group === "7") },
  { group: "A/C/E", lines: SUBWAY_LINES.filter((l) => l.group === "A/C/E") },
  {
    group: "B/D/F/M",
    lines: SUBWAY_LINES.filter((l) => l.group === "B/D/F/M"),
  },
  { group: "G", lines: SUBWAY_LINES.filter((l) => l.group === "G") },
  { group: "J/Z", lines: SUBWAY_LINES.filter((l) => l.group === "J/Z") },
  { group: "L", lines: SUBWAY_LINES.filter((l) => l.group === "L") },
  {
    group: "N/Q/R/W",
    lines: SUBWAY_LINES.filter((l) => l.group === "N/Q/R/W"),
  },
  {
    group: "Shuttles",
    lines: SUBWAY_LINES.filter((l) => l.group === "Shuttles"),
  },
];

function getBusPrefix(route: string): string {
  if (route.startsWith("SIM")) return "Express (SIM)";
  if (route.startsWith("BM")) return "Express (BM)";
  if (route.startsWith("QM")) return "Express (QM)";
  if (route.startsWith("Bx") || route.startsWith("BX")) return "Bronx";
  if (route.startsWith("B")) return "Brooklyn";
  if (route.startsWith("M")) return "Manhattan";
  if (route.startsWith("Q")) return "Queens";
  if (route.startsWith("S")) return "Staten Island";
  return "Other";
}

export default async function TransitHubPage() {
  const supabase = await createClient();

  // Fetch bus routes from transit_stops
  const { data: busStopData } = await supabase
    .from("transit_stops")
    .select("routes")
    .eq("type", "bus")
    .limit(20000);

  const busRoutes = [
    ...new Set((busStopData || []).flatMap((s) => s.routes || [])),
  ].sort((a, b) => {
    // Natural sort: M1, M2, ... M10, M11
    const aMatch = a.match(/^([A-Za-z]+)(\d+)(.*)$/);
    const bMatch = b.match(/^([A-Za-z]+)(\d+)(.*)$/);
    if (aMatch && bMatch) {
      const prefixCmp = aMatch[1].localeCompare(bMatch[1]);
      if (prefixCmp !== 0) return prefixCmp;
      const numCmp = parseInt(aMatch[2]) - parseInt(bMatch[2]);
      if (numCmp !== 0) return numCmp;
      return (aMatch[3] || "").localeCompare(bMatch[3] || "");
    }
    return a.localeCompare(b);
  });

  // Group bus routes by borough prefix
  const busGroups: Record<string, string[]> = {};
  for (const route of busRoutes) {
    const prefix = getBusPrefix(route);
    if (!busGroups[prefix]) busGroups[prefix] = [];
    busGroups[prefix].push(route);
  }

  const busGroupOrder = [
    "Manhattan",
    "Brooklyn",
    "Bronx",
    "Queens",
    "Staten Island",
    "Express (SIM)",
    "Express (BM)",
    "Express (QM)",
    "Other",
  ];

  return (
    <AdSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: "Apartments Near Transit in NYC",
              description:
                "Find NYC apartments near subway stations and bus stops.",
              url: canonicalUrl(cityPath("/transit")),
              publisher: {
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
              <TrainFront className="w-6 h-6 text-[#0039A6]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
              Apartments Near Transit
            </h1>
          </div>
          <p className="text-[#64748b] text-sm sm:text-base max-w-3xl">
            Find apartments within walking distance of NYC subway stations and
            bus stops. Click any line or route to browse nearby buildings.
          </p>
        </div>

        {/* Subway section */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-4 flex items-center gap-2">
            <TrainFront className="w-5 h-5 text-[#0039A6]" />
            Subway Lines
          </h2>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6">
            <div className="flex flex-wrap gap-3">
              {SUBWAY_GROUPS.map((group) =>
                group.lines.map((line) => (
                  <Link
                    key={line.slug}
                    href={transitLineUrl(line.slug)}
                    className="group flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-[#e2e8f0] hover:shadow-md hover:border-[#3B82F6]/40 transition-all bg-white"
                  >
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{
                        backgroundColor: line.color,
                        color: line.textColor,
                      }}
                    >
                      {line.letter}
                    </span>
                    <span className="text-sm font-medium text-[#0F1D2E] group-hover:text-[#3B82F6] transition-colors">
                      {line.name}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#94a3b8] group-hover:text-[#3B82F6] ml-auto transition-colors" />
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Bus section */}
        {busRoutes.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-bold text-[#0F1D2E] mb-4 flex items-center gap-2">
              <Bus className="w-5 h-5 text-[#0039A6]" />
              Bus Routes
            </h2>
            <div className="space-y-4">
              {busGroupOrder
                .filter((prefix) => busGroups[prefix]?.length > 0)
                .map((prefix) => (
                  <div
                    key={prefix}
                    className="bg-white border border-[#e2e8f0] rounded-xl p-5"
                  >
                    <h3 className="text-sm font-semibold text-[#64748b] uppercase tracking-wide mb-3">
                      {prefix}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {busGroups[prefix].map((route) => (
                        <Link
                          key={route}
                          href={transitLineUrl(busRouteSlug(route))}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-[#e2e8f0] text-[#0F1D2E] hover:bg-[#0039A6] hover:text-white hover:border-[#0039A6] transition-all"
                        >
                          {route}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        <AdBlock adSlot="TRANSIT_HUB_BOTTOM" adFormat="horizontal" />
      </div>
    </AdSidebar>
  );
}
