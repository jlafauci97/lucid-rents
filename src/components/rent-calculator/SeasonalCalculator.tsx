"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  CalendarDays,
  TrendingDown,
  TrendingUp,
  BadgeDollarSign,
  ChevronDown,
  Loader2,
  Info,
} from "lucide-react";
import { CITY_META, VALID_CITIES, type City } from "@/lib/cities";

/* ---------- types ---------- */
interface SeasonalPoint {
  month_of_year: number;
  rent_index: number;
  sample_years: number;
}

interface NeighborhoodOption {
  neighborhood: string | null;
  zip: string | null;
}

/* ---------- constants ---------- */
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const BED_OPTIONS = [
  { value: 0, label: "Studio" },
  { value: 1, label: "1 BR" },
  { value: 2, label: "2 BR" },
  { value: 3, label: "3 BR" },
];

const CITY_LABELS: Record<City, string> = {
  nyc: "NYC",
  "los-angeles": "Los Angeles",
  chicago: "Chicago",
  miami: "Miami",
  houston: "Houston",
};

// Approximate city-wide median rents for dollar estimate (used when no data)
const CITY_MEDIAN_RENTS: Record<City, Record<number, number>> = {
  nyc: { 0: 2600, 1: 3200, 2: 3800, 3: 4600 },
  "los-angeles": { 0: 1700, 1: 2200, 2: 2800, 3: 3500 },
  chicago: { 0: 1200, 1: 1600, 2: 2000, 3: 2500 },
  miami: { 0: 1800, 1: 2200, 2: 2800, 3: 3400 },
  houston: { 0: 1000, 1: 1300, 2: 1600, 3: 2000 },
};

/* ---------- helpers ---------- */
function indexToColor(index: number): string {
  // Map rent_index to a green-white-red gradient
  // < 1.0 = cheaper = green, > 1.0 = more expensive = red
  const deviation = index - 1.0;
  if (deviation <= -0.06) return "#15803d"; // deep green
  if (deviation <= -0.03) return "#22c55e"; // green
  if (deviation <= -0.01) return "#86efac"; // light green
  if (deviation <= 0.01) return "#f1f5f9";  // neutral
  if (deviation <= 0.03) return "#fca5a5";  // light red
  if (deviation <= 0.06) return "#ef4444";  // red
  return "#b91c1c"; // deep red
}

function indexToTextColor(index: number): string {
  const deviation = index - 1.0;
  if (deviation <= -0.03 || deviation >= 0.06) return "text-white";
  return "text-gray-900";
}

function indexToBarColor(index: number): string {
  const deviation = index - 1.0;
  if (deviation <= -0.03) return "#22c55e";
  if (deviation <= -0.01) return "#86efac";
  if (deviation <= 0.01) return "#94a3b8";
  if (deviation <= 0.03) return "#fca5a5";
  return "#ef4444";
}

