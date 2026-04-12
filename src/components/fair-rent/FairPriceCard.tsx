"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { PricingResult, ListingData } from "./types";
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";

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

  // Price range bar visualization
  const rangeMin = Math.min(pricing.fair_range_low, listing.asking_price) * 0.9;
  const rangeMax = Math.max(pricing.fair_range_high, listing.asking_price) * 1.1;
  const span = rangeMax - rangeMin;
  const fairLowPct = ((pricing.fair_range_low - rangeMin) / span) * 100;
  const fairHighPct = ((pricing.fair_range_high - rangeMin) / span) * 100;
  const askingPct = ((listing.asking_price - rangeMin) / span) * 100;
  const fairMidPct = ((pricing.fair_price - rangeMin) / span) * 100;

  const isOverpriced = listing.asking_price > pricing.fair_range_high;
  const isUnderpriced = listing.asking_price < pricing.fair_range_low;

  const steps = [
    {
      label: "Comp pool",
      detail: pricing.comp_count > 0
        ? `${pricing.comp_count} active listings, same beds, sqft +/-25%, within 0.5mi. Median = ${fmt(pricing.base_price)}`
        : `No direct comps found. Using Zillow ZORI as base price = ${fmt(pricing.base_price)}`,
    },
    {
      label: "ZORI validation",
      detail: pricing.zori_blend_triggered
        ? `ZORI for ${listing.zip_code}: ${fmt(pricing.zori_current!)}. Diverged >20% — blended to ${fmt(pricing.blended_base)}`
        : `ZORI for ${listing.zip_code}: ${pricing.zori_current ? fmt(pricing.zori_current) : "N/A"}. ${pricing.zori_current ? "Within range — validated" : "Skipped"}`,
    },
    {
      label: "Amenity adj.",
      detail: `${pricing.amenity_adjustments.map((a) => `${a.name} ${a.value > 0 ? "+" : ""}${(a.value * 100).toFixed(0)}%`).join(", ") || "None"}. Multiplier: ${pricing.amenity_multiplier.toFixed(2)}x`,
    },
    {
      label: "Seasonal factor",
      detail: `${pricing.seasonal_factor.toFixed(2)}x — ${pricing.seasonal_label}`,
    },
  ];

  return (
    <div className="bg-white border border-[#e8e6e1] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-[#0F1D2E] px-6 sm:px-8 py-5 flex items-center justify-between">
        <p className="text-[11px] font-semibold tracking-[2px] uppercase text-white/50">
          Fair Market Price
        </p>
        {pricing.fallback_triggered && (
          <div className="flex items-center gap-1.5 text-amber-300 text-[10px] font-medium">
            <AlertTriangle size={12} />
            {pricing.comp_count} comps — directional
          </div>
        )}
      </div>

      <div className="px-6 sm:px-8 py-6">
        {/* Big numbers row */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Fair Range</p>
            <p className="text-2xl sm:text-3xl font-bold text-[#0b0b0b] tracking-tight">
              {fmt(pricing.fair_range_low)} — {fmt(pricing.fair_range_high)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Asking</p>
            <p className={`text-2xl sm:text-3xl font-bold tracking-tight ${isOverpriced ? "text-red-600" : isUnderpriced ? "text-emerald-600" : "text-gray-700"}`}>
              {fmt(listing.asking_price)}
            </p>
          </div>
        </div>

        {/* Visual range bar */}
        <div className="relative mb-8">
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden relative">
            {/* Fair zone (green gradient) */}
            <motion.div
              className="absolute top-0 h-full rounded-full"
              style={{
                left: `${fairLowPct}%`,
                background: "linear-gradient(90deg, #bbf7d0, #86efac, #bbf7d0)",
              }}
              initial={{ width: 0 }}
              animate={{ width: `${fairHighPct - fairLowPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            />
          </div>

          {/* Fair price marker */}
          <motion.div
            className="absolute top-0"
            style={{ left: `${fairMidPct}%` }}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="w-0.5 h-3 bg-emerald-600 mx-auto" />
            <p className="text-[9px] text-emerald-600 font-semibold mt-1 -translate-x-1/2 whitespace-nowrap">
              Fair {fmt(pricing.fair_price)}
            </p>
          </motion.div>

          {/* Asking price marker */}
          <motion.div
            className="absolute -top-1"
            style={{ left: `${askingPct}%` }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.8 }}
          >
            <div className={`w-5 h-5 rounded-full border-[3px] border-white shadow-lg -translate-x-1/2 ${isOverpriced ? "bg-red-500" : isUnderpriced ? "bg-emerald-500" : "bg-gray-500"}`} />
            <p className={`text-[9px] font-bold mt-1.5 -translate-x-1/2 whitespace-nowrap ${isOverpriced ? "text-red-600" : isUnderpriced ? "text-emerald-600" : "text-gray-600"}`}>
              Asking {fmt(listing.asking_price)}
            </p>
          </motion.div>
        </div>

        {/* Stats grid */}
        {pricing.comp_prices.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mb-6">
            {[
              { label: "25th", value: fmt(p25), icon: TrendingDown, color: "text-emerald-600" },
              { label: "Median", value: fmt(p50), icon: Minus, color: "text-gray-700" },
              { label: "75th", value: fmt(p75), icon: TrendingUp, color: "text-amber-600" },
              { label: "This unit", value: fmt(listing.asking_price), icon: isOverpriced ? TrendingUp : TrendingDown, color: isOverpriced ? "text-red-600" : "text-emerald-600", highlight: true },
            ].map((s) => (
              <div
                key={s.label}
                className={`text-center py-3 rounded-xl ${s.highlight ? "bg-gray-900 text-white" : "bg-[#f5f4f1]"}`}
              >
                <s.icon size={12} className={`mx-auto mb-1 ${s.highlight ? "text-white/60" : s.color}`} />
                <div className={`text-base font-bold ${s.highlight ? "text-white" : "text-[#0b0b0b]"}`}>
                  {s.value}
                </div>
                <div className={`text-[9px] uppercase tracking-wide mt-0.5 ${s.highlight ? "text-white/50" : "text-gray-400"}`}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Expandable methodology */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer w-full"
        >
          <span className="h-px flex-1 bg-gray-100" />
          How we calculated this {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          <span className="h-px flex-1 bg-gray-100" />
        </button>

        {expanded && (
          <motion.div
            className="mt-4 space-y-3"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
          >
            {steps.map((step, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-[#0F1D2E] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700">{step.label}</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{step.detail}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
