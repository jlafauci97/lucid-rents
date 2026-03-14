import { createClient } from "@/lib/supabase/server";
import {
  Building2,
  MapPin,
  ChevronLeft,
  ChevronRight,
  TrainFront,
  Bus,
} from "lucide-react";
import Link from "next/link";
import { buildingUrl, canonicalUrl, cityPath } from "@/lib/seo";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import {
  getLineBySlug,
  SUBWAY_LINES,
  transitLineUrl,
  busRouteFromSlug,
} from "@/lib/subway-lines";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const revalidate = 86400;

const MAX_DISTANCE_MI = 0.35;
const PAGE_SIZE = 24;
const STOP_CHUNK_SIZE = 10;

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

interface LineInfo {
  type: "subway" | "bus";
  routeName: string;
  displayName: string;
  color: string;
  textColor: string;
}

function parseLineSlug(slug: string): LineInfo | null {
  const subwayLine = getLineBySlug(slug);
  if (subwayLine) {
    return {
      type: "subway",
      routeName: subwayLine.letter,
      displayName: subwayLine.name,
      color: subwayLine.color,
      textColor: subwayLine.textColor,
    };
  }
  const busRoute = busRouteFromSlug(slug);
  if (busRoute) {
    return {
      type: "bus",
      routeName: busRoute,
      displayName: `${busRoute} Bus`,
      color: "#0039A6",
      textColor: "white",
    };
  }
  return null;
}

