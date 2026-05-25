import { Footprints, TrainFront, Bus, Bike } from "lucide-react";
import { createCacheClient } from "@/lib/supabase/cache-client";
import type { City } from "@/lib/cities";

async function getTransitStatsByZip(zipCode: string, city: City) {
  const supabase = createCacheClient();
  const { data: buildings } = await supabase.from("buildings").select("latitude, longitude").eq("zip_code", zipCode).eq("metro", city).not("latitude", "is", null).not("longitude", "is", null).limit(50);
  if (!buildings || buildings.length === 0) return null;

  const avgLat = buildings.reduce((s, b) => s + Number(b.latitude), 0) / buildings.length;
  const avgLng = buildings.reduce((s, b) => s + Number(b.longitude), 0) / buildings.length;
  const BBOX = 0.015;

  const { data: stops } = await supabase.from("transit_stops").select("type").gte("latitude", avgLat - BBOX).lte("latitude", avgLat + BBOX).gte("longitude", avgLng - BBOX).lte("longitude", avgLng + BBOX).eq("metro", city);
  if (!stops || stops.length === 0) return null;

  const counts: Record<string, number> = {};
  for (const s of stops) counts[s.type] = (counts[s.type] || 0) + 1;

  return { totalStops: stops.length, subwayCount: counts.subway || 0, railCount: counts.rail || 0, busCount: counts.bus || 0, bikeCount: counts.citibike || 0 };
}

function getTransitScore(stats: { totalStops: number; subwayCount: number; railCount: number; busCount: number; bikeCount: number }): number {
  let score = 0;
  score += Math.min(stats.subwayCount * 12, 40);
  score += Math.min(stats.railCount * 10, 30);
  score += Math.min(stats.busCount * 3, 20);
  score += Math.min(stats.bikeCount * 2, 10);
  return Math.min(100, score);
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#10B981";
  if (score >= 60) return "#3B82F6";
  if (score >= 40) return "#F59E0B";
  if (score >= 20) return "#F97316";
  return "#EF4444";
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent Transit";
  if (score >= 70) return "Great Transit";
  if (score >= 50) return "Good Transit";
  if (score >= 25) return "Some Transit";
  return "Limited Transit";
}

export async function WalkabilitySection({ zipCode, city }: { zipCode: string; city: City }) {
  const stats = await getTransitStatsByZip(zipCode, city);
  if (!stats) return null;

  const score = getTransitScore(stats);
  const color = getScoreColor(score);
  const label = getScoreLabel(score);

  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Footprints className="w-5 h-5 text-[#3B82F6]" />
        <h2 className="text-lg font-bold text-[#0F1D2E]">Walkability & Transit</h2>
      </div>
      <div className="flex items-center gap-6 mb-4">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0" style={{ backgroundColor: color }}>{score}</div>
        <div>
          <p className="text-base font-semibold text-[#0F1D2E]">{label}</p>
          <p className="text-sm text-[#64748b] mt-0.5">{stats.totalStops} transit stops nearby</p>
        </div>
      </div>
      <div className="w-full h-2.5 bg-[#f1f5f9] rounded-full mb-5 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.subwayCount > 0 && <div className="flex items-center gap-2 p-3 bg-[#f8fafc] rounded-lg"><TrainFront className="w-4 h-4 text-[#2563EB]" /><div><p className="text-sm font-semibold text-[#0F1D2E]">{stats.subwayCount}</p><p className="text-[10px] text-[#94a3b8]">Subway Stops</p></div></div>}
        {stats.railCount > 0 && <div className="flex items-center gap-2 p-3 bg-[#f8fafc] rounded-lg"><TrainFront className="w-4 h-4 text-[#7C3AED]" /><div><p className="text-sm font-semibold text-[#0F1D2E]">{stats.railCount}</p><p className="text-[10px] text-[#94a3b8]">Rail Stops</p></div></div>}
        {stats.busCount > 0 && <div className="flex items-center gap-2 p-3 bg-[#f8fafc] rounded-lg"><Bus className="w-4 h-4 text-[#0891B2]" /><div><p className="text-sm font-semibold text-[#0F1D2E]">{stats.busCount}</p><p className="text-[10px] text-[#94a3b8]">Bus Stops</p></div></div>}
        {stats.bikeCount > 0 && <div className="flex items-center gap-2 p-3 bg-[#f8fafc] rounded-lg"><Bike className="w-4 h-4 text-[#0369A1]" /><div><p className="text-sm font-semibold text-[#0F1D2E]">{stats.bikeCount}</p><p className="text-[10px] text-[#94a3b8]">Bike Stations</p></div></div>}
      </div>
    </div>
  );
}
