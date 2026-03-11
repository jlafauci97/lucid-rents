"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { TreePine, Dumbbell, Clapperboard, Trophy, Footprints } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface RecPlace {
  name: string;
  type: string;
  distance: string;
  walkMin: number;
}

interface RecData {
  recreation: Record<string, RecPlace[]>;
}

interface NearbyRecreationProps {
  latitude: number;
  longitude: number;
}

const REC_CONFIG: {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
}[] = [
  { key: "park", label: "Parks & Green Spaces", icon: TreePine, color: "text-[#16a34a]" },
  { key: "gym", label: "Gyms & Fitness", icon: Dumbbell, color: "text-[#7C3AED]" },
  { key: "entertainment", label: "Entertainment", icon: Clapperboard, color: "text-[#EA580C]" },
  { key: "sports", label: "Sports Venues", icon: Trophy, color: "text-[#2563EB]" },
];

export function NearbyRecreation({ latitude, longitude }: NearbyRecreationProps) {
  const [data, setData] = useState<RecData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRec() {
      try {
        const res = await fetch(
          `/api/recreation/nearby?lat=${latitude}&lng=${longitude}`
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

    fetchRec();
  }, [latitude, longitude]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-5 w-44 bg-[#e2e8f0] rounded animate-pulse" />
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

  if (!data?.recreation || Object.keys(data.recreation).length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TreePine className="w-4.5 h-4.5 text-[#16a34a]" />
          <h3 className="text-base font-bold text-[#0F1D2E]">
            Nearby Recreation
          </h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {REC_CONFIG.map(({ key, label, icon: Icon, color }) => {
            const places = data.recreation[key];
            if (!places || places.length === 0) return null;

            return (
              <div key={key}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wide">
                    {label}
                  </span>
                </div>
                <div className="space-y-2">
                  {places.map((place, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-[#0F1D2E] truncate">
                          {place.name}
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-xs font-medium text-[#0F1D2E]">
                          {place.distance}
                        </span>
                        <span className="flex items-center gap-0.5 text-[10px] text-[#94a3b8]">
                          <Footprints className="w-2.5 h-2.5" />
                          {place.walkMin} min
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
