"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { CircleMarker, Popup } from "react-leaflet";
import { getLetterGrade, getGradeColor } from "@/lib/constants";
import { buildingUrl } from "@/lib/seo";
import { useCity } from "@/lib/city-context";

interface BuildingPoint {
  id: string;
  address: string;
  borough: string;
  zip: string;
  slug: string;
  score: number;
  violations: number;
  reviews: number;
  lat: number;
  lon: number;
}

interface BuildingMapProps {
  borough: string;
  minScore: number;
  maxScore: number;
  visible: boolean;
}

export function BuildingMap({ borough, minScore, maxScore, visible }: BuildingMapProps) {
  const city = useCity();
  const [points, setPoints] = useState<BuildingPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (borough) params.set("borough", borough);
    params.set("minScore", String(minScore));
    params.set("maxScore", String(maxScore));

    fetch(`/api/map/buildings?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setPoints(data.points || []);
      })
      .catch(() => setPoints([]))
      .finally(() => setLoading(false));
  }, [borough, minScore, maxScore, visible]);

  const markers = useMemo(() => {
    return points.map((p) => {
      const grade = getLetterGrade(p.score);
      const color = getGradeColor(grade);
      return (
        <CircleMarker
          key={p.id}
          center={[p.lat, p.lon]}
          radius={5}
          pathOptions={{
            fillColor: color,
            fillOpacity: 0.7,
            color: color,
            weight: 1,
            opacity: 0.9,
          }}
        >
          <Popup>
            <div className="text-sm min-w-[180px]">
              <p className="font-bold text-[#0F1D2E] mb-1">{p.address}</p>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {grade}
                </span>
                <span className="text-[#64748b] text-xs">{p.score.toFixed(1)}/10</span>
              </div>
              <p className="text-xs text-[#64748b]">
                {p.violations} violations · {p.reviews} reviews
              </p>
              <Link
                href={buildingUrl({ borough: p.borough, slug: p.slug }, city)}
                className="text-xs text-[#3B82F6] font-medium mt-1 inline-block"
              >
                View details →
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
