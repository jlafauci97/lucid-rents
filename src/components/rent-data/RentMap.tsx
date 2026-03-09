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

interface ZipRentRow {
  zip_code: string;
  borough: string;
  median_rent: number;
  month: string;
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

function getColor(rent: number | undefined): string {
  if (rent == null) return "#e2e8f0";
  if (rent >= 4000) return "#991B1B";
  if (rent >= 3500) return "#DC2626";
  if (rent >= 3000) return "#F97316";
  if (rent >= 2500) return "#F59E0B";
  if (rent >= 2000) return "#FBBF24";
  if (rent >= 1500) return "#86EFAC";
  return "#22C55E";
}

export function RentMap({ data }: { data: ZipRentRow[] }) {
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
        No rent data available for the map yet.
      </div>
    );
  }

  const rentByZip = new Map(data.map((d) => [d.zip_code, d.median_rent]));

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
                const rent = zip ? rentByZip.get(zip) : undefined;
                return {
                  fillColor: getColor(rent),
                  weight: 1,
                  opacity: 0.7,
                  color: "#94a3b8",
                  fillOpacity: 0.65,
                };
              }}
              onEachFeature={(feature, layer) => {
                const zip = feature.properties?.postalCode;
                const name = feature.properties?.PO_NAME || "";
                const rent = zip ? rentByZip.get(zip) : undefined;
                layer.bindTooltip(
                  `<strong>${zip}</strong> ${name}<br/>` +
                    (rent
                      ? `Median Rent: <strong>$${Math.round(rent).toLocaleString()}</strong>`
                      : "No data"),
                  { sticky: true }
                );
              }}
            />
          )}
        </MapContainer>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-[#64748b]">
        <span className="font-medium">Median Rent:</span>
        {[
          { color: "#22C55E", label: "< $1,500" },
          { color: "#86EFAC", label: "$1,500–2k" },
          { color: "#FBBF24", label: "$2k–2.5k" },
          { color: "#F59E0B", label: "$2.5k–3k" },
          { color: "#F97316", label: "$3k–3.5k" },
          { color: "#DC2626", label: "$3.5k–4k" },
          { color: "#991B1B", label: "$4k+" },
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
