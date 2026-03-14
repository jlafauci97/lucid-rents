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
import { searchNeighborhoods } from "@/lib/nyc-neighborhoods";
import { buildingUrl } from "@/lib/seo";
import { transitLineUrl } from "@/lib/subway-lines";

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
}

export function TransitBuildingList({
  buildings,
  lineSlug,
  lineType,
  lineColor,
  lineTextColor,
  routeName,
}: TransitBuildingListProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const isSubway = lineType === "subway";
  const Icon = isSubway ? TrainFront : Bus;
  const badgeColor = lineColor === "#FCCC0A" ? "#92400e" : lineColor;
  const badgeBg = `${lineColor}15`;

  // Resolve neighborhood matches for display chips
  const neighborhoodMatches = useMemo(() => {
    if (query.trim().length < 2) return [];
    return searchNeighborhoods(query.trim(), 5);
  }, [query]);

  // Get the set of zip codes that match neighborhoods
  const matchedZips = useMemo(() => {
    return new Set(neighborhoodMatches.map((m) => m.zipCode));
  }, [neighborhoodMatches]);

  // Filter buildings
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return buildings;

    return buildings.filter((b) => {
      // Match by neighborhood zip codes
      if (matchedZips.size > 0 && b.zip_code && matchedZips.has(b.zip_code)) {
        return true;
      }
      // Match by zip code directly
      if (b.zip_code && b.zip_code.startsWith(q)) return true;
      // Match by address, borough, station name
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

  return (
    <div>
      {/* Search input */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Filter by neighborhood, zip code, or address..."
            className="w-full pl-10 pr-10 py-3 text-sm border border-[#e2e8f0] rounded-xl bg-white text-[#0F1D2E] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 focus:border-[#3B82F6] transition-all"
          />
          {query && (
            <button
              onClick={() => handleQueryChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b] transition-colors"
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-[#e2e8f0] bg-white text-[#0F1D2E] hover:bg-[#3B82F6] hover:text-white hover:border-[#3B82F6] transition-all"
              >
                <MapPin className="w-3 h-3" />
                {match.name} &middot; {match.borough} &middot; {match.zipCode}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results count */}
      <p className="text-sm text-[#64748b] mb-4">
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
            {query ? "No matching buildings" : "No buildings found"}
          </h3>
          <p className="text-sm text-[#64748b]">
            {query
              ? `No buildings match "${query}". Try a different neighborhood, zip code, or address.`
              : "No buildings found near this transit line."}
          </p>
          {query && (
            <button
              onClick={() => handleQueryChange("")}
              className="mt-4 text-sm text-[#3B82F6] hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border border-[#e2e8f0] rounded-xl mb-6">
          <p className="text-sm text-[#64748b]">
            Page {safePage} of {totalPages}
          </p>
          <div className="flex gap-2">
            {safePage > 1 && (
              <button
                onClick={() => setPage(safePage - 1)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-[#e2e8f0] rounded-lg hover:bg-gray-50 transition-colors text-[#64748b]"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
            )}
            {safePage < totalPages && (
              <button
                onClick={() => setPage(safePage + 1)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-[#e2e8f0] rounded-lg hover:bg-gray-50 transition-colors text-[#64748b]"
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
