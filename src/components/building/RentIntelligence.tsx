import { BarChart3, TrendingUp, TrendingDown, MapPin, Calendar, DollarSign, Snowflake, Sun } from "lucide-react";
import { MarketListings } from "@/components/building/MarketListings";
import { RentHistoryChart as RentHistoryChartClient } from "@/components/building/RentHistoryChart";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RentIntelligenceProps {
  buildingId: string;
  building: {
    id: string;
    full_address: string;
    zip_code: string;
    violation_count: number;
    overall_score: number | null;
  };
  buildingRents: {
    month: string;
    beds: number;
    median_rent: number;
    min_rent: number;
    max_rent: number;
    listing_count: number;
  }[];
  neighborhoodRents: {
    month: string;
    beds: number;
    median_rent: number;
  }[];
  amenityPremiums: {
    amenity: string;
    premium_dollars: number;
  }[];
  seasonalIndex: {
    month_of_year: number;
    rent_index: number;
  }[];
  valueGrade: string;
  currentListings?: any[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatPct(value: number): string {
  return `${Math.abs(Math.round(value))}%`;
}

function formatDollars(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

/** Find the most common bed count in the dataset. */
function mostCommonBeds(rows: { beds: number }[]): number {
  const counts: Record<number, number> = {};
  for (const r of rows) {
    counts[r.beds] = (counts[r.beds] ?? 0) + 1;
  }
  let best = 0;
  let bestCount = 0;
  for (const beds of Object.keys(counts)) {
    const b = Number(beds);
    if (counts[b] > bestCount) {
      best = b;
      bestCount = counts[b];
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/*  Insight computations                                               */
/* ------------------------------------------------------------------ */

function computeRentChange(buildingRents: RentIntelligenceProps["buildingRents"]): {
  direction: "up" | "down" | "flat";
  pct: number;
  label: string;
} | null {
  if (buildingRents.length === 0) return null;

  const beds = mostCommonBeds(buildingRents);
  const filtered = buildingRents
    .filter((r) => r.beds === beds)
    .sort((a, b) => a.month.localeCompare(b.month));

  // Find earliest 2019 data point
  const earliest = filtered.find((r) => r.month.startsWith("2019"));
  const latest = filtered[filtered.length - 1];
  if (!earliest || !latest || earliest.median_rent === 0) return null;

  const pct = ((latest.median_rent - earliest.median_rent) / earliest.median_rent) * 100;
  if (Math.abs(pct) < 1) return { direction: "flat", pct: 0, label: "Stable since 2019" };
  return {
    direction: pct > 0 ? "up" : "down",
    pct,
    label: pct > 0
      ? `${formatPct(pct)} since 2019`
      : `${formatPct(pct)} since 2019`,
  };
}

function computeMedianPosition(
  buildingRents: RentIntelligenceProps["buildingRents"],
  neighborhoodRents: RentIntelligenceProps["neighborhoodRents"],
): { above: boolean; pct: number; label: string } | null {
  if (buildingRents.length === 0 || neighborhoodRents.length === 0) return null;

  const beds = mostCommonBeds(buildingRents);

  const latestBuilding = [...buildingRents]
    .filter((r) => r.beds === beds)
    .sort((a, b) => b.month.localeCompare(a.month))[0];

  const latestNeighborhood = [...neighborhoodRents]
    .filter((r) => r.beds === beds)
    .sort((a, b) => b.month.localeCompare(a.month))[0];

  if (!latestBuilding || !latestNeighborhood || latestNeighborhood.median_rent === 0) return null;

  const diff = latestBuilding.median_rent - latestNeighborhood.median_rent;
  const pct = (diff / latestNeighborhood.median_rent) * 100;

  if (Math.abs(pct) < 2) return { above: false, pct: 0, label: "At neighborhood median" };
  return {
    above: pct > 0,
    pct,
    label: pct > 0
      ? `${formatPct(pct)} above median`
      : `${formatPct(pct)} below median`,
  };
}

function computeBestMonth(seasonalIndex: RentIntelligenceProps["seasonalIndex"]): {
  cheapest: string;
  expensive: string;
  savingsPct: number;
} | null {
  if (seasonalIndex.length === 0) return null;

  let minIdx = seasonalIndex[0];
  let maxIdx = seasonalIndex[0];
  for (const s of seasonalIndex) {
    if (s.rent_index < minIdx.rent_index) minIdx = s;
    if (s.rent_index > maxIdx.rent_index) maxIdx = s;
  }

  const savingsPct = maxIdx.rent_index > 0
    ? ((maxIdx.rent_index - minIdx.rent_index) / maxIdx.rent_index) * 100
    : 0;

  return {
    cheapest: MONTH_NAMES[minIdx.month_of_year - 1] ?? "Unknown",
    expensive: MONTH_NAMES[maxIdx.month_of_year - 1] ?? "Unknown",
    savingsPct,
  };
}

/* ------------------------------------------------------------------ */
/*  Inline sub-components                                              */
/* ------------------------------------------------------------------ */

function InsightsBar({
  buildingRents,
  neighborhoodRents,
  seasonalIndex,
}: {
  buildingRents: RentIntelligenceProps["buildingRents"];
  neighborhoodRents: RentIntelligenceProps["neighborhoodRents"];
  seasonalIndex: RentIntelligenceProps["seasonalIndex"];
}) {
  const rentChange = computeRentChange(buildingRents);
  const position = computeMedianPosition(buildingRents, neighborhoodRents);
  const bestMonth = computeBestMonth(seasonalIndex);

  const hasAny = rentChange || position || bestMonth;
  if (!hasAny) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
      {/* Rent Change */}
      {rentChange && (
        <div className="rounded-lg bg-blue-50 p-3 flex items-start gap-2.5">
          {rentChange.direction === "up" ? (
            <TrendingUp className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          ) : rentChange.direction === "down" ? (
            <TrendingDown className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
          ) : (
            <TrendingUp className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
          )}
          <div>
            <p className="text-xs text-gray-500 font-medium">Rent Trend</p>
            <p className="text-sm font-semibold text-[#0F1D2E]">
              {rentChange.direction === "up" && "\u2191 "}
              {rentChange.direction === "down" && "\u2193 "}
              {rentChange.label}
            </p>
          </div>
        </div>
      )}

      {/* Neighborhood Position */}
      {position && (
        <div className="rounded-lg bg-blue-50 p-3 flex items-start gap-2.5">
          <MapPin className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-gray-500 font-medium">vs. Neighborhood</p>
            <p className="text-sm font-semibold text-[#0F1D2E]">
              {position.pct === 0
                ? position.label
                : position.above
                  ? position.label
                  : position.label}
            </p>
          </div>
        </div>
      )}

      {/* Best Month */}
      {bestMonth && (
        <div className="rounded-lg bg-blue-50 p-3 flex items-start gap-2.5">
          <Calendar className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-gray-500 font-medium">Best Time to Move</p>
            <p className="text-sm font-semibold text-[#0F1D2E]">
              Cheapest: {bestMonth.cheapest}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function PricePerSqft({
  buildingRents,
  neighborhoodRents,
}: {
  buildingRents: RentIntelligenceProps["buildingRents"];
  neighborhoodRents: RentIntelligenceProps["neighborhoodRents"];
}) {
  // Compute a rough $/sqft comparison using median rent data
  const beds = mostCommonBeds(buildingRents);
  const latestBuilding = [...buildingRents]
    .filter((r) => r.beds === beds)
    .sort((a, b) => b.month.localeCompare(a.month))[0];

  const latestNeighborhood = [...neighborhoodRents]
    .filter((r) => r.beds === beds)
    .sort((a, b) => b.month.localeCompare(a.month))[0];

  if (!latestBuilding) return null;

  const buildingMedian = latestBuilding.median_rent;
  const neighborhoodMedian = latestNeighborhood?.median_rent ?? 0;

  const percentile = neighborhoodMedian > 0
    ? Math.round((buildingMedian / neighborhoodMedian) * 50)
    : null;

  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="w-4 h-4 text-emerald-500" />
        <h4 className="text-sm font-semibold text-[#0F1D2E]">Price Comparison</h4>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-gray-500">Building median</span>
          <span className="text-base font-bold text-[#0F1D2E]">{formatDollars(buildingMedian)}/mo</span>
        </div>
        {neighborhoodMedian > 0 && (
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-gray-500">Neighborhood median</span>
            <span className="text-sm font-medium text-gray-600">{formatDollars(neighborhoodMedian)}/mo</span>
          </div>
        )}
        {percentile !== null && (
          <div className="mt-2 pt-2 border-t border-gray-50">
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(percentile, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {percentile > 50 ? "Above" : "Below"} neighborhood average
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SeasonalPattern({
  seasonalIndex,
}: {
  seasonalIndex: RentIntelligenceProps["seasonalIndex"];
}) {
  const best = computeBestMonth(seasonalIndex);
  if (!best) return null;

  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-blue-500" />
        <h4 className="text-sm font-semibold text-[#0F1D2E]">Seasonal Pattern</h4>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Snowflake className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs text-gray-500">Cheapest</span>
          </div>
          <span className="text-sm font-semibold text-green-600">{best.cheapest}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sun className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-xs text-gray-500">Most expensive</span>
          </div>
          <span className="text-sm font-semibold text-red-500">{best.expensive}</span>
        </div>
        {best.savingsPct > 0 && (
          <div className="mt-1 pt-2 border-t border-gray-50">
            <p className="text-xs text-gray-500">
              Potential savings:{" "}
              <span className="font-semibold text-green-600">
                ~{formatPct(best.savingsPct)}
              </span>{" "}
              by timing your move
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component (server)                                            */
/* ------------------------------------------------------------------ */

export async function RentIntelligence({
  buildingId,
  building,
  buildingRents,
  neighborhoodRents,
  amenityPremiums,
  seasonalIndex,
  valueGrade,
  currentListings,
}: RentIntelligenceProps) {
  const hasRentData = buildingRents.length > 0;
  const hasSeasonalData = seasonalIndex.length > 0;
  const hasListings = currentListings && currentListings.length > 0;

  if (!hasRentData && !hasSeasonalData && !hasListings) {
    return null;
  }

  return (
    <section id="rent-intelligence" className="scroll-mt-20 space-y-4">
      {/* Section Header */}
      <h2 className="text-lg font-semibold text-[#0F1D2E] flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-blue-500" />
        Rent Intelligence
      </h2>

      {/* Insights Bar */}
      {hasRentData && (
        <InsightsBar
          buildingRents={buildingRents}
          neighborhoodRents={neighborhoodRents}
          seasonalIndex={seasonalIndex}
        />
      )}

      {/* Rent History Chart */}
      {hasRentData && (
        <RentHistoryChartClient
          buildingId={buildingId}
          buildingRents={buildingRents}
          neighborhoodRents={neighborhoodRents}
        />
      )}

      {/* Two-column grid: Price comparison + Seasonal pattern */}
      {(hasRentData || hasSeasonalData) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Left: Value Breakdown */}
          {hasRentData && (
            <ValueBreakdown
              buildingRents={buildingRents}
              neighborhoodRents={neighborhoodRents}
              amenityPremiums={amenityPremiums}
              valueGrade={valueGrade}
            />
          )}

          {/* Right: Two stacked mini-cards */}
          <div className="flex flex-col gap-4">
            {hasRentData && (
              <PricePerSqft
                buildingRents={buildingRents}
                neighborhoodRents={neighborhoodRents}
              />
            )}
            {hasSeasonalData && (
              <SeasonalPattern seasonalIndex={seasonalIndex} />
            )}
          </div>
        </div>
      )}

      {/* Current Listings */}
      {hasListings && (
        <MarketListings
          listings={currentListings}
          amenities={[]}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Placeholder sub-components (to be implemented in their own files)  */
/* ------------------------------------------------------------------ */

/**
 * Placeholder for ValueBreakdown — renders amenity premiums summary
 * until the full component is built in ./ValueBreakdown.tsx
 */
function ValueBreakdown({
  buildingRents,
  neighborhoodRents,
  amenityPremiums,
  valueGrade,
}: {
  buildingRents: RentIntelligenceProps["buildingRents"];
  neighborhoodRents: RentIntelligenceProps["neighborhoodRents"];
  amenityPremiums: RentIntelligenceProps["amenityPremiums"];
  valueGrade: string;
}) {
  const gradeColors: Record<string, string> = {
    A: "text-green-600 bg-green-50",
    B: "text-blue-600 bg-blue-50",
    C: "text-yellow-600 bg-yellow-50",
    D: "text-orange-600 bg-orange-50",
    F: "text-red-600 bg-red-50",
  };

  const gradeStyle = gradeColors[valueGrade?.[0]?.toUpperCase() ?? ""] ?? "text-gray-600 bg-gray-50";

  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-[#0F1D2E]">Value Breakdown</h4>
        {valueGrade && (
          <span className={`text-lg font-bold px-2.5 py-0.5 rounded-lg ${gradeStyle}`}>
            {valueGrade}
          </span>
        )}
      </div>

      {amenityPremiums.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 mb-2">Amenity premiums in this area</p>
          {amenityPremiums.slice(0, 5).map((ap) => (
            <div key={ap.amenity} className="flex justify-between items-center">
              <span className="text-xs text-gray-600">{ap.amenity}</span>
              <span className="text-xs font-semibold text-[#0F1D2E]">
                +{formatDollars(ap.premium_dollars)}/mo
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400">No amenity premium data available.</p>
      )}
    </div>
  );
}
