"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import {
  ShieldAlert,
  ShieldCheck,
  Flame,
  Mountain,
  Waves,
  Wind,
  Zap,
  ExternalLink,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface HazardInfo {
  label: string;
  inZone: boolean;
  detail?: string;
}

interface HazardData {
  hazards: Record<string, HazardInfo>;
  activeCount: number;
  totalChecked: number;
}

interface HazardZonesCardProps {
  latitude: number;
  longitude: number;
  /** Pass building's soft-story status so we can show it inline */
  isSoftStory?: boolean;
  softStoryStatus?: string | null;
  city: string;
}

const HAZARD_ICONS: Record<string, LucideIcon> = {
  faultZone: Zap,
  liquefaction: Waves,
  landslide: Mountain,
  fireHazard: Flame,
  highWind: Wind,
};

const HAZARD_COLORS: Record<string, { active: string; icon: string }> = {
  faultZone: { active: "bg-red-50 text-red-700 border-red-200", icon: "text-red-500" },
  liquefaction: { active: "bg-amber-50 text-amber-700 border-amber-200", icon: "text-amber-500" },
  landslide: { active: "bg-orange-50 text-orange-700 border-orange-200", icon: "text-orange-500" },
  fireHazard: { active: "bg-red-50 text-red-700 border-red-200", icon: "text-red-500" },
  highWind: { active: "bg-sky-50 text-sky-700 border-sky-200", icon: "text-sky-500" },
};

export function HazardZonesCard({
  latitude,
  longitude,
  isSoftStory,
  softStoryStatus,
  city,
}: HazardZonesCardProps) {
  const [data, setData] = useState<HazardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHazards() {
      try {
        const res = await fetch(
          `/api/hazards/nearby?lat=${latitude}&lng=${longitude}`
        );
        if (!res.ok) return;
        const json = await res.json();
        setData(json);
      } catch {
        // Supplementary card — fail silently
      } finally {
        setLoading(false);
      }
    }
    fetchHazards();
  }, [latitude, longitude]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-5 w-48 bg-[#e2e8f0] rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 w-full bg-[#e2e8f0] rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Always show for LA buildings so tenants see "all clear" status too
  if (!data) return null;

  const hasActiveHazards = data.activeCount > 0;
  const overallSafe = !hasActiveHazards && (!isSoftStory || softStoryStatus === "Retrofitted");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {overallSafe ? (
            <ShieldCheck className="w-[18px] h-[18px] text-emerald-600" />
          ) : (
            <ShieldAlert className="w-[18px] h-[18px] text-amber-600" />
          )}
          <h3 className="font-semibold text-[#0F1D2E]">Seismic & Fire Zones</h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Overall risk summary */}
          {data && (
            <div
              className={`rounded-lg px-3 py-2.5 ${
                data.activeCount === 0
                  ? "bg-emerald-50"
                  : data.activeCount <= 2
                  ? "bg-amber-50"
                  : "bg-red-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-bold ${
                    data.activeCount === 0
                      ? "text-emerald-700"
                      : data.activeCount <= 2
                      ? "text-amber-700"
                      : "text-red-700"
                  }`}
                >
                  {data.activeCount === 0
                    ? "No Hazard Zones Detected"
                    : `${data.activeCount} Hazard Zone${data.activeCount > 1 ? "s" : ""} Detected`}
                </span>
              </div>
              <p className="text-xs mt-1 opacity-80">
                {data.activeCount === 0
                  ? "This location is not in any mapped hazard zones."
                  : "This building is in one or more officially mapped hazard areas."}
              </p>
            </div>
          )}

          {/* Individual hazards */}
          {data && (
            <div className="space-y-2">
              {Object.entries(data.hazards).map(([key, info]) => {
                const Icon = HAZARD_ICONS[key] ?? ShieldAlert;
                const colors = HAZARD_COLORS[key] ?? HAZARD_COLORS.faultZone;

                return (
                  <div
                    key={key}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 border ${
                      info.inZone
                        ? colors.active
                        : "bg-white text-[#94a3b8] border-[#e2e8f0]"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        info.inZone ? colors.icon : "text-[#cbd5e1]"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium">{info.label}</span>
                      {info.detail && info.inZone && (
                        <span className="block text-[10px] opacity-70 truncate">
                          {info.detail}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 ${
                        info.inZone ? "" : "text-emerald-600"
                      }`}
                    >
                      {info.inZone ? "In Zone" : "Clear"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Soft-story status (inline if present) */}
          {isSoftStory && (
            <div
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 border ${
                softStoryStatus === "Retrofitted"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              {softStoryStatus === "Retrofitted" ? (
                <ShieldCheck className="w-4 h-4 flex-shrink-0 text-emerald-500" />
              ) : (
                <ShieldAlert className="w-4 h-4 flex-shrink-0 text-amber-500" />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium">Soft-Story Retrofit</span>
                <span className="block text-[10px] opacity-70">
                  {softStoryStatus || "Pre-1978 soft-story building"}
                </span>
              </div>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 ${
                  softStoryStatus === "Retrofitted" ? "text-emerald-600" : ""
                }`}
              >
                {softStoryStatus === "Retrofitted" ? "Done" : "Pending"}
              </span>
            </div>
          )}

          {/* Link to full safety page */}
          <Link
            href={`/${city}/seismic-fire-safety`}
            className="flex items-center gap-1 text-xs font-medium text-[#3B82F6] hover:text-[#2563EB] transition-colors"
          >
            Learn about LA seismic & fire zones
            <ExternalLink className="w-3 h-3" />
          </Link>

          {/* Source */}
          <p className="text-[10px] text-[#94a3b8] leading-tight">
            Data from LA City GeoHub, LADBS Soft-Story Retrofit Program, and CAL
            FIRE. Hazard zones are official designations — actual risk may vary.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
