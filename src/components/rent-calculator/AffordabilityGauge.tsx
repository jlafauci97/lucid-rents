"use client";

import { formatCurrency } from "@/lib/affordability";

interface AffordabilityGaugeProps {
  recommendedMax: number;
  rentToIncomePercent: number;
}

export function AffordabilityGauge({
  recommendedMax,
  rentToIncomePercent,
}: AffordabilityGaugeProps) {
  // Map percent to a color: green < 25%, blue 25-30%, amber > 30%
  const color =
    rentToIncomePercent <= 25
      ? "#10b981"
      : rentToIncomePercent <= 30
      ? "#3B82F6"
      : "#f97316";

  // SVG arc (semi-circle gauge)
  const radius = 80;
  const circumference = Math.PI * radius;
  // Normalize percent to 0-100 for gauge fill (cap at 50% of income as max)
  const fillPercent = Math.min(rentToIncomePercent / 50, 1);
  const dashOffset = circumference * (1 - fillPercent);

  return (
    <div className="flex flex-col items-center">
      {/* Gauge */}
      <div className="relative w-[200px] h-[110px] mb-2">
        <svg
          viewBox="0 0 200 110"
          className="w-full h-full"
          aria-hidden="true"
        >
          {/* Background arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="text-2xl sm:text-3xl font-bold text-[#1A1F36]">
            {formatCurrency(recommendedMax)}
          </span>
          <span className="text-[10px] text-[#A3ACBE] font-medium">
            /month
          </span>
        </div>
      </div>

      <p className="text-sm font-medium text-[#5E6687]">
        {rentToIncomePercent}% of your income
      </p>
    </div>
  );
}
