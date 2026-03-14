import { createClient } from "@/lib/supabase/server";
import {
  ChevronLeft,
  TrainFront,
  Bus,
} from "lucide-react";
import Link from "next/link";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import {
  getLineBySlug,
  SUBWAY_LINES,
  transitLineUrl,
  busRouteFromSlug,
} from "@/lib/subway-lines";
import { TransitBuildingList } from "@/components/transit/TransitBuildingList";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const revalidate = 86400;

const MAX_DISTANCE_MI = 0.35;
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
}: {
  params: Promise<{ city: string; line: string }>;
}) {
  const { line: lineSlug } = await params;
  const lineInfo = parseLineSlug(lineSlug);
  if (!lineInfo) notFound();

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
  const stationCount = new Set(
    buildingsWithDistance.map((b) => b.nearest_station)
  ).size;

  const isSubway = lineInfo.type === "subway";
  const Icon = isSubway ? TrainFront : Bus;

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

        {/* Search + building cards + pagination (client component) */}
        <TransitBuildingList
          buildings={buildingsWithDistance}
          lineSlug={lineSlug}
          lineType={lineInfo.type}
          lineColor={lineInfo.color}
          lineTextColor={lineInfo.textColor}
          routeName={lineInfo.routeName}
        />

        <AdBlock adSlot="TRANSIT_BOTTOM" adFormat="horizontal" />
      </div>
    </AdSidebar>
  );
}
