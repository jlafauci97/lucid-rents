"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Flame, Mountain, Waves, Wind, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import "leaflet/dist/leaflet.css";

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const GeoJSON = dynamic(
  () => import("react-leaflet").then((m) => m.GeoJSON),
  { ssr: false }
);

interface LayerConfig {
  key: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  fillColor: string;
  strokeColor: string;
  activeClass: string;
}

const LAYERS: LayerConfig[] = [
  {
    key: "faultZone",
    label: "Earthquake Fault Zones",
    shortLabel: "Faults",
    icon: Zap,
    fillColor: "#ef4444",
    strokeColor: "#b91c1c",
    activeClass: "bg-red-500 text-white",
  },
  {
    key: "liquefaction",
    label: "Liquefaction Zones",
    shortLabel: "Liquefaction",
    icon: Waves,
    fillColor: "#f59e0b",
    strokeColor: "#b45309",
    activeClass: "bg-amber-500 text-white",
  },
  {
    key: "landslide",
    label: "Landslide Zones",
    shortLabel: "Landslides",
    icon: Mountain,
    fillColor: "#f97316",
    strokeColor: "#c2410c",
    activeClass: "bg-orange-500 text-white",
  },
  {
    key: "fireHazard",
    label: "Very High Fire Hazard Severity Zones",
    shortLabel: "Fire Zones",
    icon: Flame,
    fillColor: "#dc2626",
    strokeColor: "#991b1b",
    activeClass: "bg-red-600 text-white",
  },
  {
    key: "highWind",
    label: "High Wind Velocity Areas",
    shortLabel: "High Wind",
    icon: Wind,
    fillColor: "#0ea5e9",
    strokeColor: "#0369a1",
    activeClass: "bg-sky-500 text-white",
  },
];

type GeoJsonData = GeoJSON.FeatureCollection;

export function HazardMap() {
  const [mounted, setMounted] = useState(false);
  const [activeLayers, setActiveLayers] = useState<Set<string>>(
    new Set(["fireHazard", "faultZone"])
  );
  const [layerData, setLayerData] = useState<Record<string, GeoJsonData>>({});
  const [loading, setLoading] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchLayer = useCallback(
    async (key: string) => {
      if (layerData[key]) return; // already fetched
      setLoading((prev) => new Set(prev).add(key));
      try {
        const res = await fetch(`/api/hazards/zones?layer=${key}`);
        if (!res.ok) return;
        const data = await res.json();
        setLayerData((prev) => ({ ...prev, [key]: data }));
      } catch {
        // fail silently
      } finally {
        setLoading((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [layerData]
  );

  // Fetch active layers on mount and when toggled
  useEffect(() => {
    activeLayers.forEach((key) => {
      if (!layerData[key]) {
        fetchLayer(key);
      }
    });
  }, [activeLayers, fetchLayer, layerData]);

  const toggleLayer = (key: string) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (!mounted) {
    return (
      <div className="h-[400px] sm:h-[500px] lg:h-[600px] bg-[#f8fafc] rounded-xl border border-[#e2e8f0] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Layer toggles */}
      <div className="flex flex-wrap gap-2">
        {LAYERS.map((layer) => {
          const active = activeLayers.has(layer.key);
          const isLoading = loading.has(layer.key);
          const Icon = layer.icon;
          return (
            <button
              key={layer.key}
              onClick={() => toggleLayer(layer.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                active
                  ? layer.activeClass + " border-transparent shadow-sm"
                  : "bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#cbd5e1]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {layer.shortLabel}
              {isLoading && (
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              )}
            </button>
          );
        })}
      </div>

      {/* Map */}
      <div className="h-[400px] sm:h-[500px] lg:h-[600px] rounded-xl border border-[#e2e8f0] overflow-hidden relative">
        <MapContainer
          center={[34.0522, -118.2437]}
          zoom={10}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          {LAYERS.map((layer) => {
            if (!activeLayers.has(layer.key) || !layerData[layer.key]) return null;
            return (
              <GeoJSON
                key={layer.key + "-" + Object.keys(layerData).length}
                data={layerData[layer.key] as unknown as GeoJSON.GeoJsonObject}
                style={() => ({
                  fillColor: layer.fillColor,
                  fillOpacity: 0.35,
                  color: layer.strokeColor,
                  weight: 1.5,
                  opacity: 0.7,
                })}
                onEachFeature={(feature, leafletLayer) => {
                  const tooltip = feature.properties?.TOOLTIP ||
                    feature.properties?.HAZ_TYPE ||
                    feature.properties?.FLT_ZN_NAM ||
                    layer.label;
                  leafletLayer.bindTooltip(
                    `<strong>${layer.label}</strong>${tooltip !== layer.label ? `<br/>${tooltip}` : ""}`,
                    { sticky: true }
                  );
                }}
              />
            );
          })}
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-3 right-3 z-[1000] bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-[#e2e8f0] p-3">
          <div className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wide mb-2">
            Active Layers
          </div>
          <div className="space-y-1.5">
            {LAYERS.filter((l) => activeLayers.has(l.key)).map((layer) => (
              <div key={layer.key} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-sm border"
                  style={{
                    backgroundColor: layer.fillColor,
                    borderColor: layer.strokeColor,
                    opacity: 0.7,
                  }}
                />
                <span className="text-[11px] text-[#334155]">
                  {layer.shortLabel}
                </span>
              </div>
            ))}
            {activeLayers.size === 0 && (
              <span className="text-[11px] text-[#94a3b8] italic">
                Select a layer above
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-[#94a3b8]">
        Source: LA City GeoHub, California Geological Survey, CAL FIRE. Zone
        boundaries are official designations updated periodically.
      </p>
    </div>
  );
}
