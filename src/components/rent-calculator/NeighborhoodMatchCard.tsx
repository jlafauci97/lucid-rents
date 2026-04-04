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
          ? "border-[#E2E8F0] hover:border-[#E2E8F0]"
          : "border-[#E2E8F0] opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#6366F1] flex-shrink-0" />
            <h4 className="text-sm font-semibold text-[#1A1F36] truncate">
              {match.neighborhood}
            </h4>
          </div>
          <p className="text-xs text-[#A3ACBE] mt-0.5">
            {match.region} · {match.zipCode}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-[#1A1F36]">
            {formatCurrency(match.medianRent)}
          </p>
          <p className="text-[10px] text-[#A3ACBE]">median rent</p>
        </div>
      </div>

      {/* Fit bar */}
      <div className="mb-3">
        <div className="w-full h-2 bg-[#F5F7FA] rounded-full overflow-hidden">
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
          className="inline-flex items-center gap-1 text-xs font-medium text-[#6366F1] hover:text-[#4F46E5] transition-colors"
        >
          Explore
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
