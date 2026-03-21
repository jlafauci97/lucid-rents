import { BarChart3 } from "lucide-react";

interface NeighborhoodStats {
  building_count: number;
  avg_score: number | null;
  total_violations: number;
  total_complaints: number;
  total_litigations: number;
  buildings_with_reviews: number;
  total_reviews: number;
  top_landlord: string | null;
  top_landlord_buildings: number;
}

interface CrimeZipRow {
  zip_code: string;
  borough: string;
  total: number;
  violent: number;
  property: number;
  quality_of_life: number;
}

interface NeighborhoodRankCardProps {
  zipCode: string;
  stats: NeighborhoodStats;
  crimeData: CrimeZipRow | null;
}

interface PercentileResult {
  label: string;
  percentile: number;
}

interface ZipAggregate {
  zip_code: string;
  total_violations: number;
  avg_score: number | null;
}

async function fetchZipAggregates(): Promise<ZipAggregate[]> {
  // Use Supabase REST to get per-zip violation totals and avg scores
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buildings?select=zip_code,violation_count,overall_score&zip_code=not.is.null`;
  const res = await fetch(url, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const rows: { zip_code: string; violation_count: number; overall_score: number | null }[] = await res.json();

  // Aggregate per zip
  const map = new Map<string, { violations: number; scores: number[]; count: number }>();
  for (const r of rows) {
    const entry = map.get(r.zip_code) || { violations: 0, scores: [], count: 0 };
    entry.violations += r.violation_count || 0;
    entry.count++;
    if (r.overall_score != null) entry.scores.push(r.overall_score);
    map.set(r.zip_code, entry);
  }

  return Array.from(map.entries()).map(([zip, data]) => ({
    zip_code: zip,
    total_violations: data.violations,
    avg_score: data.scores.length > 0
      ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length
      : null,
  }));
}

async function fetchAllCrimeData(): Promise<CrimeZipRow[]> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/crime_by_zip`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  return res.json();
}

function computePercentiles(
  stats: NeighborhoodStats,
  crimeData: CrimeZipRow | null,
  zipAggregates: ZipAggregate[],
  allCrime: CrimeZipRow[]
): PercentileResult[] {
  const results: PercentileResult[] = [];

  // Safety percentile: lower crime total = safer = higher percentile
  if (crimeData && allCrime.length > 1) {
    const crimeTotal = crimeData.total;
    const countWorse = allCrime.filter((c) => c.total > crimeTotal).length;
    const pct = Math.round((countWorse / allCrime.length) * 100);
    results.push({ label: "Safer than", percentile: pct });
  }

  // Violations percentile: fewer violations = better = higher percentile
  if (zipAggregates.length > 1) {
    const thisViolations = Number(stats.total_violations);
    const countWorse = zipAggregates.filter(
      (z) => z.total_violations > thisViolations
    ).length;
    results.push({
      label: "Fewer violations than",
      percentile: Math.round((countWorse / zipAggregates.length) * 100),
    });
  }

  // Rating percentile: higher avg_score = better
  if (stats.avg_score !== null) {
    const avgScore = Number(stats.avg_score);
    const withScores = zipAggregates.filter((z) => z.avg_score !== null);
    if (withScores.length > 1) {
      const countWorse = withScores.filter(
        (z) => Number(z.avg_score!) < avgScore
      ).length;
      results.push({
        label: "Better rated than",
        percentile: Math.round((countWorse / withScores.length) * 100),
      });
    }
  }

  return results;
}

function getBarColor(percentile: number): string {
  if (percentile > 60) return "bg-emerald-500";
  if (percentile >= 30) return "bg-amber-500";
  return "bg-red-500";
}

function getTextColor(percentile: number): string {
  if (percentile > 60) return "text-emerald-600";
  if (percentile >= 30) return "text-amber-600";
  return "text-red-600";
}

export async function NeighborhoodRankCard({
  stats,
  crimeData,
}: NeighborhoodRankCardProps) {
  const [zipAggregates, allCrime] = await Promise.all([
    fetchZipAggregates(),
    fetchAllCrimeData(),
  ]);

  const percentiles = computePercentiles(stats, crimeData, zipAggregates, allCrime);

  if (percentiles.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 mb-8">
      <div className="flex items-center gap-2 mb-5">
        <BarChart3 className="w-5 h-5 text-[#3B82F6]" />
        <h2 className="text-lg font-bold text-[#0F1D2E]">
          Neighborhood Rankings
        </h2>
      </div>
      <div className="space-y-4">
        {percentiles.map((p) => (
          <div key={p.label}>
            <div className="flex items-baseline justify-between mb-1.5">
              <p className="text-sm text-[#64748b]">
                {p.label}{" "}
                <span className={`font-bold ${getTextColor(p.percentile)}`}>
                  {p.percentile}%
                </span>{" "}
                of neighborhoods
              </p>
            </div>
            <div className="w-full h-3 bg-[#f1f5f9] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getBarColor(p.percentile)}`}
                style={{ width: `${p.percentile}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
