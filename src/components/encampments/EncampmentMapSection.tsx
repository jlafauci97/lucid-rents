"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { Tent, Clock, MapPin } from "lucide-react";
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
const CircleMarker = dynamic(
  () => import("react-leaflet").then((mod) => mod.CircleMarker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

interface EncampmentPoint {
  id: string;
  date: string;
  status: string;
  address: string;
  zip: string;
  lat: number;
  lng: number;
  district: string;
  nc: string;
}

interface MapData {
  points: EncampmentPoint[];
  total: number;
  recent: number;
  byDistrict: Record<string, number>;
  byStatus: Record<string, number>;
}

function getStatusColor(status: string): string {
  const s = status?.toLowerCase() || "";
  if (s === "closed") return "#10b981";
  if (s === "pending") return "#f59e0b";
  return "#ef4444"; // open or unknown
}

function isRecent(date: string): boolean {
  const ninety = Date.now() - 90 * 24 * 60 * 60 * 1000;
  return new Date(date).getTime() >= ninety;
}

export function EncampmentMapSection({ city }: { city: string }) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "recent" | "open">("all");

  useEffect(() => {
    setMounted(true);
    fetch("/api/map/encampments")
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const filteredPoints = useMemo(() => {
    if (!data) return [];
    if (filter === "recent") return data.points.filter((p) => isRecent(p.date));
    if (filter === "open") return data.points.filter((p) => p.status?.toLowerCase() !== "closed");
    return data.points;
  }, [data, filter]);

  if (!mounted) {
    return (
      <div className="h-[400px] sm:h-[500px] lg:h-[550px] bg-[#f8fafc] rounded-xl border border-[#e2e8f0] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const meta = CITY_META[city as City];

  const markers = filteredPoints.map((p) => {
    const color = getStatusColor(p.status);
    const recent = isRecent(p.date);
    return (
      <CircleMarker
        key={p.id}
        center={[p.lat, p.lng]}
        radius={recent ? 6 : 4}
        pathOptions={{
          fillColor: color,
          fillOpacity: recent ? 0.7 : 0.4,
          color: color,
          weight: 1,
          opacity: 0.8,
        }}
      >
        <Popup>
          <div className="text-sm min-w-[180px]">
            <p className="font-bold text-[#0F1D2E] mb-1 text-xs">{p.address || "No address"}</p>
            <div className="space-y-0.5 text-xs text-[#64748b]">
              <p>
                Status:{" "}
                <span
                  className="font-semibold"
                  style={{ color }}
                >
                  {p.status || "Unknown"}
                </span>
              </p>
              <p>
                Date:{" "}
                <span className="font-semibold text-[#0F1D2E]">
                  {new Date(p.date).toLocaleDateString()}
                </span>
              </p>
              {p.district && <p>Council District: {p.district}</p>}
              {p.nc && <p>Neighborhood Council: {p.nc}</p>}
              {p.zip && <p>Zip: {p.zip}</p>}
            </div>
          </div>
        </Popup>
      </CircleMarker>
    );
  });

  return (
    <div>
      {/* Filter controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(
          [
            { key: "all", label: "All Reports", icon: MapPin },
            { key: "recent", label: "Last 90 Days", icon: Clock },
            { key: "open", label: "Open Only", icon: Tent },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-[#0F1D2E] text-white"
                : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
            }`}
          >
            <f.icon className="w-3.5 h-3.5" />
            {f.label}
          </button>
        ))}
        <span className="text-sm text-[#64748b] ml-2">
          {loading ? "Loading..." : `${filteredPoints.length.toLocaleString()} reports shown`}
        </span>
      </div>

      {/* Map */}
      <div className="h-[400px] sm:h-[500px] lg:h-[550px] rounded-xl border border-[#e2e8f0] overflow-hidden relative">
        {/* Legend */}
        <div className="absolute bottom-3 right-3 z-[1000] bg-white rounded-lg shadow-lg border border-[#e2e8f0] p-3">
          <p className="text-xs font-semibold text-[#0F1D2E] mb-1.5">Report Status</p>
          <div className="space-y-1">
            {[
              { label: "Open", color: "#ef4444" },
              { label: "Pending", color: "#f59e0b" },
              { label: "Closed", color: "#10b981" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-[10px] text-[#64748b]">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <MapContainer
          center={[meta.center.lat, meta.center.lng]}
          zoom={meta.zoom}
          style={{ height: "100%", width: "100%" }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {markers}
        </MapContainer>
      </div>
    </div>
  );
}
