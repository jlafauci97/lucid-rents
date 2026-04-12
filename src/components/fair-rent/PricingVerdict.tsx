"use client";

import { useEffect, useRef } from "react";

interface PricingVerdictProps {
  askingVsFairPct: number;
  redFlagCount: number;
}

export function PricingVerdict({ askingVsFairPct, redFlagCount }: PricingVerdictProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const timer = setTimeout(() => el.classList.add("opacity-100", "translate-y-0"), 150);
    return () => clearTimeout(timer);
  }, []);

  const isOverpriced = askingVsFairPct > 5;
  const isUnderpriced = askingVsFairPct < -5;

  const icon = isOverpriced ? "\u{1F6A9}" : isUnderpriced ? "\u2705" : "\u27A1\uFE0F";
  const color = isOverpriced ? "text-red-700" : isUnderpriced ? "text-emerald-700" : "text-gray-600";
  const label = isOverpriced
    ? `${redFlagCount > 0 ? `${redFlagCount} red flag${redFlagCount > 1 ? "s" : ""} detected. ` : ""}This unit is ${Math.round(askingVsFairPct)}% overpriced.`
    : isUnderpriced
      ? `This unit is ${Math.abs(Math.round(askingVsFairPct))}% below fair market value.`
      : "This unit is priced within the fair range.";

  return (
    <div
      ref={ref}
      className="bg-white border border-[#e8e6e1] rounded-2xl px-6 py-5 mb-5 flex items-center gap-4 opacity-0 translate-y-4 transition-all duration-500"
    >
      <span className="text-3xl flex-shrink-0">{icon}</span>
      <div>
        <h3 className={`font-semibold ${color}`}>{label}</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Based on StreetEasy comps, Zillow ZORI validation, and NYC public records.
        </p>
      </div>
    </div>
  );
}
