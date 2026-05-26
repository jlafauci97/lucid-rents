"use client";

/**
 * Client-side wrapper for the 2-neighborhood A/B compare. Reads ?a=zipA&b=zipB
 * via useSearchParams, fetches stats + crime via REST. Lets parent page be
 * statically prerendered.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeftRight, MapPin } from "lucide-react";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { getLetterGrade, normalizeScore } from "@/lib/constants";
import { getNeighborhoodNameByCity } from "@/lib/neighborhoods";
import { neighborhoodUrl, cityPath } from "@/lib/seo";
import type { City } from "@/lib/cities";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface NeighborhoodStatRow {
  building_count: number;
  avg_score: number | null;
  total_violations: number;
  total_complaints: number;
  total_reviews: number;
}

interface CrimeZipRow {
  zip_code: string;
  total: number;
  violent: number;
  property: number;
}

async function fetchStats(zipCode: string): Promise<NeighborhoodStatRow | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/neighborhood_stats`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ target_zip: zipCode }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  return Array.isArray(data) ? data[0] || null : data;
}

async function fetchCrime(zipCode: string): Promise<CrimeZipRow | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/crime_by_zip_single`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ target_zip: zipCode }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  return Array.isArray(data) ? data[0] || null : data;
}

function StatComparison({
  label,
  valueA,
  valueB,
  formatFn = (v: number) => v.toLocaleString(),
  lowerIsBetter = false,
}: {
  label: string;
  valueA: number | null;
  valueB: number | null;
  formatFn?: (v: number) => string;
  lowerIsBetter?: boolean;
}) {
  const a = valueA ?? 0;
  const b = valueB ?? 0;
  const aWins = lowerIsBetter ? a < b : a > b;
  const bWins = lowerIsBetter ? b < a : b > a;
  const tie = a === b;

  return (
    <div className="grid grid-cols-3 items-center py-3 border-b border-[#f1f5f9] last:border-b-0">
      <div className={`text-right font-semibold ${aWins && !tie ? "text-[#10B981]" : "text-[#0F1D2E]"}`}>
        {valueA !== null ? formatFn(valueA) : "N/A"}
      </div>
      <div className="text-center text-xs text-[#94a3b8] font-medium uppercase tracking-wide px-2">
        {label}
      </div>
      <div className={`text-left font-semibold ${bWins && !tie ? "text-[#10B981]" : "text-[#0F1D2E]"}`}>
        {valueB !== null ? formatFn(valueB) : "N/A"}
      </div>
    </div>
  );
}

interface Props {
  city: City;
}

interface FetchedData {
  statsA: NeighborhoodStatRow | null;
  statsB: NeighborhoodStatRow | null;
  crimeA: CrimeZipRow | null;
  crimeB: CrimeZipRow | null;
}

export function NeighborhoodsCompareClient({ city }: Props) {
  const sp = useSearchParams();
  const zipA = sp.get("a") || undefined;
  const zipB = sp.get("b") || undefined;
  const meta = { name: city };

  const [data, setData] = useState<FetchedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!zipA || !zipB) {
      setData(null);
      return;
    }
    const myId = ++reqIdRef.current;
    setIsLoading(true);
    Promise.all([
      fetchStats(zipA),
      fetchStats(zipB),
      fetchCrime(zipA),
      fetchCrime(zipB),
    ]).then(([statsA, statsB, crimeA, crimeB]) => {
      if (myId !== reqIdRef.current) return;
      setData({ statsA, statsB, crimeA, crimeB });
      setIsLoading(false);
    });
  }, [zipA, zipB]);

  // Empty state
  if (!zipA || !zipB) {
    return (
      <div className="text-center py-12">
        <ArrowLeftRight className="w-12 h-12 text-[#94a3b8] mx-auto mb-4 mt-8" />
        <h1 className="text-2xl font-bold text-[#0F1D2E] mb-2">
          Compare {meta.name} Neighborhoods
        </h1>
        <p className="text-[#64748b] mb-6">
          Select two neighborhoods to compare them side by side.
        </p>
        <Link
          href={cityPath("/neighborhoods", city)}
          className="inline-flex items-center gap-2 text-[#3B82F6] font-medium hover:underline"
        >
          <MapPin className="w-4 h-4" />
          Browse all neighborhoods
        </Link>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="animate-pulse space-y-6 mt-8">
        <div className="h-8 w-64 bg-gray-200 rounded mx-auto" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-32 bg-gray-200 rounded-xl" />
          <div className="h-32 bg-gray-200 rounded-xl" />
        </div>
        <div className="h-96 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  const { statsA, statsB, crimeA, crimeB } = data;
  const nameA = getNeighborhoodNameByCity(zipA, city) || zipA;
  const nameB = getNeighborhoodNameByCity(zipB, city) || zipB;

  const scoreA = statsA?.avg_score ? Number(statsA.avg_score) : null;
  const scoreB = statsB?.avg_score ? Number(statsB.avg_score) : null;
  const buildingsA = statsA ? Number(statsA.building_count) : 0;
  const buildingsB = statsB ? Number(statsB.building_count) : 0;
  const violationsA = statsA ? Number(statsA.total_violations) : 0;
  const violationsB = statsB ? Number(statsB.total_violations) : 0;
  const complaintsA = statsA ? Number(statsA.total_complaints) : 0;
  const complaintsB = statsB ? Number(statsB.total_complaints) : 0;
  const reviewsA = statsA ? Number(statsA.total_reviews) : 0;
  const reviewsB = statsB ? Number(statsB.total_reviews) : 0;
  const vPerBuildingA = buildingsA > 0 ? violationsA / buildingsA : 0;
  const vPerBuildingB = buildingsB > 0 ? violationsB / buildingsB : 0;

  return (
    <>
      <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E] text-center mb-8">
        {nameA} vs {nameB}
      </h1>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <Link href={neighborhoodUrl(zipA, city)}>
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 text-center hover:border-[#3B82F6] transition-colors">
            <LetterGrade score={scoreA} size="lg" />
            <h2 className="text-lg font-bold text-[#0F1D2E] mt-3">{nameA}</h2>
            <p className="text-sm text-[#94a3b8]">{zipA}</p>
            {scoreA !== null && (
              <p className="text-xs text-[#64748b] mt-1">
                {normalizeScore(scoreA).toFixed(1)} / 5
              </p>
            )}
          </div>
        </Link>
        <Link href={neighborhoodUrl(zipB, city)}>
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 text-center hover:border-[#3B82F6] transition-colors">
            <LetterGrade score={scoreB} size="lg" />
            <h2 className="text-lg font-bold text-[#0F1D2E] mt-3">{nameB}</h2>
            <p className="text-sm text-[#94a3b8]">{zipB}</p>
            {scoreB !== null && (
              <p className="text-xs text-[#64748b] mt-1">
                {normalizeScore(scoreB).toFixed(1)} / 5
              </p>
            )}
          </div>
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-[#e2e8f0] p-6">
        <StatComparison label="Overall Grade" valueA={scoreA} valueB={scoreB} formatFn={(v) => getLetterGrade(v)} />
        <StatComparison label="Buildings" valueA={buildingsA} valueB={buildingsB} />
        <StatComparison label="Safety" valueA={crimeA ? crimeA.violent : null} valueB={crimeB ? crimeB.violent : null} lowerIsBetter formatFn={(v) => `${v.toLocaleString()} violent`} />
        <StatComparison label="Violations" valueA={violationsA} valueB={violationsB} lowerIsBetter />
        <StatComparison label="Viol./Building" valueA={vPerBuildingA} valueB={vPerBuildingB} lowerIsBetter formatFn={(v) => v.toFixed(1)} />
        <StatComparison label="Complaints" valueA={complaintsA} valueB={complaintsB} lowerIsBetter />
        <StatComparison label="Reviews" valueA={reviewsA} valueB={reviewsB} />
        <StatComparison label="Total Crime" valueA={crimeA?.total ?? null} valueB={crimeB?.total ?? null} lowerIsBetter />
        <StatComparison label="Violent Crime" valueA={crimeA?.violent ?? null} valueB={crimeB?.violent ?? null} lowerIsBetter />
        <StatComparison label="Property Crime" valueA={crimeA?.property ?? null} valueB={crimeB?.property ?? null} lowerIsBetter />
      </div>

      <div className="flex items-center justify-center gap-6 mt-8">
        <Link href={neighborhoodUrl(zipA, city)} className="text-[#3B82F6] font-medium hover:underline text-sm">
          View {nameA} report card
        </Link>
        <span className="text-[#e2e8f0]">|</span>
        <Link href={neighborhoodUrl(zipB, city)} className="text-[#3B82F6] font-medium hover:underline text-sm">
          View {nameB} report card
        </Link>
      </div>
    </>
  );
}
