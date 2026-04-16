"use client";

/**
 * BigMap — fills the .big-map container in S06 Location with a real
 * Leaflet map. Intentionally no heading or chrome — the v2 mockup styles
 * the wrapping .big-map itself.
 */

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import type { Icon as LeafletIcon } from "leaflet";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });

interface Props {
  latitude: number;
  longitude: number;
  address: string;
  labelLine: string;
}

export function BigMap({ latitude, longitude, address, labelLine }: Props) {
  const [icon, setIcon] = useState<LeafletIcon | null>(null);

  useEffect(() => {
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

  return (
    <div className="big-map" role="img" aria-label={`Map of ${address}`} style={{ position: "relative", padding: 0, overflow: "hidden" }}>
      {icon ? (
        <MapContainer
          center={[latitude, longitude]}
          zoom={16}
          style={{ height: "100%", width: "100%", minHeight: 360, borderRadius: "inherit" }}
          zoomControl={true}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[latitude, longitude]} icon={icon}>
            <Popup>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{address}</div>
            </Popup>
          </Marker>
        </MapContainer>
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <span className="pin"></span>
        </div>
      )}
      <div className="mlabel" style={{ position: "absolute", left: 12, bottom: 12, right: 12, zIndex: 1000, background: "rgba(255,255,255,0.92)", padding: "6px 10px", borderRadius: 8, fontSize: 11 }}>
        {labelLine}
      </div>
    </div>
  );
}
