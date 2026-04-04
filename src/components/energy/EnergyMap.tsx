"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { CITY_META, type City } from "@/lib/cities";
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

const GEOJSON_FILES: Record<City, string | null> = {
  nyc: "/nyc-zipcodes.geojson",
  "los-angeles": "/la-zipcodes.geojson",
  chicago: null,
  miami: null,
  houston: null,
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

interface EnergyMapProps {
  data: ZipEnergyRow[];
  city?: City;
}

export function EnergyMap({ data, city = "nyc" }: EnergyMapProps) {
  const [geojson, setGeojson] = useState<GeoJsonData | null>(null);
  const [isClient, setIsClient] = useState(false);

  const cityMeta = CITY_META[city];
  const geojsonFile = GEOJSON_FILES[city];

  useEffect(() => {
    setIsClient(true);
    if (geojsonFile) {
      fetch(geojsonFile)
        .then((r) => r.json())
        .then((d) => setGeojson(d))
        .catch(() => {});
    }
  }, [geojsonFile]);

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

  // If no geojson file exists for this city, show a simple list view
  if (!geojsonFile || !geojson) {
    const topZips = [...data].sort((a, b) => b.avg_score - a.avg_score).slice(0, 20);
    return (
      <div>
        <p className="text-sm text-[#64748b] mb-3">
          Map view is not yet available for {cityMeta.fullName}. Showing top zip codes by average score.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {topZips.map((z) => (
            <div
              key={z.zip_code}
              className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-3"
            >
              <p className="font-semibold text-[#0F1D2E]">{z.zip_code}</p>
              <p className="text-sm text-[#64748b]">
                Score: <span className="font-medium text-[#0F1D2E]">{z.avg_score}</span>
              </p>
              <p className="text-xs text-[#94a3b8]">{z.building_count} buildings</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="h-[450px] rounded-lg overflow-hidden border border-[#e2e8f0]">
        <MapContainer
          center={[cityMeta.center.lat, cityMeta.center.lng]}
          zoom={cityMeta.zoom}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          <GeoJSON
            data={geojson as unknown as GeoJSON.GeoJsonObject}
            style={(feature) => {
              const zip =
                feature?.properties?.postalCode ||
                feature?.properties?.ZIPCODE ||
                feature?.properties?.zip_code;
              const row = zip ? scoreByZip.get(String(zip)) : undefined;
              return {
                fillColor: getColor(row?.avg_score),
                weight: 1,
                opacity: 0.7,
                color: "#94a3b8",
                fillOpacity: 0.65,
              };
            }}
            onEachFeature={(feature, layer) => {
              const zip =
                feature.properties?.postalCode ||
                feature.properties?.ZIPCODE ||
                feature.properties?.zip_code;
              const name = feature.properties?.PO_NAME || feature.properties?.name || "";
              const row = zip ? scoreByZip.get(String(zip)) : undefined;
              layer.bindTooltip(
                `<strong>${zip}</strong> ${name}<br/>` +
                  (row
                    ? `Avg Score: <strong>${row.avg_score}</strong><br/>Buildings: ${row.building_count}`
                    : "No energy data"),
                { sticky: true }
              );
            }}
          />
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
