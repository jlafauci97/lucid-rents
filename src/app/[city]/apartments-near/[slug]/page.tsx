import { createCacheClient } from "@/lib/supabase/cache-client";
import { unwrap } from "@/lib/supabase/unwrap";
import { MapPin, TrainFront, Bus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { canonicalUrl, cityPath, cityBreadcrumbs, buildingUrl } from "@/lib/seo";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { normalizeScore } from "@/lib/constants";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { AdSidebar } from "@/components/ui/AdSidebar";
import {
  getLineBySlug,
  getMetroLineBySlug,
  getCTALineBySlug,
  transitLineUrl,
  busRouteFromSlug,
  laMetroBusFromSlug,
} from "@/lib/subway-lines";
import { TransitBuildingList, type TransitBuilding } from "@/components/transit/TransitBuildingList";
import { getLandmarkBySlug, getLandmarksByCity } from "@/lib/landmarks";

// 7-day ISR — transit topology and building sets change slowly, and at 24h
// every line page (hundreds per metro) went cold daily against heavy queries.
export const revalidate = 604800;
export const dynamicParams = true;

// ─── Shared helpers ──────────────────────────────────────────────────────────

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

// ─── Transit line helpers ─────────────────────────────────────────────────────

const MAX_TRANSIT_DISTANCE_MI = 0.35;

interface LineInfo {
  type: "subway" | "bus" | "rail";
  routeName: string;
  altRouteNames?: string[];
  displayName: string;
  color: string;
  textColor: string;
}

function parseLineSlug(slug: string, city: City): LineInfo | null {
  if (city === "chicago") {
    const ctaLine = getCTALineBySlug(slug);
    if (ctaLine) {
      // transit_stops stores CTA routes inconsistently — some stops carry
      // "Red Line", others bare "Purple". Match both; querying only the bare
      // routeName left Red/Blue/Yellow with zero stops (empty pages).
      return { type: "subway", routeName: ctaLine.routeName, altRouteNames: [ctaLine.name], displayName: ctaLine.name, color: ctaLine.color, textColor: ctaLine.textColor };
    }
    return null;
  }
  if (city === "los-angeles") {
    const metroLine = getMetroLineBySlug(slug);
    if (metroLine) {
      return { type: "rail", routeName: metroLine.routeId, altRouteNames: [metroLine.name], displayName: metroLine.name, color: metroLine.color, textColor: metroLine.textColor };
    }
    const laBusRoute = laMetroBusFromSlug(slug);
    if (laBusRoute) {
      return { type: "bus", routeName: laBusRoute, displayName: `Metro Bus ${laBusRoute}`, color: "#E3242B", textColor: "white" };
    }
    return null;
  }
  const subwayLine = getLineBySlug(slug);
  if (subwayLine) {
    return { type: "subway", routeName: subwayLine.letter, displayName: subwayLine.name, color: subwayLine.color, textColor: subwayLine.textColor };
  }
  const busRoute = busRouteFromSlug(slug);
  if (busRoute) {
    return { type: "bus", routeName: busRoute, displayName: `${busRoute} Bus`, color: "#0039A6", textColor: "white" };
  }
  return null;
}

// ─── Static params ────────────────────────────────────────────────────────────

export async function generateStaticParams() {
  const { LANDMARKS } = await import("@/lib/landmarks");
  return LANDMARKS.map((l) => ({ city: l.city, slug: l.slug }));
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; slug: string }>;
}): Promise<Metadata> {
  const { city: cityParam, slug } = await params;
  const city = (isValidCity(cityParam) ? cityParam : "nyc") as City;
  const meta = CITY_META[city];

  // Transit line
  const lineInfo = parseLineSlug(slug, city);
  if (lineInfo) {
    const title = `Apartments Near the ${lineInfo.displayName}`;
    const description = `Live near the ${lineInfo.displayName}? Browse ${meta.fullName} apartments within walking distance of every stop — with violation records, reviews, and rent stabilization status.`;
    return {
      title,
      description,
      alternates: { canonical: canonicalUrl(transitLineUrl(slug, city)) },
      openGraph: { title: `Apartments Near the ${lineInfo.displayName}`, description, url: canonicalUrl(transitLineUrl(slug, city)), siteName: "Lucid Rents", type: "website", locale: "en_US" },
    };
  }

  // Landmark
  const landmarkData = getLandmarkBySlug(slug, city);
  if (landmarkData) {
    return {
      title: `Apartments Near ${landmarkData.name}`,
      description: `Find apartments within walking distance of ${landmarkData.name} in ${meta.fullName}. Browse buildings, check violations, and compare rents.`,
      alternates: { canonical: canonicalUrl(cityPath(`/apartments-near/${slug}`, city)) },
      openGraph: {
        title: `Apartments Near ${landmarkData.name} — ${meta.fullName}`,
        description: `Find apartments near ${landmarkData.name} in ${meta.fullName}. Check violations, scores, and rent data before you move.`,
        url: canonicalUrl(cityPath(`/apartments-near/${slug}`, city)),
        siteName: "Lucid Rents",
        type: "website",
      },
    };
  }

  return { title: "Not Found" };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ApartmentsNearPage({
  params,
}: {
  params: Promise<{ city: string; slug: string }>;
}) {
  const { city: cityParam, slug } = await params;
  const city = (isValidCity(cityParam) ? cityParam : "nyc") as City;
  const meta = CITY_META[city];

  const lineInfo = parseLineSlug(slug, city);
  const landmarkData = getLandmarkBySlug(slug, city);

  if (!lineInfo && !landmarkData) notFound();

  const supabase = createCacheClient();

  // ── Transit line branch ───────────────────────────────────────────────────
  if (lineInfo) {
    const dbType = lineInfo.type === "subway" ? "subway" : lineInfo.type;
    const routeNames = [lineInfo.routeName, ...(lineInfo.altRouteNames || [])];
    // Single RPC: stops lookup + ST_DWithin against the geography gist index,
    // nearest stop resolved in SQL. The previous approach (an OR of lat/lng
    // bounding boxes per chunk of 10 stops, one buildings query per chunk)
    // bitmap-scanned a full latitude band per stop — 4–12s cold on long bus
    // routes and statement-timeout 500s under crawl load.
    // unwrap(): a DB error must surface as a 500, not fall through to the
    // notFound() below (see src/lib/supabase/unwrap.ts).
    const nearRows = unwrap(
      await supabase.rpc("buildings_near_transit", {
        p_metro: city,
        p_type: dbType,
        p_routes: routeNames,
        p_radius_m: MAX_TRANSIT_DISTANCE_MI * 1609.344,
      }),
      `buildings_near_transit ${city}/${slug}`
    ) as TransitBuilding[] | null;

    // Empty result = the route has no stops in transit_stops (unknown slug).
    if (!nearRows || nearRows.length === 0) notFound();

    const buildingsWithDistance = nearRows
      .map((b) => ({ ...b, station_distance_mi: Number(b.station_distance_mi) }))
      .sort((a, b) => a.nearest_station.localeCompare(b.nearest_station) || a.full_address.localeCompare(b.full_address));

    const totalCount = buildingsWithDistance.length;
    const stationCount = new Set(buildingsWithDistance.map((b) => b.nearest_station)).size;
    const isRail = lineInfo.type === "subway" || lineInfo.type === "rail";
    const Icon = isRail ? TrainFront : Bus;
    const stopWord = isRail ? "stations" : "stops";
    const rsLabel = city === "los-angeles" ? "RSO" : "Rent Stabilized";

    return (
      <AdSidebar withMultiplexAd>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", name: `Apartments Near the ${lineInfo.displayName}`, description: `${totalCount} buildings near ${lineInfo.displayName} ${stopWord} in ${meta.fullName}`, url: canonicalUrl(transitLineUrl(slug, city)), publisher: { "@type": "Organization", name: "Lucid Rents", url: "https://lucidrents.com" } }) }} />

          <Breadcrumbs items={cityBreadcrumbs(city, { label: "Transit", href: cityPath("/transit", city) }, { label: lineInfo.displayName, href: transitLineUrl(slug, city) })} />

          <div className="mb-8 mt-4">
            <Link href={cityPath("/transit", city)} className="inline-flex items-center gap-1 text-sm text-[#64748b] hover:text-[#3B82F6] transition-colors mb-3">
              ← All Transit Lines
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0" style={{ backgroundColor: lineInfo.color, color: lineInfo.textColor }}>
                {isRail ? (lineInfo.type === "rail" ? lineInfo.displayName.charAt(0) : lineInfo.routeName) : <Icon className="w-5 h-5" />}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">Apartments Near the {lineInfo.displayName}</h1>
            </div>
            <p className="text-[#64748b] text-sm sm:text-base max-w-3xl mt-2">
              {totalCount.toLocaleString()} buildings within walking distance of {stationCount} {lineInfo.displayName} {stopWord}.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
              <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">Buildings</p>
              <p className="text-2xl font-bold text-[#0F1D2E] mt-1">{totalCount.toLocaleString()}</p>
            </div>
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
              <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">{isRail ? "Stations" : "Stops"}</p>
              <p className="text-2xl font-bold text-[#0F1D2E] mt-1">{stationCount}</p>
            </div>
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
              <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">Walk Radius</p>
              <p className="text-2xl font-bold text-[#0F1D2E] mt-1">0.35 mi</p>
            </div>
          </div>

          <TransitBuildingList buildings={buildingsWithDistance} lineSlug={slug} lineType={lineInfo.type === "rail" ? "subway" : lineInfo.type} lineColor={lineInfo.color} lineTextColor={lineInfo.textColor} routeName={lineInfo.routeName} city={city} rsLabel={rsLabel} />
        </div>
      </AdSidebar>
    );
  }

  // ── Landmark branch ───────────────────────────────────────────────────────
  const MAX_LANDMARK_DISTANCE_MI = 0.5;
  const latDelta = 0.007;
  const lngDelta = 0.007;

  const { data: rawBuildings } = await supabase
    .from("buildings")
    .select("id, full_address, borough, slug, metro, overall_score, violation_count, complaint_count, is_rent_stabilized, latitude, longitude")
    .eq("metro", city)
    .gte("latitude", landmarkData!.lat - latDelta)
    .lte("latitude", landmarkData!.lat + latDelta)
    .gte("longitude", landmarkData!.lng - lngDelta)
    .lte("longitude", landmarkData!.lng + lngDelta)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .limit(2000);

  const buildingsWithDistance = (rawBuildings || [])
    .map((b) => ({
      ...b,
      distance_mi: haversineDistance(Number(b.latitude), Number(b.longitude), landmarkData!.lat, landmarkData!.lng),
    }))
    .filter((b) => b.distance_mi <= MAX_LANDMARK_DISTANCE_MI)
    .sort((a, b) => a.distance_mi - b.distance_mi);

  const totalCount = buildingsWithDistance.length;

  return (
    <AdSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", name: `Apartments Near ${landmarkData!.name} in ${meta.fullName}`, description: `${totalCount} apartments within ${MAX_LANDMARK_DISTANCE_MI} miles of ${landmarkData!.name}`, url: canonicalUrl(cityPath(`/apartments-near/${slug}`, city)), publisher: { "@type": "Organization", name: "Lucid Rents", url: "https://lucidrents.com" } }) }} />

        <Breadcrumbs items={cityBreadcrumbs(city, { label: "Transit", href: cityPath("/transit", city) }, { label: `Near ${landmarkData!.name}`, href: cityPath(`/apartments-near/${slug}`, city) })} />

        <div className="mb-8 mt-4">
          <Link href={cityPath("/transit", city)} className="inline-flex items-center gap-1 text-sm text-[#64748b] hover:text-[#3B82F6] transition-colors mb-3">
            ← Back to Transit
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <MapPin className="w-6 h-6 text-[#3B82F6]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">Apartments Near {landmarkData!.name}</h1>
          </div>
          <p className="text-[#64748b] text-sm sm:text-base max-w-3xl">
            {totalCount.toLocaleString()} buildings within {MAX_LANDMARK_DISTANCE_MI} miles of {landmarkData!.name} in {meta.fullName}.
            {landmarkData!.description && ` ${landmarkData!.description}.`}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">Buildings</p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">{totalCount.toLocaleString()}</p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">Type</p>
            <p className="text-lg font-bold text-[#0F1D2E] mt-1 capitalize">{landmarkData!.category}</p>
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">Max Walk</p>
            <p className="text-2xl font-bold text-[#0F1D2E] mt-1">{MAX_LANDMARK_DISTANCE_MI} mi</p>
          </div>
        </div>

        {totalCount === 0 ? (
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-12 text-center">
            <MapPin className="w-12 h-12 text-[#cbd5e1] mx-auto mb-3" />
            <p className="text-[#64748b]">No buildings found within walking distance.</p>
          </div>
        ) : (
          <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">Address</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden sm:table-cell">{meta.regionLabel}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">Distance</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden md:table-cell">Score</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden md:table-cell">Violations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {buildingsWithDistance.slice(0, 100).map((b) => (
                    <tr key={b.id} className="hover:bg-[#f8fafc] transition-colors">
                      <td className="px-4 py-3">
                        <Link href={buildingUrl(b as { borough: string; slug: string }, city)} className="text-sm font-medium text-[#2563EB] hover:underline">
                          {b.full_address}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#334155] hidden sm:table-cell">{b.borough}</td>
                      <td className="px-4 py-3 text-sm text-[#64748b] text-right">{b.distance_mi.toFixed(2)} mi</td>
                      <td className="px-4 py-3 text-sm font-semibold text-right hidden md:table-cell">{b.overall_score !== null ? normalizeScore(b.overall_score).toFixed(1) : "—"}</td>
                      <td className="px-4 py-3 text-sm text-right hidden md:table-cell">{(b.violation_count || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalCount > 100 && (
              <div className="px-4 py-3 border-t border-[#e2e8f0] bg-[#f8fafc] text-xs text-[#64748b] text-center">
                Showing 100 of {totalCount.toLocaleString()} buildings
              </div>
            )}
          </div>
        )}

        <div className="mt-8">
          <h2 className="text-lg font-bold text-[#0F1D2E] mb-4">Other Landmarks in {meta.fullName}</h2>
          <div className="flex flex-wrap gap-2">
            {getLandmarksByCity(city).filter((l) => l.slug !== slug).map((l) => (
              <Link key={l.slug} href={cityPath(`/apartments-near/${l.slug}`, city)} className="px-3 py-1.5 text-sm bg-[#f1f5f9] text-[#475569] rounded-full hover:bg-[#e2e8f0] transition-colors">
                Near {l.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AdSidebar>
  );
}
