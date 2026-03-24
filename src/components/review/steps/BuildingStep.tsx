"use client";

import { useState, useEffect, useRef } from "react";
import { Search, MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { PillToggle } from "@/components/ui/PillToggle";
import { useDebounce } from "@/hooks/useDebounce";
import type { Building } from "@/types";

interface BuildingStepProps {
  selectedBuilding: Building | null;
  onBuildingSelect: (building: Building | null) => void;
  unitNumber: string;
  onUnitNumberChange: (value: string) => void;
  isCurrentResident: boolean;
  onResidencyChange: (isCurrent: boolean) => void;
  displayPreference: "name" | "anonymous";
  onDisplayPreferenceChange: (value: "name" | "anonymous") => void;
  userName: string | null;
}

export function BuildingStep({
  selectedBuilding,
  onBuildingSelect,
  unitNumber,
  onUnitNumberChange,
  isCurrentResident,
  onResidencyChange,
  displayPreference,
  onDisplayPreferenceChange,
  userName,
}: BuildingStepProps) {
  const [buildingSearch, setBuildingSearch] = useState("");
  const [buildingResults, setBuildingResults] = useState<Building[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(buildingSearch, 300);

  // Debounced building search
  useEffect(() => {
    if (debouncedSearch.length < 2) {
      setBuildingResults([]);
      setSearchOpen(false);
      return;
    }
    setSearchLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(debouncedSearch)}&limit=6`)
      .then((res) => res.json())
      .then((data) => {
        setBuildingResults(data.buildings || []);
        setSearchOpen(true);
      })
      .catch(() => setBuildingResults([]))
      .finally(() => setSearchLoading(false));
  }, [debouncedSearch]);

  // Click outside to close search
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function formatDisplayName(): string {
    if (!userName) return "Anonymous";
    const parts = userName.trim().split(/\s+/);
    if (parts.length < 2) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-[#0F1D2E]">
        Select Your Building
      </h2>

      {selectedBuilding ? (
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-[#3B82F6]" />
            <div>
              <p className="text-sm font-medium text-[#0F1D2E]">
                {selectedBuilding.full_address}
              </p>
              <p className="text-xs text-[#64748b]">
                {selectedBuilding.borough}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onBuildingSelect(null)}
            className="text-sm text-[#ef4444] hover:underline"
          >
            Change
          </button>
        </div>
      ) : (
        <div ref={searchRef} className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94a3b8]" />
            <input
              type="text"
              value={buildingSearch}
              onChange={(e) => setBuildingSearch(e.target.value)}
              onFocus={() => buildingResults.length > 0 && setSearchOpen(true)}
              placeholder="Search for your building address..."
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-[#e2e8f0] bg-white text-sm text-[#0F1D2E] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
            />
            {searchLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94a3b8] animate-spin" />
            )}
          </div>
          {searchOpen && buildingResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white rounded-lg border border-[#e2e8f0] shadow-lg overflow-hidden">
              {buildingResults.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    onBuildingSelect(b);
                    setSearchOpen(false);
                    setBuildingSearch("");
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm"
                >
                  <p className="font-medium text-[#0F1D2E]">
                    {b.full_address}
                  </p>
                  <p className="text-xs text-[#64748b]">{b.borough}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Input
        label="Unit Number *"
        value={unitNumber}
        onChange={(e) => onUnitNumberChange(e.target.value)}
        placeholder="e.g., 4B, 12A, Studio"
        required
      />

      <PillToggle
        label="Residency Status"
        value={isCurrentResident}
        onChange={onResidencyChange}
        options={[
          { label: "Current Resident", value: true },
          { label: "Past Resident", value: false },
        ]}
        required
      />

      <div className="space-y-2">
        <label className="block text-sm font-medium text-[#0F1D2E]">
          Display Preference
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onDisplayPreferenceChange("name")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
              displayPreference === "name"
                ? "bg-[#3B82F6] text-white border-[#3B82F6]"
                : "border-[#e2e8f0] text-[#64748b] hover:bg-gray-50"
            }`}
          >
            First name + last initial
          </button>
          <button
            type="button"
            onClick={() => onDisplayPreferenceChange("anonymous")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
              displayPreference === "anonymous"
                ? "bg-[#3B82F6] text-white border-[#3B82F6]"
                : "border-[#e2e8f0] text-[#64748b] hover:bg-gray-50"
            }`}
          >
            Anonymous
          </button>
        </div>
        <p className="text-xs text-[#94a3b8]">
          Your review will appear as:{" "}
          <span className="font-medium text-[#0F1D2E]">
            {displayPreference === "name" ? formatDisplayName() : "Anonymous"}
          </span>
        </p>
      </div>
    </div>
  );
}
