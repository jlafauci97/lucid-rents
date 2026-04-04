"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  X,
  Building2,
  MapPin,
  ChevronLeft,
  ChevronRight,
  TrainFront,
  Bus,
} from "lucide-react";
import {
  searchNeighborhoods,
  NYC_ZIP_NEIGHBORHOODS,
  NYC_ZIP_BOROUGHS,
} from "@/lib/nyc-neighborhoods";
import {
  searchLANeighborhoods,
  LA_ZIP_NEIGHBORHOODS,
} from "@/lib/la-neighborhoods";
import { buildingUrl } from "@/lib/seo";
import type { City } from "@/lib/cities";

const PAGE_SIZE = 24;

export interface TransitBuilding {
  id: string;
  full_address: string;
  borough: string;
  zip_code: string | null;
  slug: string;
  year_built: number | null;
  total_units: number | null;
  owner_name: string | null;
  overall_score: number | null;
  review_count: number | null;
  violation_count: number;
  complaint_count: number;
  is_rent_stabilized: boolean | null;
  latitude: number;
  longitude: number;
  nearest_station: string;
  station_distance_mi: number;
}

interface TransitBuildingListProps {
  buildings: TransitBuilding[];
  lineSlug: string;
  lineType: "subway" | "bus";
  lineColor: string;
  lineTextColor: string;
  routeName: string;
  city?: City;
  rsLabel?: string;
}