function formatPct(index: number): string {
  const pct = (index - 1.0) * 100;
  if (Math.abs(pct) < 0.5) return "avg";
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

/* ---------- component ---------- */
export function SeasonalCalculator() {
  const [city, setCity] = useState<City>("nyc");
  const [beds, setBeds] = useState(1);
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodOption[]>([]);
  const [selectedZip, setSelectedZip] = useState<string | null>(null);
  const [data, setData] = useState<SeasonalPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [nhLoading, setNhLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch neighborhoods when city changes
  const fetchNeighborhoods = useCallback(async (c: City) => {
    setNhLoading(true);
    try {
      const res = await fetch(
        `/api/rent-timing-calculator?city=${c}&action=neighborhoods`
      );
      if (!res.ok) throw new Error("Failed to fetch neighborhoods");
      const list: NeighborhoodOption[] = await res.json();
      setNeighborhoods(list);
      // Reset selection — default to city-wide (null)
      setSelectedZip(null);
    } catch {
      setNeighborhoods([]);
    } finally {
      setNhLoading(false);
    }
  }, []);

  // Fetch seasonal data when filters change
  const fetchData = useCallback(async (c: City, zip: string | null, b: number) => {
    setLoading(true);
    setError("");
    try {
      let url = `/api/rent-timing-calculator?city=${c}&beds=${b}`;
      if (zip) url += `&zip=${encodeURIComponent(zip)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      const points: SeasonalPoint[] = await res.json();
      setData(points);
    } catch {
      setError("Unable to load seasonal data. Please try again.");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNeighborhoods(city);
  }, [city, fetchNeighborhoods]);

  useEffect(() => {
    fetchData(city, selectedZip, beds);
  }, [city, selectedZip, beds, fetchData]);

  // Derived insights
  const insights = useMemo(() => {
    if (data.length === 0) return null;

    const sorted = [...data].sort((a, b) => a.rent_index - b.rent_index);
    const cheapest = sorted[0];
    const mostExpensive = sorted[sorted.length - 1];
    const medianRent = CITY_MEDIAN_RENTS[city]?.[beds] ?? 2000;
    const annualSavings = Math.round(
      (mostExpensive.rent_index - cheapest.rent_index) * medianRent * 12
    );

    const selectedNh = neighborhoods.find((n) => n.zip === selectedZip);
    const locationLabel = selectedNh?.neighborhood
      ? selectedNh.neighborhood
      : CITY_LABELS[city];

    return {
      cheapest,
      mostExpensive,
      annualSavings,
      locationLabel,
      medianRent,
    };
  }, [data, city, beds, selectedZip, neighborhoods]);

  // Chart data
  const chartData = useMemo(() => {
    return data.map((d) => ({
      month: MONTH_NAMES[d.month_of_year - 1],
      index: d.rent_index,
      pct: ((d.rent_index - 1.0) * 100),
    }));
  }, [data]);

  const handleCityChange = (c: City) => {
    setCity(c);
    setSelectedZip(null);
  };

  return (
    <div className="space-y-8">
      {/* City Selector */}
      <div className="flex flex-wrap justify-center gap-2">
        {VALID_CITIES.map((c) => (
          <button
            key={c}
            onClick={() => handleCityChange(c)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              city === c
                ? "bg-[#6366F1] text-white shadow-md"
                : "bg-white text-gray-700 border border-[#E2E8F0] hover:border-[#6366F1] hover:text-[#6366F1]"
            }`}
          >
            {CITY_LABELS[c]}
          </button>
        ))}
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
        {/* Neighborhood / ZIP dropdown */}
        <div className="relative w-full sm:w-64">
          <select
            value={selectedZip ?? ""}
            onChange={(e) => setSelectedZip(e.target.value || null)}
            disabled={nhLoading}
            className="w-full appearance-none bg-white border border-[#E2E8F0] rounded-lg px-4 py-2.5 pr-10 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent disabled:opacity-50"
          >
            <option value="">City-wide average</option>
            {neighborhoods.map((n) => (
              <option key={`${n.zip}-${n.neighborhood}`} value={n.zip ?? ""}>
                {n.neighborhood ? `${n.neighborhood} (${n.zip})` : n.zip}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>

        {/* Bed count selector */}
        <div className="flex gap-1 bg-white border border-[#E2E8F0] rounded-lg p-1">
          {BED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setBeds(opt.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                beds === opt.value
                  ? "bg-[#6366F1] text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading / Error states */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-[#6366F1] animate-spin" />
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-12 text-red-600 text-sm">{error}</div>
      )}

      {!loading && !error && data.length === 0 && (
        <div className="text-center py-12 text-gray-500 text-sm">
          No seasonal data available for this selection. Try a different
          neighborhood or bedroom count.
        </div>
      )}

      {/* Main content when data is loaded */}
      {!loading && !error && data.length > 0 && (
        <>
          {/* Seasonal Calendar Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {data.map((d) => {
              const isCheapest =
                insights && d.month_of_year === insights.cheapest.month_of_year;
              const isMostExpensive =
                insights &&
                d.month_of_year === insights.mostExpensive.month_of_year;
              const dollarEstimate = Math.round(
                d.rent_index * (insights?.medianRent ?? 2000)
              );

              return (
                <div
                  key={d.month_of_year}
                  className={`relative rounded-xl p-3 text-center transition-shadow hover:shadow-md ${indexToTextColor(d.rent_index)}`}
                  style={{ backgroundColor: indexToColor(d.rent_index) }}
                >
                  {isCheapest && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-green-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      BEST
                    </span>
                  )}
                  {isMostExpensive && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-red-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      WORST
                    </span>
                  )}
                  <div className="text-xs font-semibold opacity-80 mb-1">
                    {MONTH_NAMES[d.month_of_year - 1]}
                  </div>
                  <div className="text-lg font-bold">
                    {d.rent_index.toFixed(2)}
                  </div>
                  <div className="text-xs opacity-75 mt-0.5">
                    ~${dollarEstimate.toLocaleString()}
                  </div>
                  <div className="text-[10px] opacity-60 mt-0.5">
                    {formatPct(d.rent_index)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Key Insight Box */}
          {insights && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
              <h3 className="flex items-center gap-2 font-semibold text-blue-900">
                <BadgeDollarSign className="w-5 h-5" />
                Key Insights
              </h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <TrendingDown className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>
                    In <strong>{insights.locationLabel}</strong>, the best month
                    to sign a lease is{" "}
                    <strong>
                      {MONTH_FULL[insights.cheapest.month_of_year - 1]}
                    </strong>{" "}
                    (rent averages{" "}
                    {Math.abs(
                      Math.round((insights.cheapest.rent_index - 1.0) * 100)
                    )}
                    % below the annual average).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <TrendingUp className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <span>
                    The most expensive month is{" "}
                    <strong>
                      {MONTH_FULL[insights.mostExpensive.month_of_year - 1]}
                    </strong>{" "}
                    (
                    {Math.round(
                      (insights.mostExpensive.rent_index - 1.0) * 100
                    )}
                    % above average).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CalendarDays className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>
                    Timing your move could save you{" "}
                    <strong>
                      ~${insights.annualSavings.toLocaleString()}/year
                    </strong>{" "}
                    on a {beds === 0 ? "Studio" : `${beds}BR`}.
                  </span>
                </li>
              </ul>
            </div>
          )}

          {/* Recharts Bar Chart */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Monthly Rent Index
            </h3>
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={{ stroke: "#e2e8f0" }}
                  />
                  <YAxis
                    domain={["dataMin - 0.02", "dataMax + 0.02"]}
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => v.toFixed(2)}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as {
                        month: string;
                        index: number;
                        pct: number;
                      };
                      return (
                        <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-md px-3 py-2 text-sm">
                          <div className="font-semibold text-gray-900">
                            {d.month}
                          </div>
                          <div className="text-gray-600">
                            Index: {d.index.toFixed(3)}
                          </div>
                          <div
                            className={
                              d.pct < 0 ? "text-green-600" : "text-red-500"
                            }
                          >
                            {d.pct > 0 ? "+" : ""}
                            {d.pct.toFixed(1)}% vs average
                          </div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine
                    y={1.0}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    label={{
                      value: "Avg",
                      position: "right",
                      fill: "#94a3b8",
                      fontSize: 11,
                    }}
                  />
                  <Bar dataKey="index" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={indexToBarColor(entry.index)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* How This Works */}
          <div className="bg-gray-50 border border-[#E2E8F0] rounded-xl p-5">
            <h3 className="flex items-center gap-2 font-semibold text-gray-800 mb-2">
              <Info className="w-5 h-5 text-gray-500" />
              How This Works
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              We analyzed 12 years of rental listing data to compute a seasonal
              rent index for every neighborhood. An index of{" "}
              <strong>0.92</strong> means rents in that month average{" "}
              <strong>8% below</strong> the annual mean, while{" "}
              <strong>1.05</strong> means <strong>5% above</strong>. Patterns
              vary by city and neighborhood — in most markets, winter months
              (especially January and February) offer the lowest rents, while
              summer months see peak demand and pricing.
            </p>
          </div>

          {/* CTA */}
          <div className="text-center">
            <a
              href={`/${CITY_META[city].urlPrefix}/buildings`}
              className="inline-flex items-center gap-2 bg-[#6366F1] text-white px-6 py-3 rounded-lg font-medium text-sm hover:bg-[#2563eb] transition-colors shadow-sm"
            >
              Browse buildings in {CITY_LABELS[city]}
            </a>
          </div>
        </>
      )}
    </div>
  );
}
