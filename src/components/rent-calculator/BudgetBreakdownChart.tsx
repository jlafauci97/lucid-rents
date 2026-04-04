"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { BudgetBreakdown } from "@/lib/affordability";
import { formatCurrency } from "@/lib/affordability";

interface BudgetBreakdownChartProps {
  breakdown: BudgetBreakdown;
}

const SEGMENTS = [
  { key: "rent", label: "Rent", color: "#3B82F6" },
  { key: "utilities", label: "Utilities", color: "#06b6d4" },
  { key: "insurance", label: "Insurance", color: "#8b5cf6" },
  { key: "debt", label: "Debt Payments", color: "#f59e0b" },
  { key: "savings", label: "Savings (20%)", color: "#10b981" },
  { key: "discretionary", label: "Discretionary", color: "#94a3b8" },
] as const;

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { fill: string } }> }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-md px-3 py-2">
      <p className="text-xs font-semibold text-[#1A1F36]">{item.name}</p>
      <p className="text-sm font-bold" style={{ color: item.payload.fill }}>
        {formatCurrency(item.value)}
      </p>
    </div>
  );
}

export function BudgetBreakdownChart({
  breakdown,
}: BudgetBreakdownChartProps) {
  const data = SEGMENTS.filter(
    (s) => breakdown[s.key as keyof BudgetBreakdown] > 0
  ).map((s) => ({
    name: s.label,
    value: breakdown[s.key as keyof BudgetBreakdown] as number,
    fill: s.color,
  }));

  return (
    <div>
      <h3 className="text-sm font-semibold text-[#1A1F36] mb-3">
        Monthly Budget Breakdown
      </h3>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Chart */}
        <div className="w-[180px] h-[180px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.fill }}
              />
              <div>
                <p className="text-xs text-[#5E6687]">{item.name}</p>
                <p className="text-sm font-semibold text-[#1A1F36]">
                  {formatCurrency(item.value)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
