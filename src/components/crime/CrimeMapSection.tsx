"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Building2, Siren, Filter } from "lucide-react";
import { CITY_META, type City } from "@/lib/cities";
import "leaflet/dist/leaflet.css";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const BuildingMap = dynamic(
  () => import("@/components/map/BuildingMap").then((mod) => mod.BuildingMap),
  { ssr: false }
);
const CrimeHeatLayer = dynamic(
  () => import("@/components/map/CrimeHeatLayer").then((mod) => mod.CrimeHeatLayer),
  { ssr: false }
);

type LayerToggle = "buildings" | "crime" | "both";

interface CrimeMapSectionProps {
  borough: string;
  city: string;
}

export function CrimeMapSection({ borough, city }: CrimeMapSectionProps) {
  const [mounted, setMounted] = useState(false);
  const [layer, setLayer] = useState<LayerToggle>("crime");
  const [showFilters, setShowFilters] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(10);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-[300px] sm:h-[400px] lg:h-[450px] bg-[#FAFBFD] rounded-xl border border-[#E2E8F0] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#6366F1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[300px] sm:h-[400px] lg:h-[450px] rounded-xl border border-[#E2E8F0] overflow-hidden relative">
      {/* Controls overlay */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-2">
        {/* Layer toggle */}
        <div className="bg-white rounded-lg shadow-lg border border-[#E2E8F0] p-1 flex gap-1">
          <button
            onClick={() => setLayer("buildings")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              layer === "buildings" || layer === "both"
                ? "bg-[#6366F1] text-white"
                : "text-[#5E6687] hover:bg-[#F5F7FA]"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Buildings
          </button>
          <button
            onClick={() => setLayer("crime")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              layer === "crime" || layer === "both"
                ? "bg-[#DC2626] text-white"
                : "text-[#5E6687] hover:bg-[#F5F7FA]"
            }`}
          >
            <Siren className="w-3.5 h-3.5" />
            Crime
          </button>
          <button
            onClick={() => setLayer("both")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              layer === "both"
                ? "bg-[#0F1D2E] text-white"
                : "text-[#5E6687] hover:bg-[#F5F7FA]"
            }`}
          >
            Both
          </button>
        </div>

        {/* Score filter */}
        {(layer === "buildings" || layer === "both") && (
          <div className="bg-white rounded-lg shadow-lg border border-[#E2E8F0]">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#5E6687] hover:text-[#1A1F36] w-full"
            >
              <Filter className="w-3.5 h-3.5" />
              Score Filter
              {(minScore > 0 || maxScore < 10) && (
                <span className="ml-auto text-[#6366F1]">
                  {minScore}-{maxScore}
                </span>
              )}
            </button>
            {showFilters && (
              <div className="px-3 pb-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-[#5E6687]">
                  <span>Min:</span>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    value={minScore}
                    onChange={(e) => setMinScore(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-4 text-right">{minScore}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#5E6687]">
                  <span>Max:</span>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    value={maxScore}
                    onChange={(e) => setMaxScore(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-4 text-right">{maxScore}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 z-[1000] bg-white rounded-lg shadow-lg border border-[#E2E8F0] p-3">
        {(layer === "buildings" || layer === "both") && (
          <div className="mb-2">
            <p className="text-xs font-semibold text-[#1A1F36] mb-1.5">Building Grade</p>
            <div className="flex items-center gap-2">
              {[
                { grade: "A", color: "#10b981" },
                { grade: "B", color: "#22c55e" },
                { grade: "C", color: "#f97316" },
                { grade: "D", color: "#ef4444" },
                { grade: "F", color: "#dc2626" },
              ].map((g) => (
                <div key={g.grade} className="flex items-center gap-1">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: g.color }}
                  />
                  <span className="text-[10px] text-[#5E6687]">{g.grade}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {(layer === "crime" || layer === "both") && (
          <div>
            <p className="text-xs font-semibold text-[#1A1F36] mb-1.5">Crime Intensity</p>
            <div className="flex items-center gap-2">
              {[
                { label: "High violent", color: "#DC2626" },
                { label: "Mixed", color: "#F59E0B" },
                { label: "Low violent", color: "#3B82F6" },
              ].map((c) => (
                <div key={c.label} className="flex items-center gap-1">
                  <span
                    className="w-3 h-3 rounded-full opacity-60"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="text-[10px] text-[#5E6687]">{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Map */}
      <MapContainer
        center={[CITY_META[city as City].center.lat, CITY_META[city as City].center.lng]}
        zoom={CITY_META[city as City].zoom}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <BuildingMap
          borough={borough}
          minScore={minScore}
          maxScore={maxScore}
          visible={layer === "buildings" || layer === "both"}
        />
        <CrimeHeatLayer
          borough={borough}
          visible={layer === "crime" || layer === "both"}
        />
      </MapContainer>
    </div>
  );
}
