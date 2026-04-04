"use client";

import Link from "next/link";
import { MapPin, TrendingDown, TrendingUp, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/affordability";

export interface NeighborhoodMatch {
  zipCode: string;
  neighborhood: string;
  region: string;
  medianRent: number;
  source: string;
}

interface NeighborhoodMatchCardProps {
  match: NeighborhoodMatch;
  recommendedMax: number;
  /** URL to the neighborhood page */
  href: string;
}

export function NeighborhoodMatchCard({
  match,
  recommendedMax,
  href,
}: NeighborhoodMatchCardProps) {
  const diff = recommendedMax - match.medianRent;
  const isAffordable = diff >= 0;
  const diffPercent =
    recommendedMax > 0
      ? Math.round(Math.abs(diff) / recommendedMax * 100)
      : 0;

  // Fit bar: green = well under, yellow = tight (<10% margin), red = over
  const fitColor = !isAffordable
    ? "#ef4444"
    : diff / recommendedMax > 0.1
    ? "#10b981"
    : "#f59e0b";

  const fitWidth = isAffordable
    ? Math.max(10, Math.round((match.medianRent / recommendedMax) * 100))
    : 100;

  return (
    <div
      className={`bg-white rounded-xl border p-4 transition-all hover:shadow-md ${
        isAffordable
          ? "border-[#e2e8f0] hover:border-[#cbd5e1]"
          : "border-[#e2e8f0] opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#3B82F6] flex-shrink-0" />
            <h4 className="text-sm font-semibold text-[#0F1D2E] truncate">
              {match.neighborhood}
            </h4>
          </div>
          <p className="text-xs text-[#94a3b8] mt-0.5">
            {match.region} · {match.zipCode}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-[#0F1D2E]">
            {formatCurrency(match.medianRent)}
          </p>
          <p className="text-[10px] text-[#94a3b8]">median rent</p>
        </div>
      </div>

      {/* Fit bar */}
      <div className="mb-3">
        <div className="w-full h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${fitWidth}%`,
              backgroundColor: fitColor,
            }}
          />
        </div>
      </div>

      {/* Diff badge + explore link */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {isAffordable ? (
            <TrendingDown className="w-3.5 h-3.5 text-[#10b981]" />
          ) : (
            <TrendingUp className="w-3.5 h-3.5 text-[#ef4444]" />
          )}
          <span
            className={`text-xs font-medium ${
              isAffordable ? "text-[#10b981]" : "text-[#ef4444]"
            }`}
          >
            {formatCurrency(Math.abs(diff))}{" "}
            {isAffordable ? "under budget" : "over budget"}
            {diffPercent > 0 && ` (${diffPercent}%)`}
          </span>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#3B82F6] hover:text-[#2563EB] transition-colors"
        >
          Explore
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