export async function generateStaticParams() {
  return SUBWAY_LINES.map((line) => ({
    city: "nyc",
    line: line.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; line: string }>;
}): Promise<Metadata> {
  const { line: lineSlug } = await params;
  const lineInfo = parseLineSlug(lineSlug);
  if (!lineInfo) return { title: "Not Found | Lucid Rents" };

  const typeWord = lineInfo.type === "subway" ? "stations" : "stops";
  const title = `Apartments Near the ${lineInfo.displayName} | Lucid Rents`;
  const description = `Find apartments and buildings near ${lineInfo.displayName} ${typeWord} in NYC. Browse buildings within walking distance with violation records, reviews, and rent stabilization status.`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl(transitLineUrl(lineSlug)) },
    openGraph: {
      title: `Apartments Near the ${lineInfo.displayName}`,
      description,
      url: canonicalUrl(transitLineUrl(lineSlug)),
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

export default async function TransitLinePage({
  params,
  searchParams,
}: {
  params: Promise<{ city: string; line: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { line: lineSlug } = await params;
  const sp = await searchParams;
  const lineInfo = parseLineSlug(lineSlug);
  if (!lineInfo) notFound();

  const page = Math.max(1, parseInt(sp.page || "1", 10));
  const supabase = await createClient();

  // 1. Get all stops for this line
  const { data: stops } = await supabase
    .from("transit_stops")
    .select("name, latitude, longitude")
    .eq("type", lineInfo.type)
    .contains("routes", [lineInfo.routeName]);

  if (!stops || stops.length === 0) notFound();

  // 2. Query buildings near stops using chunked OR bounding box filters
  const columns =
    "id, full_address, borough, zip_code, slug, year_built, total_units, owner_name, overall_score, review_count, violation_count, complaint_count, is_rent_stabilized, latitude, longitude";

  const chunks: (typeof stops)[] = [];
  for (let i = 0; i < stops.length; i += STOP_CHUNK_SIZE) {
    chunks.push(stops.slice(i, i + STOP_CHUNK_SIZE));
  }

  const chunkResults = await Promise.all(
    chunks.map((chunk) => {
      const orFilter = chunk
        .map((s) => {
          const lat = Number(s.latitude);
          const lng = Number(s.longitude);
          return `and(latitude.gte.${lat - 0.005},latitude.lte.${lat + 0.005},longitude.gte.${lng - 0.005},longitude.lte.${lng + 0.005})`;
        })
        .join(",");
      return supabase
        .from("buildings")
        .select(columns)
        .or(orFilter)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .limit(5000);
    })
  );

  // 3. Merge and deduplicate
  const seen = new Set<string>();
  const allBuildings = chunkResults
    .flatMap((r) => r.data || [])
    .filter((b) => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });

  // 4. Compute nearest stop and distance for each building
  const buildingsWithDistance = allBuildings
    .map((b) => {
      let nearestStation = "";
      let minDist = Infinity;
      for (const stop of stops) {
        const dist = haversineDistance(
          Number(b.latitude),
          Number(b.longitude),
          Number(stop.latitude),
          Number(stop.longitude)
        );
        if (dist < minDist) {
          minDist = dist;
          nearestStation = stop.name;
        }
      }
      return {
        ...b,
        nearest_station: nearestStation,
        station_distance_mi: Math.round(minDist * 100) / 100,
      };
    })
    .filter((b) => b.station_distance_mi <= MAX_DISTANCE_MI)
    .sort(
      (a, b) =>
        a.nearest_station.localeCompare(b.nearest_station) ||
        a.full_address.localeCompare(b.full_address)
    );

  const totalCount = buildingsWithDistance.length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const paged = buildingsWithDistance.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );
  const stationCount = new Set(
    buildingsWithDistance.map((b) => b.nearest_station)
  ).size;

  const isSubway = lineInfo.type === "subway";
  const Icon = isSubway ? TrainFront : Bus;
  const badgeColor =
    lineInfo.color === "#FCCC0A" ? "#92400e" : lineInfo.color;
  const badgeBg = `${lineInfo.color}15`;

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
              name: `Apartments Near the ${lineInfo.displayName}`,
              description: `${totalCount} buildings near ${lineInfo.displayName} ${isSubway ? "stations" : "stops"} in NYC`,
              url: canonicalUrl(transitLineUrl(lineSlug)),
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
          <Link
            href={cityPath("/transit")}
            className="inline-flex items-center gap-1 text-sm text-[#64748b] hover:text-[#3B82F6] transition-colors mb-3"
          >
            <ChevronLeft className="w-4 h-4" />
            All Transit Lines
          </Link>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
              style={{
                backgroundColor: lineInfo.color,
                color: lineInfo.textColor,
              }}
            >
              {isSubway ? (
                lineInfo.routeName
              ) : (
                <Icon className="w-5 h-5" />
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
              Apartments Near the {lineInfo.displayName}
            </h1>
          </div>
          <p className="text-[#64748b] text-sm sm:text-base max-w-3xl mt-2">
            {totalCount.toLocaleString()} buildings within walking distance of{" "}
            {stationCount} {lineInfo.displayName}{" "}
            {isSubway ? "stations" : "stops"}.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Buildings
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
              {totalCount.toLocaleString()}
            </p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              {isSubway ? "Stations" : "Stops"}
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">
              {stationCount}
            </p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">
              Walk Radius
            </p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">0.35 mi</p>
          </div>
        </div>

        {/* Results info */}
        {totalCount > 0 && (
          <p className="text-sm text-[#64748b] mb-4">
            Showing {(page - 1) * PAGE_SIZE + 1}&ndash;
            {Math.min(page * PAGE_SIZE, totalCount)} of{" "}
            {totalCount.toLocaleString()} buildings
          </p>
        )}

        {/* Building cards */}
        {paged.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {paged.map((building) => (
              <Link
                key={building.id}
                href={buildingUrl(building)}
                className="group bg-white border border-[#e2e8f0] rounded-xl p-4 hover:shadow-md hover:border-[#3B82F6]/40 transition-all"
              >
                <h3 className="font-semibold text-[#0F1D2E] group-hover:text-[#3B82F6] transition-colors truncate text-sm">
                  {building.full_address}
                </h3>
                <div className="flex items-center gap-1 text-xs text-[#64748b] mt-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {building.borough}
                  {building.zip_code && ` \u00b7 ${building.zip_code}`}
                  {building.year_built
                    ? ` \u00b7 Built ${building.year_built}`
                    : ""}
                </div>

                {/* Station badge */}
                <div className="mt-3">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: badgeBg, color: badgeColor }}
                  >
                    <Icon className="w-3 h-3" />
                    {building.nearest_station} \u00b7{" "}
                    {building.station_distance_mi} mi
                  </span>
                </div>

                {/* Stats */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs">
                  {building.violation_count > 0 && (
                    <span
                      className={`font-medium ${
                        building.violation_count > 50
                          ? "text-[#ef4444]"
                          : building.violation_count > 10
                            ? "text-[#f97316]"
                            : "text-[#64748b]"
                      }`}
                    >
                      {building.violation_count.toLocaleString()} violations
                    </span>
                  )}
                  {building.complaint_count > 0 && (
                    <span
                      className={`font-medium ${
                        building.complaint_count > 50
                          ? "text-[#ef4444]"
                          : building.complaint_count > 10
                            ? "text-[#f97316]"
                            : "text-[#64748b]"
                      }`}
                    >
                      {building.complaint_count.toLocaleString()} complaints
                    </span>
                  )}
                  {building.total_units ? (
                    <span className="text-[#64748b]">
                      {building.total_units} units
                    </span>
                  ) : null}
                  {building.is_rent_stabilized && (
                    <span className="text-emerald-600 font-medium">
                      Rent Stabilized
                    </span>
                  )}
                </div>

                {/* Score bar */}
                {building.overall_score != null && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(Number(building.overall_score) / 10) * 100}%`,
                          backgroundColor:
                            Number(building.overall_score) >= 7
                              ? "#22c55e"
                              : Number(building.overall_score) >= 4
                                ? "#f59e0b"
                                : "#ef4444",
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-[#0F1D2E]">
                      {building.overall_score}/10
                    </span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-12 text-center mb-6">
            <Building2 className="w-12 h-12 text-[#94a3b8] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#0F1D2E] mb-2">
              No buildings found
            </h3>
            <p className="text-sm text-[#64748b]">
              No buildings found near {lineInfo.displayName}{" "}
              {isSubway ? "stations" : "stops"}.
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-white border border-[#e2e8f0] rounded-xl mb-6">
            <p className="text-sm text-[#64748b]">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`${transitLineUrl(lineSlug)}?page=${page - 1}`}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-[#e2e8f0] rounded-lg hover:bg-gray-50 transition-colors text-[#64748b]"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`${transitLineUrl(lineSlug)}?page=${page + 1}`}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-[#e2e8f0] rounded-lg hover:bg-gray-50 transition-colors text-[#64748b]"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        )}

        <AdBlock adSlot="TRANSIT_BOTTOM" adFormat="horizontal" />
      </div>
    </AdSidebar>
  );
}
