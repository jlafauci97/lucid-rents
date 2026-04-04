"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { CITY_META, type City } from "@/lib/cities";
import { CATEGORY_COLORS, type ProposalCategory } from "@/lib/proposal-categories";
import { ProposalMapSidebar } from "./ProposalMapSidebar";
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

export interface MapPoint {
  id: number;
  title: string;
  status: string;
  category: string;
  type: string;
  lat: number;
  lng: number;
  date: string;
  sponsor: string | null;
  url: string;
}

interface Props {
  city: City;
}

export function ProposalMap({ city }: Props) {
  const [mounted, setMounted] = useState(false);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("metro", city);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    if (category) params.set("category", category);
    if (status) params.set("status", status);
    if (type) params.set("type", type);

    setLoading(true);
    fetch(`/api/map/proposals?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setPoints(data.points || []))
      .catch(() => setPoints([]))
      .finally(() => setLoading(false));
  }, [city, searchParams]);

  const meta = CITY_META[city];

  if (!mounted) {
    return (
      <div className="h-[500px] lg:h-[600px] bg-[#FAFBFD] rounded-xl border border-[#E2E8F0] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 h-[500px] lg:h-[600px] rounded-xl border border-[#E2E8F0] overflow-hidden">
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
          {points.map((p) => {
            const color = CATEGORY_COLORS[p.category as ProposalCategory] || "#64748b";
            return (
              <CircleMarker
                key={p.id}
                center={[p.lat, p.lng]}
                radius={6}
                pathOptions={{
                  fillColor: color,
                  fillOpacity: 0.7,
                  color,
                  weight: 1,
                  opacity: 0.8,
                }}
              >
                <Popup>
                  <div className="text-xs min-w-[200px]">
                    <p className="font-bold text-[#1A1F36] mb-1">{p.title}</p>
                    {p.sponsor && <p className="text-[#5E6687]">Sponsor: {p.sponsor}</p>}
                    <p className="text-[#5E6687]">Status: {p.status}</p>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#3b82f6] hover:underline mt-1 inline-block"
                    >
                      View Source →
                    </a>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      <ProposalMapSidebar points={points} loading={loading} />
    </div>
  );
}
