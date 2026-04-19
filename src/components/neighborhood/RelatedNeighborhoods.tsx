import Link from "next/link";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { neighborhoodUrl } from "@/lib/seo";
import { getNeighborhoodNameByCity, getAllNeighborhoodsByCity } from "@/lib/neighborhoods";
import type { City } from "@/lib/cities";
import { MapPin } from "lucide-react";

interface RelatedStats {
  zip_code: string;
  building_count: number;
  avg_score: number | null;
  total_violations: number;
}

async function fetchNeighborhoodStats(city: City): Promise<RelatedStats[]> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/neighborhood_index`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ target_city: city }),
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function RelatedNeighborhoods({
  currentZip, currentRegion, currentScore, city,
}: {
  currentZip: string; currentRegion: string; currentScore: number | null; city: City;
}) {
  const allNeighborhoods = getAllNeighborhoodsByCity(city);
  const stats = await fetchNeighborhoodStats(city);
  const statsMap = new Map(stats.map((s) => [s.zip_code, s]));

  const candidates = allNeighborhoods
    .filter((n) => n.zipCode !== currentZip)
    .map((n) => {
      const s = statsMap.get(n.zipCode);
      if (!s || s.building_count === 0) return null;
      const score = s.avg_score ? Number(s.avg_score) : null;
      const sameRegion = n.region === currentRegion;
      const scoreDiff = score !== null && currentScore !== null ? Math.abs(score - currentScore) : 5;
      return { ...n, buildingCount: s.building_count, avgScore: score, sameRegion, scoreDiff };
    })
    .filter((n): n is NonNullable<typeof n> => n !== null);

  candidates.sort((a, b) => {
    if (a.sameRegion !== b.sameRegion) return a.sameRegion ? -1 : 1;
    return a.scoreDiff - b.scoreDiff;
  });

  const related = candidates.slice(0, 4);
  if (related.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5 text-[#3B82F6]" />
        <h2 className="text-lg font-bold text-[#0F1D2E]">Nearby & Similar Neighborhoods</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {related.map((n) => (
          <Link key={n.zipCode} href={neighborhoodUrl(n.zipCode, city)} className="bg-white rounded-xl border border-[#e2e8f0] p-4 hover:border-[#3B82F6] hover:shadow-sm transition-all group">
            <div className="flex items-start gap-3">
              <LetterGrade score={n.avgScore} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#0F1D2E] group-hover:text-[#3B82F6] transition-colors truncate">{n.name}</p>
                <p className="text-xs text-[#94a3b8] mt-0.5">{n.zipCode}{n.region ? ` · ${n.region}` : ""}</p>
                <p className="text-xs text-[#64748b] mt-1">{n.buildingCount.toLocaleString()} buildings</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
