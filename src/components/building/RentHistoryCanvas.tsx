"use client";

import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine,
  Label,
} from "recharts";

export interface ChartDataPoint {
  month: string;
  label: string;
  buildingMedian: number | null;
  minRent: number | null;
  maxRent: number | null;
  range: [number, number] | null;
  neighborhoodMedian: number | null;
  listingCount: number;
}

function formatDollar(value: number): string {
  return `$${value.toLocaleString()}`;
}

function formatYearTick(month: string): string {
  const year = month.slice(2, 4);
  return `'${year}`;
}

function formatTooltipMonth(month: string): string {
  const d = new Date(month + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function CustomTooltip({
  active,
  payload,
  showNeighborhood,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
  label?: string;
  showNeighborhood: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-lg shadow-md px-3 py-2.5 text-xs">
      <p className="font-semibold text-[#0F1D2E] mb-1.5">
        {formatTooltipMonth(data.month)}
      </p>
      {data.buildingMedian !== null && (
        <div className="flex items-center gap-2 mb-0.5">
          <span className="w-2.5 h-0.5 bg-[#3B82F6] rounded-full inline-block" />
          <span className="text-[#334155]">
            Building median:{" "}
            <span className="font-medium">{formatDollar(data.buildingMedian)}</span>
          </span>
        </div>
      )}
      {data.minRent !== null && data.maxRent !== null && (
        <div className="flex items-center gap-2 mb-0.5">
          <span className="w-2.5 h-0.5 bg-[#93C5FD] rounded-full inline-block" />
          <span className="text-[#64748b]">
            Range: {formatDollar(data.minRent)} - {formatDollar(data.maxRent)}
          </span>
        </div>
      )}
      {showNeighborhood && data.neighborhoodMedian !== null && (
        <div className="flex items-center gap-2 mb-0.5">
          <span className="w-2.5 h-0.5 bg-[#94a3b8] rounded-full inline-block" />
          <span className="text-[#64748b]">
            Neighborhood:{" "}
            <span className="font-medium">
              {formatDollar(data.neighborhoodMedian)}
            </span>
          </span>
        </div>
      )}
      {data.listingCount > 0 && (
        <p className="text-[#94a3b8] mt-1">
          {data.listingCount} listing{data.listingCount !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

interface Props {
  chartData: ChartDataPoint[];
  tickIndices: Set<number>;
  showNeighborhood: boolean;
  covidAnnotation: { month: string; label: string } | null;
}

export default function RentHistoryCanvas({
  chartData,
  tickIndices,
  showNeighborhood,
  covidAnnotation,
}: Props) {
  return (
    <div className="h-[250px] sm:h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
            tickFormatter={(value: string, index: number) =>
              tickIndices.has(index) ? formatYearTick(value) : ""
            }
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(value: number) =>
              `$${value >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : value}`
            }
          />
          <Tooltip
            content={
              <CustomTooltip showNeighborhood={showNeighborhood} />
            }
          />
          {/* Min-max range area */}
          <Area
            type="monotone"
            dataKey="range"
            fill="#3B82F6"
            fillOpacity={0.1}
            stroke="none"
            connectNulls={false}
            isAnimationActive={false}
          />
          {/* Building median line */}
          <Line
            type="monotone"
            dataKey="buildingMedian"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: "#3B82F6" }}
            connectNulls
          />
          {/* Neighborhood median line */}
          {showNeighborhood && (
            <Line
              type="monotone"
              dataKey="neighborhoodMedian"
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0, fill: "#94a3b8" }}
              connectNulls
            />
          )}
          {/* COVID annotation */}
          {covidAnnotation && (
            <ReferenceLine
              x={covidAnnotation.month}
              stroke="#94a3b8"
              strokeDasharray="3 3"
              strokeWidth={1}
            >
              <Label
                value={covidAnnotation.label}
                position="top"
                fill="#94a3b8"
                fontSize={10}
                offset={8}
              />
            </ReferenceLine>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
