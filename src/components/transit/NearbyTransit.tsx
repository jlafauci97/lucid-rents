"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { T } from "@/lib/design-tokens";
import { TrainFront, Bus, Bike, Ship, Footprints } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface TransitStop {
  name: string;
  routes: string[];
  distance: string;
  walkMin: number;
  ada: boolean | null;
}

interface TransitData {
  transit: Record<string, TransitStop[]>;
}

interface NearbyTransitProps {
  latitude: number;
  longitude: number;
  city?: string;
}

interface TransitConfigItem {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  badgeColor: string;
}

const NYC_TRANSIT_CONFIG: TransitConfigItem[] = [
  {
    key: "subway",
    label: "Subway",
    icon: TrainFront,
    color: "text-[#2563EB]",
    badgeColor: "bg-[#2563EB] text-white",
  },
  {
    key: "rail",
    label: "Metro Rail",
    icon: TrainFront,
    color: "text-[#7C3AED]",
    badgeColor: "bg-[#7C3AED] text-white",
  },
  {
    key: "bus",
    label: "Bus",
    icon: Bus,
    color: "text-[#0891B2]",
    badgeColor: "bg-[#0891B2] text-white",
  },
  {
    key: "citibike",
    label: "Citi Bike",
    icon: Bike,
    color: "text-[#0369A1]",
    badgeColor: "bg-[#0369A1] text-white",
  },
  {
    key: "ferry",
    label: "Ferry",
    icon: Ship,
    color: "text-[#7C3AED]",
    badgeColor: "bg-[#7C3AED] text-white",
  },
];

const LA_TRANSIT_CONFIG: TransitConfigItem[] = [
  {
    key: "rail",
    label: "Metro Rail",
    icon: TrainFront,
    color: "text-[#2563EB]",
    badgeColor: "bg-[#2563EB] text-white",
  },
  {
    key: "bus",
    label: "Bus",
    icon: Bus,
    color: "text-[#0891B2]",
    badgeColor: "bg-[#0891B2] text-white",
  },
];

function getTransitConfig(city?: string): TransitConfigItem[] {
  if (city === "los-angeles" || city === "CA/Los-Angeles") return LA_TRANSIT_CONFIG;
  return NYC_TRANSIT_CONFIG;
}

export function NearbyTransit({ latitude, longitude, city }: NearbyTransitProps) {
  const [data, setData] = useState<TransitData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTransit() {
      try {
        const res = await fetch(
          `/api/transit/nearby?lat=${latitude}&lng=${longitude}${city ? `&city=${city}` : ""}`
        );
        if (!res.ok) return;
        const json = await res.json();
        setData(json);
      } catch {
        // Silently fail — supplementary card
      } finally {
        setLoading(false);
      }
    }

    fetchTransit();
  }, [latitude, longitude]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-5 w-36 bg-[#e2e8f0] rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-4 w-24 bg-[#e2e8f0] rounded animate-pulse" />
                <div className="h-3.5 w-full bg-[#e2e8f0] rounded animate-pulse" />
                <div className="h-3.5 w-3/4 bg-[#e2e8f0] rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.transit || Object.keys(data.transit).length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrainFront className="w-4.5 h-4.5 text-[#2563EB]" />
          <h3 className="text-base font-bold" style={{ color: T.text1 }}>
            Nearby Transit
          </h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {getTransitConfig(city).map(({ key, label, icon: Icon, color, badgeColor }) => {
            const stops = data.transit[key];
            if (!stops || stops.length === 0) return null;

            return (
              <div key={key}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: T.text2 }}>
                    {label}
                  </span>
                </div>
                <div className="space-y-2">
                  {stops.map((stop, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate" style={{ color: T.text1 }}>
                          {stop.name}
                        </div>
                        {stop.routes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {stop.routes.slice(0, 8).map((route) => (
                              <span
                                key={route}
                                className={`inline-flex items-center justify-center px-1.5 py-0 text-[10px] font-bold rounded ${badgeColor}`}
                                style={{ minWidth: "20px", lineHeight: "16px" }}
                              >
                                {route}
                              </span>
                            ))}
                            {stop.routes.length > 8 && (
                              <span className="text-[10px]" style={{ color: T.text2 }}>
                                +{stop.routes.length - 8}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-xs font-medium" style={{ color: T.text1 }}>
                          {stop.distance}
                        </span>
                        <span className="flex items-center gap-0.5 text-[10px]" style={{ color: T.text3 }}>
                          <Footprints className="w-2.5 h-2.5" />
                          {stop.walkMin} min
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
