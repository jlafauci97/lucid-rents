import { createClient } from "@/lib/supabase/server";
import { TrainFront, Bus, ChevronRight } from "lucide-react";
import Link from "next/link";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import {
  SUBWAY_LINES,
  LA_METRO_LINES,
  transitLineUrl,
  busRouteSlug,
  laMetroBusSlug,
} from "@/lib/subway-lines";
import type { Metadata } from "next";

import { isValidCity, CITY_META, type City } from "@/lib/cities";

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  const transitLabel = city === "los-angeles" ? "Metro Rail and bus" : "subway and bus";
  return {
    title: `Apartments Near Transit | ${meta.fullName} | Lucid Rents`,
    description: `Find ${meta.fullName} apartments you can actually commute from. Browse buildings within walking distance of every ${transitLabel} line.`,
    alternates: { canonical: canonicalUrl(cityPath("/transit", city)) },
    openGraph: {
      title: "Apartments Near Transit",
      description: `Find ${meta.fullName} apartments you can actually commute from — near every ${transitLabel} line.`,
      url: canonicalUrl(cityPath("/transit", city)),
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

export const revalidate = 86400;

// ── NYC Subway groupings ────────────────────────────────────────────
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

// ── NYC bus borough prefix ──────────────────────────────────────────
function getNYCBusPrefix(route: string): string {
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

const NYC_BUS_GROUP_ORDER = [
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

// ── LA bus grouping by route number ranges ──────────────────────────
function getLABusGroup(route: string): string {
  const num = parseInt(route);
  if (isNaN(num)) return "Other";
  if (num >= 1 && num <= 99) return "Local (1-99)";
  if (num >= 100 && num <= 199) return "Local (100-199)";
  if (num >= 200 && num <= 299) return "Local (200-299)";
  if (num >= 300 && num <= 399) return "Limited/Express (300-399)";
  if (num >= 400 && num <= 499) return "Express (400-499)";
  if (num >= 500 && num <= 599) return "Express (500-599)";
  if (num >= 600 && num <= 699) return "Community (600-699)";
  if (num >= 700 && num <= 799) return "Rapid (700-799)";
  return "Other";
}

const LA_BUS_GROUP_ORDER = [
  "Local (1-99)",
  "Local (100-199)",
  "Local (200-299)",
  "Limited/Express (300-399)",
  "Express (400-499)",
  "Express (500-599)",
  "Community (600-699)",
  "Rapid (700-799)",
  "Other",
];

// ── Natural sort helper ─────────────────────────────────────────────
function naturalSort(a: string, b: string): number {
  const aMatch = a.match(/^([A-Za-z]*)(\d+)(.*)$/);
  const bMatch = b.match(/^([A-Za-z]*)(\d+)(.*)$/);
  if (aMatch && bMatch) {
    const prefixCmp = aMatch[1].localeCompare(bMatch[1]);
    if (prefixCmp !== 0) return prefixCmp;
    const numCmp = parseInt(aMatch[2]) - parseInt(bMatch[2]);
    if (numCmp !== 0) return numCmp;
    return (aMatch[3] || "").localeCompare(bMatch[3] || "");
  }
  return a.localeCompare(b);
}

export default async function TransitHubPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: cityParam } = await params;
  const city = isValidCity(cityParam) ? cityParam : "nyc";
  const meta = CITY_META[city];
  const isLA = city === "los-angeles";
  const isChicago = city === "chicago";

  // CTA L line definitions for Chicago
  const CTA_LINES = [
    { name: "Red Line", color: "#C60C30", slug: "red-line" },
    { name: "Blue Line", color: "#00A1DE", slug: "blue-line" },
    { name: "Brown Line", color: "#62361B", slug: "brown-line" },
    { name: "Green Line", color: "#009B3A", slug: "green-line" },
    { name: "Orange Line", color: "#F9461C", slug: "orange-line" },
    { name: "Pink Line", color: "#E27EA6", slug: "pink-line" },
    { name: "Purple Line", color: "#522398", slug: "purple-line" },
    { name: "Yellow Line", color: "#F9E300", slug: "yellow-line" },
  ];

  const supabase = await createClient();

  // Fetch bus routes from transit_stops for the current city
  const { data: busStopData } = await supabase
    .from("transit_stops")
    .select("routes")
    .eq("type", "bus")
    .eq("metro", city)
    .limit(20000);

  // Collect Metro Rail/BRT route IDs to exclude from bus list
  const metroRailRouteIds = isLA
    ? new Set(LA_METRO_LINES.map((l) => l.routeId))
    : new Set<string>();

  // For LA, strip GTFS agency suffix (e.g. "2-13196" → "2") and deduplicate
  const rawRoutes = (busStopData || []).flatMap((s) => s.routes || []);
  const cleanedRoutes = isLA
    ? rawRoutes.map((r) => (r.includes("-") ? r.split("-")[0] : r))
    : rawRoutes;

  const busRoutes = [...new Set(cleanedRoutes)]
    .filter((route) => {
      if (!isLA) return true;
      // Filter out Metro Rail/BRT route IDs
      return !metroRailRouteIds.has(route);
    })
    .sort(naturalSort);

  // Group bus routes by city-specific grouping
  const busGroups: Record<string, string[]> = {};
  for (const route of busRoutes) {
    const prefix = isLA ? getLABusGroup(route) : getNYCBusPrefix(route);
    if (!busGroups[prefix]) busGroups[prefix] = [];
    busGroups[prefix].push(route);
  }

  const busGroupOrder = isLA ? LA_BUS_GROUP_ORDER : NYC_BUS_GROUP_ORDER;

  // Metro Rail lines for LA
  const laRailLines = LA_METRO_LINES.filter((l) => l.group === "Rail");
  const laBRTLines = LA_METRO_LINES.filter((l) => l.group === "BRT");

  // Colors
  const accentColor = isChicago ? "#00A1DE" : isLA ? "#E3242B" : "#0039A6";

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
              name: `Apartments Near Transit in ${meta.fullName}`,
              description: `Find ${meta.fullName} apartments near ${isLA ? "Metro Rail stations and bus stops" : "subway stations and bus stops"}.`,
              url: canonicalUrl(cityPath("/transit", city)),
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
              <TrainFront className="w-6 h-6" style={{ color: accentColor }} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
              Apartments Near Transit
            </h1>
          </div>
          <p className="text-[#64748b] text-sm sm:text-base max-w-3xl">
            {isChicago
              ? "Find apartments within walking distance of CTA 'L' train stations across Chicago. Click any line to browse nearby buildings."
              : isLA
                ? "Find apartments within walking distance of LA Metro Rail stations and bus stops. Click any line or route to browse nearby buildings."
                : "Find apartments within walking distance of NYC subway stations and bus stops. Click any line or route to browse nearby buildings."}
          </p>
        </div>

        {/* Rail section */}
        {isChicago ? (
          <section className="mb-10">
            <h2 className="text-lg font-bold text-[#0F1D2E] mb-4 flex items-center gap-2">
              <TrainFront className="w-5 h-5 text-[#00A1DE]" />
              CTA &lsquo;L&rsquo; Lines
            </h2>
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6">
              <div className="flex flex-wrap gap-3">
                {CTA_LINES.map((line) => (
                  <Link
                    key={line.slug}
                    href={cityPath(`/transit/${line.slug}`, city)}
                    className="group flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-[#e2e8f0] hover:shadow-md hover:border-[#3B82F6]/40 transition-all bg-white"
                  >
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: line.color }}
                    >
                      {line.name.split(" ")[0].charAt(0)}
                    </span>
                    <span className="text-sm font-medium text-[#0F1D2E] group-hover:text-[#3B82F6] transition-colors">
                      {line.name}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#94a3b8] group-hover:text-[#3B82F6]" />
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : isLA ? (
          <>
            {/* LA Metro Rail Lines */}
            <section className="mb-10">
              <h2 className="text-lg font-bold text-[#0F1D2E] mb-4 flex items-center gap-2">
                <TrainFront className="w-5 h-5" style={{ color: accentColor }} />
                Metro Rail Lines
              </h2>
              <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6">
                <div className="flex flex-wrap gap-3">
                  {laRailLines.map((line) => (
                    <Link
                      key={line.slug}
                      href={transitLineUrl(line.slug, city)}
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
                  ))}
                </div>
              </div>
            </section>

            {/* LA BRT Lines */}
            {laBRTLines.length > 0 && (
              <section className="mb-10">
                <h2 className="text-lg font-bold text-[#0F1D2E] mb-4 flex items-center gap-2">
                  <Bus className="w-5 h-5" style={{ color: accentColor }} />
                  Bus Rapid Transit (BRT)
                </h2>
                <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6">
                  <div className="flex flex-wrap gap-3">
                    {laBRTLines.map((line) => (
                      <Link
                        key={line.slug}
                        href={transitLineUrl(line.slug, city)}
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
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        ) : (
          /* NYC Subway Lines */
          <section className="mb-10">
            <h2 className="text-lg font-bold text-[#0F1D2E] mb-4 flex items-center gap-2">
              <TrainFront className="w-5 h-5" style={{ color: accentColor }} />
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
        )}

        {/* Bus section */}
        {busRoutes.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-bold text-[#0F1D2E] mb-4 flex items-center gap-2">
              <Bus className="w-5 h-5" style={{ color: accentColor }} />
              {isLA ? "Metro Bus Routes" : "Bus Routes"}
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
                          href={transitLineUrl(
                            isLA ? laMetroBusSlug(route) : busRouteSlug(route),
                            city
                          )}
                          className={`px-3 py-1.5 text-sm font-medium rounded-lg border border-[#e2e8f0] text-[#0F1D2E] transition-all ${
                            isLA
                              ? "hover:bg-[#E3242B] hover:text-white hover:border-[#E3242B]"
                              : "hover:bg-[#0039A6] hover:text-white hover:border-[#0039A6]"
                          }`}
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
