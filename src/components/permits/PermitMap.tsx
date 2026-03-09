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

interface ZipPermitRow {
  zip_code: string;
  borough: string;
  permit_count: number;
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
  if (count >= 500) return "#134E4A";
  if (count >= 200) return "#115E59";
  if (count >= 100) return "#0F766E";
  if (count >= 50) return "#0D9488";
  if (count >= 20) return "#14B8A6";
  if (count >= 10) return "#5EEAD4";
  return "#CCFBF1";
}

export function PermitMap({ data }: { data: ZipPermitRow[] }) {
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
        No permit data available for the map yet.
      </div>
    );
  }

  const permitsByZip = new Map(data.map((d) => [d.zip_code, d.permit_count]));

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
                const count = zip ? permitsByZip.get(zip) : undefined;
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
                const count = zip ? permitsByZip.get(zip) : undefined;
                layer.bindTooltip(
                  `<strong>${zip}</strong> ${name}<br/>` +
                    (count
                      ? `Active Permits: <strong>${count.toLocaleString()}</strong>`
                      : "No active permits"),
                  { sticky: true }
                );
              }}
            />
          )}
        </MapContainer>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-[#64748b]">
        <span className="font-medium">Active Permits:</span>
        {[
          { color: "#CCFBF1", label: "1–9" },
          { color: "#5EEAD4", label: "10–19" },
          { color: "#14B8A6", label: "20–49" },
          { color: "#0D9488", label: "50–99" },
          { color: "#0F766E", label: "100–199" },
          { color: "#115E59", label: "200–499" },
          { color: "#134E4A", label: "500+" },
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
