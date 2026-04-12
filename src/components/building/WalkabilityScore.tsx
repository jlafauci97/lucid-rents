"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { T } from "@/lib/design-tokens";
import { Footprints, TrainFront, Bike } from "lucide-react";

function getScoreColor(score: number): string {
  if (score >= 80) return T.gradeA;
  if (score >= 60) return T.gradeB;
  if (score >= 40) return T.gradeC;
  if (score >= 20) return T.gradeD;
  return T.gradeF;
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "Walker's Paradise";
  if (score >= 70) return "Very Walkable";
  if (score >= 50) return "Somewhat Walkable";
  if (score >= 25) return "Car-Dependent";
  return "Almost All Driving";
}

// Transit type → display label used in the "Nearest Transit" row so
// Houston/Miami/LA users can tell whether "4 min walk" means bus or rail.
const TYPE_LABEL: Record<string, string> = {
  subway: "Subway",
  rail: "Rail",
  bus: "Bus",
  citibike: "CitiBike",
  ferry: "Ferry",
};

export function WalkabilityScore({ latitude, longitude, city }: { latitude: number; longitude: number; city?: string }) {
  const [data, setData] = useState<{ transitScore: number; transitLabel: string; nearestTransitWalk: number | null; nearestTransitType: string | null; totalStops: number; hasSubway: boolean; hasRail: boolean; hasBus: boolean; hasBike: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/transit/nearby?lat=${latitude}&lng=${longitude}${city ? `&city=${city}` : ""}`);
        if (!res.ok) return;
        const json = await res.json();
        const transit = json.transit as Record<string, Array<{ walkMin: number }>>;
        if (!transit || Object.keys(transit).length === 0) return;

        const allStops = Object.values(transit).flat();
        const totalStops = allStops.length;
        const nearestWalk = allStops.length > 0 ? Math.min(...allStops.map((s) => s.walkMin)) : null;

        // Find which transit type contains the nearest stop, so we can label
        // the "Nearest Transit" row with context (Bus 4 min vs Rail 4 min).
        let nearestType: string | null = null;
        if (nearestWalk !== null) {
          for (const [type, stops] of Object.entries(transit)) {
            if (stops?.some((s) => s.walkMin === nearestWalk)) {
              nearestType = type;
              break;
            }
          }
        }

        let score = 0;
        if (nearestWalk !== null) score = Math.max(0, Math.min(100, 100 - (nearestWalk - 1) * 4));
        const types = Object.keys(transit).filter((k) => (transit[k]?.length || 0) > 0);
        score = Math.min(100, score + types.length * 5);
        score = Math.min(100, score + Math.min(totalStops * 2, 10));
        score = Math.round(score);

        setData({ transitScore: score, transitLabel: getScoreLabel(score), nearestTransitWalk: nearestWalk, nearestTransitType: nearestType, totalStops, hasSubway: !!(transit.subway?.length), hasRail: !!(transit.rail?.length), hasBus: !!(transit.bus?.length), hasBike: !!(transit.citibike?.length) });
      } catch { /* silently fail */ } finally { setLoading(false); }
    }
    fetchData();
  }, [latitude, longitude, city]);

  if (loading) return <Card><CardHeader><div className="h-5 w-36 bg-[#e2e8f0] rounded animate-pulse" /></CardHeader><CardContent><div className="h-20 bg-[#e2e8f0] rounded animate-pulse" /></CardContent></Card>;
  if (!data) return null;

  const color = getScoreColor(data.transitScore);

  return (
    <Card>
      <CardHeader><div className="flex items-center gap-2"><Footprints className="w-4.5 h-4.5" style={{ color: T.blue }} /><h3 className="text-base font-bold" style={{ color: T.text1 }}>Walkability & Transit</h3></div></CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0" style={{ backgroundColor: color }}>{data.transitScore}</div>
          <div><p className="text-sm font-semibold" style={{ color: T.text1 }}>{data.transitLabel}</p><p className="text-xs mt-0.5" style={{ color: T.text3 }}>Transit Score based on nearby stops</p></div>
        </div>
        <div className="w-full h-2 bg-[#f1f5f9] rounded-full mb-4 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${data.transitScore}%`, backgroundColor: color }} /></div>
        <div className="space-y-2 text-sm">
          {data.nearestTransitWalk !== null && <div className="flex items-center justify-between"><span style={{ color: T.text2 }}>Nearest Transit</span><span className="font-medium" style={{ color: T.text1 }}>{data.nearestTransitType ? `${TYPE_LABEL[data.nearestTransitType] || data.nearestTransitType} · ` : ""}{data.nearestTransitWalk} min walk</span></div>}
          <div className="flex items-center justify-between"><span style={{ color: T.text2 }}>Nearby Stops</span><span className="font-medium" style={{ color: T.text1 }}>{data.totalStops}</span></div>
          <div className="flex items-center gap-2 pt-1">
            {data.hasSubway && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2563EB]/10 text-[10px] font-medium text-[#2563EB]"><TrainFront className="w-3 h-3" /> Subway</span>}
            {data.hasRail && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#7C3AED]/10 text-[10px] font-medium text-[#7C3AED]"><TrainFront className="w-3 h-3" /> Rail</span>}
            {data.hasBus && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0891B2]/10 text-[10px] font-medium text-[#0891B2]">Bus</span>}
            {data.hasBike && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0369A1]/10 text-[10px] font-medium text-[#0369A1]"><Bike className="w-3 h-3" /> Bike</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
