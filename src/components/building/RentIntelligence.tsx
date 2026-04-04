import { TrendingUp, TrendingDown, MapPin, Calendar, DollarSign, Snowflake, Sun } from "lucide-react";
import { MarketListings } from "@/components/building/MarketListings";
import { RentHistoryChart } from "@/components/building/RentHistoryChart";
import { T, gradeColor } from "@/lib/design-tokens";
import { SectionTitle } from "@/components/ui/SectionTitle";

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

  // Average rent_index per month (multiple rows per month from different bed types)
  const monthMap = new Map<number, { total: number; count: number }>();
  for (const s of seasonalIndex) {
    const prev = monthMap.get(s.month_of_year) || { total: 0, count: 0 };
    prev.total += s.rent_index;
    prev.count += 1;
    monthMap.set(s.month_of_year, prev);
  }

  const monthAvgs = [...monthMap.entries()].map(([month, { total, count }]) => ({
    month_of_year: month,
    rent_index: total / count,
  }));

  if (monthAvgs.length === 0) return null;

  let minIdx = monthAvgs[0];
  let maxIdx = monthAvgs[0];
  for (const s of monthAvgs) {
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
        <div className="rounded-2xl p-3 flex items-start gap-2.5" style={{ backgroundColor: T.elevated }}>
          {rentChange.direction === "up" ? (
            <TrendingUp className="w-4 h-4 mt-0.5 shrink-0" style={{ color: T.danger }} />
          ) : rentChange.direction === "down" ? (
            <TrendingDown className="w-4 h-4 mt-0.5 shrink-0" style={{ color: T.sage }} />
          ) : (
            <TrendingUp className="w-4 h-4 mt-0.5 shrink-0" style={{ color: T.text3 }} />
          )}
          <div>
            <p className="text-xs font-medium" style={{ color: T.text2, fontFamily: "var(--font-body)" }}>Rent Trend</p>
            <p className="text-sm font-semibold" style={{ color: T.text1, fontFamily: "var(--font-body)" }}>
              {rentChange.direction === "up" && "\u2191 "}
              {rentChange.direction === "down" && "\u2193 "}
              {rentChange.label}
            </p>
          </div>
        </div>
      )}

      {/* Neighborhood Position */}
      {position && (
        <div className="rounded-2xl p-3 flex items-start gap-2.5" style={{ backgroundColor: T.elevated }}>
          <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: T.blue }} />
          <div>
            <p className="text-xs font-medium" style={{ color: T.text2, fontFamily: "var(--font-body)" }}>vs. Neighborhood</p>
            <p className="text-sm font-semibold" style={{ color: T.text1, fontFamily: "var(--font-body)" }}>
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
        <div className="rounded-2xl p-3 flex items-start gap-2.5" style={{ backgroundColor: T.elevated }}>
          <Calendar className="w-4 h-4 mt-0.5 shrink-0" style={{ color: T.sage }} />
          <div>
            <p className="text-xs font-medium" style={{ color: T.text2, fontFamily: "var(--font-body)" }}>Best Time to Move</p>
            <p className="text-sm font-semibold" style={{ color: T.text1, fontFamily: "var(--font-body)" }}>
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

  // Hide if medians are identical (building IS the only data point in the neighborhood)
  if (neighborhoodMedian > 0 && buildingMedian === neighborhoodMedian) return null;

  const percentile = neighborhoodMedian > 0
    ? Math.round((buildingMedian / neighborhoodMedian) * 50)
    : null;

  return (
    <div className="rounded-2xl border shadow-sm p-4" style={{ backgroundColor: T.surface, borderColor: T.border }}>
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="w-4 h-4" style={{ color: T.sage }} />
        <h4 className="text-sm font-semibold" style={{ color: T.text1, fontFamily: "var(--font-display)" }}>Price Comparison</h4>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-xs" style={{ color: T.text2, fontFamily: "var(--font-body)" }}>Building median</span>
          <span className="text-base font-bold" style={{ color: T.text1, fontFamily: "var(--font-mono)" }}>{formatDollars(buildingMedian)}/mo</span>
        </div>
        {neighborhoodMedian > 0 && (
          <div className="flex justify-between items-baseline">
            <span className="text-xs" style={{ color: T.text2, fontFamily: "var(--font-body)" }}>Neighborhood median</span>
            <span className="text-sm font-medium" style={{ color: T.text2, fontFamily: "var(--font-mono)" }}>{formatDollars(neighborhoodMedian)}/mo</span>
          </div>
        )}
        {percentile !== null && (
          <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${T.subtle}` }}>
            <div className="w-full rounded-full h-2" style={{ backgroundColor: T.subtle }}>
              <div
                className="h-2 rounded-full transition-all"
                style={{ width: `${Math.min(percentile, 100)}%`, backgroundColor: T.blue }}
              />
            </div>
            <p className="text-[11px] mt-1" style={{ color: T.text3 }}>
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
    <div className="rounded-2xl border shadow-sm p-4" style={{ backgroundColor: T.surface, borderColor: T.border }}>
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4" style={{ color: T.blue }} />
        <h4 className="text-sm font-semibold" style={{ color: T.text1, fontFamily: "var(--font-display)" }}>Seasonal Pattern</h4>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Snowflake className="w-3.5 h-3.5" style={{ color: T.blue }} />
            <span className="text-xs" style={{ color: T.text2, fontFamily: "var(--font-body)" }}>Cheapest</span>
          </div>
          <span className="text-sm font-semibold" style={{ color: T.sage }}>{best.cheapest}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sun className="w-3.5 h-3.5" style={{ color: T.coral }} />
            <span className="text-xs" style={{ color: T.text2, fontFamily: "var(--font-body)" }}>Most expensive</span>
          </div>
          <span className="text-sm font-semibold" style={{ color: T.danger }}>{best.expensive}</span>
        </div>
        {best.savingsPct > 0 && (
          <div className="mt-1 pt-2" style={{ borderTop: `1px solid ${T.subtle}` }}>
            <p className="text-xs" style={{ color: T.text2, fontFamily: "var(--font-body)" }}>
              Potential savings:{" "}
              <span className="font-semibold" style={{ color: T.sage }}>
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
      <SectionTitle subtitle="Real-time pricing intelligence from Dewey, StreetEasy & Zillow">
        Rent Intelligence
      </SectionTitle>

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
        <RentHistoryChart
          buildingId={buildingId}
          buildingRents={buildingRents}
          neighborhoodRents={neighborhoodRents}
        />
      )}

      {/* Two-column grid: Price comparison + Seasonal pattern */}
      {(hasRentData || hasSeasonalData) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Seasonal + Price info */}
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
/*  Placeholder sub-components                                         */
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
  const gc = gradeColor(valueGrade ?? "C");

  return (
    <div className="rounded-2xl border shadow-sm p-4" style={{ backgroundColor: T.surface, borderColor: T.border }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold" style={{ color: T.text1, fontFamily: "var(--font-display)" }}>Value Breakdown</h4>
        {valueGrade && (
          <span
            className="text-lg font-bold px-2.5 py-0.5 rounded-lg"
            style={{ color: gc, backgroundColor: `${gc}15` }}
          >
            {valueGrade}
          </span>
        )}
      </div>

      {amenityPremiums.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs mb-2" style={{ color: T.text2, fontFamily: "var(--font-body)" }}>Amenity premiums in this area</p>
          {amenityPremiums.slice(0, 5).map((ap) => (
            <div key={ap.amenity} className="flex justify-between items-center">
              <span className="text-xs" style={{ color: T.text2 }}>{ap.amenity}</span>
              <span className="text-xs font-semibold" style={{ color: T.text1, fontFamily: "var(--font-mono)" }}>
                +{formatDollars(ap.premium_dollars)}/mo
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs" style={{ color: T.text3 }}>No amenity premium data available.</p>
      )}
    </div>
  );
}