export function TransitBuildingList({
  buildings,
  lineSlug,
  lineType,
  lineColor,
  lineTextColor,
  routeName,
  city = "nyc",
  rsLabel = "Rent Stabilized",
}: TransitBuildingListProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const isSubway = lineType === "subway";
  const isLA = city === "los-angeles";
  const Icon = isSubway ? TrainFront : Bus;
  const badgeColor = lineColor === "#FCCC0A" ? "#92400e" : lineColor;
  const badgeBg = `${lineColor}15`;

  // Resolve neighborhood matches for display chips (limited to 5)
  const neighborhoodMatches = useMemo(() => {
    if (query.trim().length < 2) return [];
    if (isLA) {
      return searchLANeighborhoods(query.trim(), 5).map((m) => ({
        zipCode: m.zipCode,
        name: m.name,
        borough: m.region,
      }));
    }
    return searchNeighborhoods(query.trim(), 5);
  }, [query, isLA]);

  // Get ALL zip codes that match the query (no limit) for filtering
  const matchedZips = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return new Set<string>();

    const zips = new Set<string>();
    const isDigits = /^\d+$/.test(q);

    const zipMap = isLA ? LA_ZIP_NEIGHBORHOODS : NYC_ZIP_NEIGHBORHOODS;

    for (const [zip, name] of Object.entries(zipMap)) {
      if (isDigits) {
        if (zip.startsWith(q)) zips.add(zip);
      } else {
        if (name.toLowerCase().includes(q)) zips.add(zip);
        // NYC has borough lookup
        if (!isLA) {
          const borough = NYC_ZIP_BOROUGHS[zip];
          if (borough && borough.toLowerCase().includes(q)) zips.add(zip);
        }
      }
    }
    return zips;
  }, [query, isLA]);

  // Filter buildings
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return buildings;

    return buildings.filter((b) => {
      const zip = b.zip_code?.trim() || "";
      // Match by neighborhood/borough zip codes
      if (matchedZips.size > 0 && zip && matchedZips.has(zip)) {
        return true;
      }
      // Match by zip code directly (partial match)
      if (zip && zip.startsWith(q)) return true;
      // Match by address, borough/area, station name (substring)
      if (b.full_address.toLowerCase().includes(q)) return true;
      if (b.borough.toLowerCase().includes(q)) return true;
      if (b.nearest_station.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [buildings, query, matchedZips]);

  // Reset to page 1 when query changes
  const safePage = page > Math.ceil(filtered.length / PAGE_SIZE) ? 1 : page;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  function handleQueryChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  const regionLabel = isLA ? "area" : "borough";

  return (
    <div>
      {/* Search input */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3ACBE]" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder={`Filter by neighborhood, zip code, or address...`}
            className="w-full pl-10 pr-10 py-3 text-sm border border-[#E2E8F0] rounded-xl bg-white text-[#1A1F36] placeholder:text-[#A3ACBE] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 focus:border-[#6366F1] transition-all"
          />
          {query && (
            <button
              onClick={() => handleQueryChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A3ACBE] hover:text-[#5E6687] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Neighborhood chips */}
        {neighborhoodMatches.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {neighborhoodMatches.map((match) => (
              <button
                key={match.zipCode}
                onClick={() => handleQueryChange(match.zipCode)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-[#E2E8F0] bg-white text-[#1A1F36] hover:bg-[#6366F1] hover:text-white hover:border-[#6366F1] transition-all"
              >
                <MapPin className="w-3 h-3" />
                {match.name} &middot; {match.borough} &middot; {match.zipCode}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results count */}
      <p className="text-sm text-[#5E6687] mb-4">
        {query ? (
          <>
            Showing {filtered.length.toLocaleString()} of{" "}
            {buildings.length.toLocaleString()} buildings
          </>
        ) : (
          <>
            Showing{" "}
            {filtered.length > 0
              ? `${(safePage - 1) * PAGE_SIZE + 1}\u2013${Math.min(safePage * PAGE_SIZE, filtered.length)}`
              : "0"}{" "}
            of {filtered.length.toLocaleString()} buildings
          </>
        )}
      </p>

      {/* Building cards */}
      {paged.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {paged.map((building) => (
            <Link
              key={building.id}
              href={buildingUrl(building, city)}
              className="group bg-white border border-[#E2E8F0] rounded-xl p-4 hover:shadow-md hover:border-[#6366F1]/40 transition-all"
            >
              <h3 className="font-semibold text-[#1A1F36] group-hover:text-[#6366F1] transition-colors truncate text-sm">
                {building.full_address}
              </h3>
              <div className="flex items-center gap-1 text-xs text-[#5E6687] mt-1">
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
                  {building.nearest_station} &middot;{" "}
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
                          : "text-[#5E6687]"
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
                          : "text-[#5E6687]"
                    }`}
                  >
                    {building.complaint_count.toLocaleString()} complaints
                  </span>
                )}
                {building.total_units ? (
                  <span className="text-[#5E6687]">
                    {building.total_units} units
                  </span>
                ) : null}
                {building.is_rent_stabilized && (
                  <span className="text-emerald-600 font-medium">
                    {rsLabel}
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
                  <span className="text-xs font-semibold text-[#1A1F36]">
                    {building.overall_score}/10
                  </span>
                </div>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center mb-6">
          <Building2 className="w-12 h-12 text-[#A3ACBE] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#1A1F36] mb-2">
            {query ? "No matching buildings" : "No buildings found"}
          </h3>
          <p className="text-sm text-[#5E6687]">
            {query
              ? `No buildings match "${query}". Try a different neighborhood, zip code, or address.`
              : "No buildings found near this transit line."}
          </p>
          {query && (
            <button
              onClick={() => handleQueryChange("")}
              className="mt-4 text-sm text-[#6366F1] hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border border-[#E2E8F0] rounded-xl mb-6">
          <p className="text-sm text-[#5E6687]">
            Page {safePage} of {totalPages}
          </p>
          <div className="flex gap-2">
            {safePage > 1 && (
              <button
                onClick={() => setPage(safePage - 1)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-[#E2E8F0] rounded-lg hover:bg-gray-50 transition-colors text-[#5E6687]"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
            )}
            {safePage < totalPages && (
              <button
                onClick={() => setPage(safePage + 1)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-[#E2E8F0] rounded-lg hover:bg-gray-50 transition-colors text-[#5E6687]"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
