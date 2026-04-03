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

interface ZipShedRow {
  zip_code: string;
  borough: string;
  shed_count: number;
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

function getColor(count: number | undefined): string {
  if (count == null || count === 0) return "#e2e8f0";
  if (count >= 100) return "#7F1D1D";
  if (count >= 50) return "#991B1B";
  if (count >= 30) return "#DC2626";
  if (count >= 20) return "#F97316";
  if (count >= 10) return "#F59E0B";
  if (count >= 5) return "#FBBF24";
  return "#FEF3C7";
}

export function ScaffoldingMap({ data }: { data: ZipShedRow[] }) {
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
        No scaffolding data available for the map yet.
      </div>
    );
  }

  const shedsByZip = new Map(data.map((d) => [d.zip_code, d.shed_count]));

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
                const count = zip ? shedsByZip.get(zip) : undefined;
                return {
                  fillColor: getColor(count),
                  weight: 1,
                  opacity: 0.7,
                  color: "#94a3b8",
                  fillOpacity: 0.65,
                };
              }}
              onEachFeature={(feature, layer) => {
                const zip = feature.properties?.postalCode;
                const name = feature.properties?.PO_NAME || "";
                const count = zip ? shedsByZip.get(zip) : undefined;
                layer.bindTooltip(
                  `<strong>${zip}</strong> ${name}<br/>` +
                    (count
                      ? `Active Sheds: <strong>${count}</strong>`
                      : "No active sheds"),
                  { sticky: true }
                );
              }}
            />
          )}
        </MapContainer>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-[#64748b]">
        <span className="font-medium">Active Sheds:</span>
        {[
          { color: "#FEF3C7", label: "1–4" },
          { color: "#FBBF24", label: "5–9" },
          { color: "#F59E0B", label: "10–19" },
          { color: "#F97316", label: "20–29" },
          { color: "#DC2626", label: "30–49" },
          { color: "#991B1B", label: "50–99" },
          { color: "#7F1D1D", label: "100+" },
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
