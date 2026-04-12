"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, ReferenceLine } from "recharts";
import type { PricingResult, ListingData } from "./types";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

function fmt(n: number): string {
  return "$" + Math.round(n).toLocaleString();
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

interface FairPriceCardProps {
  listing: ListingData;
  pricing: PricingResult;
}

export function FairPriceCard({ listing, pricing }: FairPriceCardProps) {
  const [expanded, setExpanded] = useState(false);

  const p25 = percentile(pricing.comp_prices, 25);
  const p50 = percentile(pricing.comp_prices, 50);
  const p75 = percentile(pricing.comp_prices, 75);

  const chartData = [
    ...pricing.comp_prices.slice(0, 8).map((p, i) => ({
      name: `Comp ${i + 1}`,
      price: p,
      isCurrent: false,
    })),
    { name: "This unit", price: listing.asking_price, isCurrent: true },
  ].sort((a, b) => a.price - b.price);

  const steps = [
    {
      label: "Comp pool",
      text: `${pricing.comp_count} active StreetEasy listings: same beds, sqft +/-25%, within 0.5mi, listed in last 60 days. Median = ${fmt(pricing.base_price)}`,
    },
    {
      label: "ZORI validation",
      text: pricing.zori_blend_triggered
        ? `Zillow ZORI for ZIP ${listing.zip_code}: ${fmt(pricing.zori_current!)}. Comp median diverged >20% - blended to ${fmt(pricing.blended_base)}`
        : `Zillow ZORI for ZIP ${listing.zip_code}: ${pricing.zori_current ? fmt(pricing.zori_current) : "N/A"}. ${pricing.zori_current ? "Within 20% - validated" : "Not available - skipped"}`,
    },
    {
      label: "Amenity adjustment",
      text: `${pricing.amenity_adjustments.map((a) => `${a.name} ${a.value > 0 ? "+" : ""}${(a.value * 100).toFixed(0)}%`).join(", ") || "None applied"}. Multiplier: ${pricing.amenity_multiplier.toFixed(2)}x`,
    },
    {
      label: "Seasonal adjustment",
      text: `Factor: ${pricing.seasonal_factor.toFixed(2)}x. ${pricing.seasonal_label}. Fair price = ${fmt(pricing.fair_price)}. Range: ${fmt(pricing.fair_range_low)} - ${fmt(pricing.fair_range_high)}`,
    },
  ];

  return (
    <div className="bg-white border border-[#e8e6e1] rounded-2xl p-6 sm:p-8">
      <p className="text-[11px] font-semibold tracking-[2px] uppercase text-gray-300 mb-5">
        Fair Market Price
      </p>

      {pricing.fallback_triggered && (
        <div className="flex items-center gap-2 text-amber-600 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          <AlertTriangle size={14} />
          We found only {pricing.comp_count} comparable listings. Results are directional.
        </div>
      )}

      {chartData.length > 1 && (
        <div className="mb-6">
          <ResponsiveContainer width="100%" height={chartData.length * 28 + 20}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 60 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#999" }} width={75} />
              <ReferenceLine x={pricing.fair_price} stroke="#27763d" strokeDasharray="4 3" />
              <Bar dataKey="price" radius={[0, 3, 3, 0]} barSize={16}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.isCurrent ? "#c0392b" : "#e8e6e1"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "25th pctl", value: fmt(p25) },
          { label: "Comp median", value: fmt(p50) },
          { label: "75th pctl", value: fmt(p75) },
          { label: "This listing", value: fmt(listing.asking_price), highlight: true },
        ].map((s) => (
          <div
            key={s.label}
            className={`text-center py-3 px-2 rounded-lg ${s.highlight ? "bg-red-50" : "bg-[#f7f7f5]"}`}
          >
            <div className={`text-xl font-bold ${s.highlight ? "text-red-700" : "text-[#0b0b0b]"}`}>
              {s.value}
            </div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
      >
        How we calculated this {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {expanded && (
        <div className="mt-4 bg-[#f7f7f5] rounded-lg p-5">
          <p className="text-[11px] font-semibold tracking-[1.5px] uppercase text-gray-300 mb-4">
            Calculation Steps
          </p>
          {steps.map((step, i) => (
            <div key={i} className="flex gap-3 mb-3 last:mb-0">
              <div className="w-6 h-6 rounded-lg bg-[#e8e6e1] flex items-center justify-center text-[11px] font-bold text-gray-500 flex-shrink-0">
                {i + 1}
              </div>
              <p className="text-[13px] text-gray-500 leading-relaxed">
                <strong className="text-gray-800">{step.label}</strong> — {step.text}
              </p>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-gray-300 mt-4">
        Based on StreetEasy active listings + Zillow ZORI
      </p>
    </div>
  );
}
