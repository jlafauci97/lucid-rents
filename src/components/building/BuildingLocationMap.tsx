"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import { T } from "@/lib/design-tokens";
import "leaflet/dist/leaflet.css";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

interface BuildingLocationMapProps {
  latitude: number;
  longitude: number;
  address: string;
}

export function BuildingLocationMap({
  latitude,
  longitude,
  address,
}: BuildingLocationMapProps) {
  const [mounted, setMounted] = useState(false);
  const [icon, setIcon] = useState<L.Icon | null>(null);

  useEffect(() => {
    setMounted(true);
    // Create custom icon client-side only
    import("leaflet").then((L) => {
      setIcon(
        new L.Icon({
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        })
      );
    });
  }, []);

  if (!mounted || !icon) {
    return (
      <div className="h-[300px] rounded-2xl border shadow-sm flex items-center justify-center" style={{ backgroundColor: T.elevated, borderColor: T.border }}>
        <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: T.accent, borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5" style={{ color: T.blue }} />
        <h2 className="text-xl font-bold" style={{ color: T.text1 }}>Building Location</h2>
      </div>
      <div className="h-[300px] rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: T.border }}>
        <MapContainer
          center={[latitude, longitude]}
          zoom={16}
          style={{ height: "100%", width: "100%" }}
          zoomControl={true}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[latitude, longitude]} icon={icon}>
            <Popup>
              <div className="text-sm font-medium">{address}</div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </section>
  );
}
