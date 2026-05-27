"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

// Lazy-load the recharts canvas so the recharts bundle stays out of the
// building page's main client chunk and only ships when this section renders.
const ViolationTrendCanvas = dynamic(
  () => import("./ViolationTrendCanvas"),
  {
    ssr: false,
    loading: () => (
      <div
        style={{ height: 300, width: "100%" }}
        className="bg-[#f8fafc] rounded-lg animate-pulse"
      />
    ),
  }
);

interface MonthData {
  month: string;
  violations: number;
  complaints: number;
}

interface TrendData {
  months: MonthData[];
  trend: "improving" | "declining" | "stable";
}

interface ViolationTrendProps {
  buildingId: string;
  housingAgency?: string;
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const monthIndex = parseInt(m, 10) - 1;
  const shortYear = year.slice(2);
  return `${monthNames[monthIndex]} ${shortYear}`;
}

function TrendBadge({ trend }: { trend: "improving" | "declining" | "stable" }) {
  if (trend === "improving") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#dcfce7] text-[#16a34a]">
        <TrendingDown className="w-3.5 h-3.5" />
        Improving
      </span>
    );
  }
  if (trend === "declining") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#fee2e2] text-[#dc2626]">
        <TrendingUp className="w-3.5 h-3.5" />
        Declining
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#f1f5f9] text-[#64748b]">
      <Minus className="w-3.5 h-3.5" />
      Stable
    </span>
  );
}

function SkeletonChart() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="h-6 w-48 bg-[#e2e8f0] rounded animate-pulse" />
          <div className="h-6 w-24 bg-[#e2e8f0] rounded-full animate-pulse" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full bg-[#f8fafc] rounded-lg animate-pulse flex items-center justify-center">
          <div className="text-[#94a3b8] text-sm">Loading chart data...</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ViolationTrend({ buildingId, housingAgency = "HPD" }: ViolationTrendProps) {
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTrends() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/buildings/${buildingId}/trends`);
        if (!res.ok) {
          throw new Error("Failed to fetch trend data");
        }
        const json: TrendData = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    fetchTrends();
  }, [buildingId]);

  if (loading) {
    return <SkeletonChart />;
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold text-[#0F1D2E]">
            Violation &amp; Complaint Trends
          </h2>
        </CardHeader>
        <CardContent>
          <p className="text-center text-[#64748b] py-8">
            Unable to load trend data. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.months.length === 0) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold text-[#0F1D2E]">
            Violation &amp; Complaint Trends
          </h2>
        </CardHeader>
        <CardContent>
          <p className="text-center text-[#64748b] py-8">
            No violation or complaint data available for this building.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasAnyData = data.months.some(
    (m) => m.violations > 0 || m.complaints > 0
  );

  if (!hasAnyData) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#0F1D2E]">
              Violation &amp; Complaint Trends
            </h2>
            <TrendBadge trend="stable" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-center text-[#64748b] py-8">
            No violations or complaints recorded in the last 5 years.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show every 6th label on the x-axis to avoid crowding
  const chartData = data.months.map((m, i) => ({
    ...m,
    label: formatMonthLabel(m.month),
    showLabel: i % 6 === 0,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#0F1D2E]">
            Violation &amp; Complaint Trends
          </h2>
          <TrendBadge trend={data.trend} />
        </div>
        <p className="text-sm text-[#64748b] mt-1">
          Monthly counts over the last 5 years
        </p>
      </CardHeader>
      <CardContent>
        <ViolationTrendCanvas
          chartData={chartData}
          housingAgency={housingAgency}
        />
      </CardContent>
    </Card>
  );
}
