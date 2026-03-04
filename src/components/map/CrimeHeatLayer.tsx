"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { CircleMarker, Popup } from "react-leaflet";

interface CrimePoint {
  zip: string;
  borough: string;
  total: number;
  violent: number;
  property: number;
  qol: number;
  lat: number;
  lon: number;
}

interface CrimeHeatLayerProps {
  borough: string;
  visible: boolean;
}

function getCrimeColor(violent: number, total: number): string {
  const violentRatio = total > 0 ? violent / total : 0;
  if (violentRatio > 0.3) return "#DC2626"; // high violent ratio
  if (violentRatio > 0.15) return "#F59E0B"; // moderate
  return "#3B82F6"; // mostly property/QoL
}

function getCrimeRadius(total: number): number {
  if (total > 2000) return 22;
  if (total > 1000) return 18;
  if (total > 500) return 14;
  if (total > 200) return 10;
  return 7;
}

export function CrimeHeatLayer({ borough, visible }: CrimeHeatLayerProps) {
  const [points, setPoints] = useState<CrimePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (borough) params.set("borough", borough);

    fetch(`/api/map/crime?${params}`)
      .then((res) => res.json())
      .then((data) => setPoints(data.points || []))
      .catch(() => setPoints([]))
      .finally(() => setLoading(false));
  }, [borough, visible]);

  const markers = useMemo(() => {
    return points.map((p) => {
      const color = getCrimeColor(p.violent, p.total);
      const radius = getCrimeRadius(p.total);
      return (
        <CircleMarker
          key={p.zip}
          center={[p.lat, p.lon]}
          radius={radius}
          pathOptions={{
            fillColor: color,
            fillOpacity: 0.35,
            color: color,
            weight: 1.5,
            opacity: 0.6,
          }}
        >
          <Popup>
            <div className="text-sm min-w-[160px]">
              <p className="font-bold text-[#0F1D2E] mb-1">
                {p.zip} · {p.borough}
              </p>
              <div className="space-y-0.5 text-xs text-[#64748b]">
                <p>Total: <span className="font-semibold text-[#0F1D2E]">{p.total.toLocaleString()}</span></p>
                <p>Violent: <span className="font-semibold text-[#EF4444]">{p.violent.toLocaleString()}</span></p>
                <p>Property: <span className="font-semibold text-[#F59E0B]">{p.property.toLocaleString()}</span></p>
                <p>QoL: <span className="font-semibold text-[#3B82F6]">{p.qol.toLocaleString()}</span></p>
              </div>
              <Link
                href={`/crime/${p.zip}`}
                className="text-xs text-[#3B82F6] font-medium mt-1 inline-block"
              >
                View crime data →
              </Link>
            </div>
          </Popup>
        </CircleMarker>
      );
    });
  }, [points]);

  if (!visible) return null;

  if (loading) return null;

  return <>{markers}</>;
}
