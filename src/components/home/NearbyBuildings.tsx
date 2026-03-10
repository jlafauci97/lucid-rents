"use client";

import { useState } from "react";
import { MapPin, Loader2, Navigation } from "lucide-react";
import Link from "next/link";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { buildingUrl } from "@/lib/seo";
import { useCity } from "@/lib/city-context";

interface NearbyBuilding {
  id: string;
  full_address: string;
  borough: string;
  zip_code: string;
  slug: string;
  overall_score: number | null;
  violation_count: number;
  complaint_count: number;
  review_count: number;
  total_units: number | null;
  year_built: number | null;
}

export function NearbyBuildings() {
  const city = useCity();
  const [buildings, setBuildings] = useState<NearbyBuilding[]>([]);
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setLoading(true);
    setError(null);
    setRequested(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `/api/buildings/nearby?lat=${latitude}&lon=${longitude}&limit=12`
          );
          if (!res.ok) throw new Error("Failed to fetch");
          const data = await res.json();
          setBuildings(data.buildings || []);
        } catch {
          setError("Could not load nearby buildings.");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
        setError("Location access denied. Enable location to see nearby buildings.");
      },
      { timeout: 10000 }
    );
  }

  if (!requested) {
    return (
      <div className="text-center py-8">
        <button
          onClick={handleClick}
          className="inline-flex items-center gap-2 px-5 py-3 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold rounded-xl transition-colors shadow-sm"
        >
          <Navigation className="w-5 h-5" />
          Show Buildings Near Me
        </button>
        <p className="text-xs text-[#94a3b8] mt-2">
          Uses your location to find buildings in nearby zip codes
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-8 h-8 text-[#3B82F6] mx-auto animate-spin mb-3" />
        <p className="text-sm text-[#64748b]">Finding buildings near you...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-[#64748b]">{error}</p>
        <button
          onClick={handleClick}
          className="mt-3 text-sm text-[#3B82F6] hover:text-[#2563EB] font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  if (buildings.length === 0) return null;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {buildings.map((b) => (
          <Link key={b.id} href={buildingUrl(b, city)}>
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 hover:border-[#3B82F6] hover:shadow-sm transition-all">
              <div className="flex items-start gap-3">
                <LetterGrade score={b.overall_score} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#0F1D2E] truncate">
                    {b.full_address}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-[#64748b] mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {b.borough} {b.zip_code}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-[#94a3b8]">
                    {b.violation_count > 0 && (
                      <span className="text-[#EF4444] font-medium">
                        {b.violation_count} violations
                      </span>
                    )}
                    {b.review_count > 0 && (
                      <span>{b.review_count} reviews</span>
                    )}
                    {b.total_units && <span>{b.total_units} units</span>}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
