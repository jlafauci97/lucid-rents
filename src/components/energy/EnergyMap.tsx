"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
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

interface ZipEnergyRow {
  zip_code: string;
  avg_score: number;
  building_count: number;
}

type GeoJsonFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: Record<string, unknown>;
};

type GeoJsonData = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};

// Green (high score) to Red (low score) color scale
function getColor(score: number | undefined): string {
  if (score == null) return "#e2e8f0";
  if (score >= 80) return "#059669"; // emerald-600
  if (score >= 70) return "#10b981"; // emerald-500
  if (score >= 60) return "#6ee7b7"; // emerald-300
  if (score >= 50) return "#fbbf24"; // amber-400
  if (score >= 40) return "#f59e0b"; // amber-500
  if (score >= 30) return "#f97316"; // orange-500
  return "#ef4444"; // red-500
}

export function EnergyMap({ data }: { data: ZipEnergyRow[] }) {
  const [geojson, setGeojson] = useState<GeoJsonData | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    fetch("/nyc-zipcodes.geojson")
      .then((r) => r.json())
      .then((d) => setGeojson(d))
      .catch(() => {});
  }, []);

  if (!isClient) {
    return (
      <div className="h-[450px] bg-[#f1f5f9] rounded-lg flex items-center justify-center text-[#94a3b8]">
        Loading map...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-[#94a3b8]">
        No energy data available for the map yet.
      </div>
    );
  }

  const scoreByZip = new Map(data.map((d) => [d.zip_code, d]));

  return (
    <div>
      <div className="h-[450px] rounded-lg overflow-hidden border border-[#e2e8f0]">
        <MapContainer
          center={[40.7128, -73.97]}
          zoom={11}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          {geojson && (
            <GeoJSON
              data={geojson as unknown as GeoJSON.GeoJsonObject}
              style={(feature) => {
                const zip = feature?.properties?.postalCode;
                const row = zip ? scoreByZip.get(zip) : undefined;
                return {
                  fillColor: getColor(row?.avg_score),
                  weight: 1,
                  opacity: 0.7,
                  color: "#94a3b8",
                  fillOpacity: 0.65,
                };
              }}
              onEachFeature={(feature, layer) => {
                const zip = feature.properties?.postalCode;
                const name = feature.properties?.PO_NAME || "";
                const row = zip ? scoreByZip.get(zip) : undefined;
                layer.bindTooltip(
                  `<strong>${zip}</strong> ${name}<br/>` +
                    (row
                      ? `Avg Score: <strong>${row.avg_score}</strong><br/>Buildings: ${row.building_count}`
                      : "No energy data"),
                  { sticky: true }
                );
              }}
            />
          )}
        </MapContainer>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-[#64748b]">
        <span className="font-medium">Avg ENERGY STAR Score:</span>
        {[
          { color: "#ef4444", label: "<30" },
          { color: "#f97316", label: "30-39" },
          { color: "#f59e0b", label: "40-49" },
          { color: "#fbbf24", label: "50-59" },
          { color: "#6ee7b7", label: "60-69" },
          { color: "#10b981", label: "70-79" },
          { color: "#059669", label: "80+" },
        ].map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-sm inline-block"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
