"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { List, Map as MapIcon } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/proposal-categories";
import { STATUS_LABELS } from "@/lib/proposal-status";
import { CITY_META, type City } from "@/lib/cities";

interface Props {
  city: City;
}

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "legislation", label: "Legislation" },
  { value: "land_use", label: "Land Use" },
];

export function ProposalFilters({ city }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentView = searchParams.get("view") || "list";
  const currentBorough = searchParams.get("borough") || "";
  const currentDistrict = searchParams.get("district") || "";
  const currentCategory = searchParams.get("category") || "";
  const currentStatus = searchParams.get("status") || "";
  const currentType = searchParams.get("type") || "all";

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all" && value !== "") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const meta = CITY_META[city];
  const isNyc = city === "nyc";

  const locationOptions = isNyc
    ? meta.regions.map((r) => ({ value: r, label: r }))
    : Array.from({ length: 15 }, (_, i) => ({
        value: String(i + 1),
        label: `Council District ${i + 1}`,
      }));

  const locationKey = isNyc ? "borough" : "district";
  const locationValue = isNyc ? currentBorough : currentDistrict;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <select
        value={locationValue}
        onChange={(e) => updateParam(locationKey, e.target.value)}
        className="px-3 py-1.5 text-sm border border-[#E2E8F0] rounded-lg bg-white text-[#1A1F36] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
      >
        <option value="">{isNyc ? "All Boroughs" : "All Districts"}</option>
        {locationOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <select
        value={currentCategory}
        onChange={(e) => updateParam("category", e.target.value)}
        className="px-3 py-1.5 text-sm border border-[#E2E8F0] rounded-lg bg-white text-[#1A1F36] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
      >
        <option value="">All Categories</option>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>

      <select
        value={currentStatus}
        onChange={(e) => updateParam("status", e.target.value)}
        className="px-3 py-1.5 text-sm border border-[#E2E8F0] rounded-lg bg-white text-[#1A1F36] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
      >
        <option value="">All Statuses</option>
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>

      <select
        value={currentType}
        onChange={(e) => updateParam("type", e.target.value)}
        className="px-3 py-1.5 text-sm border border-[#E2E8F0] rounded-lg bg-white text-[#1A1F36] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
      >
        {TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <div className="ml-auto flex items-center gap-1 bg-[#F5F7FA] rounded-lg p-0.5">
        <button
          onClick={() => updateParam("view", "list")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            currentView === "list"
              ? "bg-white text-[#1A1F36] shadow-sm"
              : "text-[#5E6687] hover:text-[#1A1F36]"
          }`}
        >
          <List className="w-3.5 h-3.5" />
          List
        </button>
        <button
          onClick={() => updateParam("view", "map")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            currentView === "map"
              ? "bg-white text-[#1A1F36] shadow-sm"
              : "text-[#5E6687] hover:text-[#1A1F36]"
          }`}
        >
          <MapIcon className="w-3.5 h-3.5" />
          Map
        </button>
      </div>
    </div>
  );
}
