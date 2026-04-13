"use client";

import { motion } from "framer-motion";
import type { ComparableBuilding } from "./types";
import { Building2, ShieldCheck, ChevronRight, Star, DollarSign } from "lucide-react";
import { AMENITY_MULTIPLIERS } from "@/lib/fair-rent/constants";

function scoreColor(score: number): string {
  if (score >= 8) return "#2563eb";
  if (score >= 6) return "#3b82f6";
  if (score >= 4) return "#fbbf24";
  return "#ef4444";
}

function amenityPremium(amenities: string[]): number {
  const amenityMap: Record<string, string> = {
    "Doorman": "doorman", "Elevator": "elevator", "Gym": "gym", "Fitness Center": "gym",
    "Parking": "parking", "Garage": "parking", "Washer/Dryer": "in_unit_laundry", "In-Unit Laundry": "in_unit_laundry",
    "Roof Deck": "private_outdoor_space", "Outdoor Space": "private_outdoor_space", "Balcony": "private_outdoor_space", "Terrace": "private_outdoor_space",
  };
  const seen = new Set<string>();
  let total = 0;
  for (const a of amenities) {
    const key = amenityMap[a];
    if (key && !seen.has(key) && AMENITY_MULTIPLIERS[key]) {
      seen.add(key);
      total += AMENITY_MULTIPLIERS[key];
    }
  }
  return Math.min(total, 0.20);
}

export function ComparablesCard({ comparables, currentZip }: { comparables: ComparableBuilding[]; currentZip: string }) {
  if (comparables.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-6 sm:px-8 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[2px] uppercase text-gray-400">Better Options Nearby</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Higher-rated buildings in {currentZip}</p>
        </div>
        <Building2 size={16} className="text-gray-300" />
      </div>

      <div className="divide-y divide-gray-100">
        {comparables.map((b, i) => {
          const score = parseFloat(b.overall_score);
          const premium = amenityPremium(b.amenities);
          const href = `/nyc/building/${encodeURIComponent(b.borough.toLowerCase())}/${b.slug}`;

          return (
            <motion.a key={b.slug} href={href}
              className="flex items-center gap-4 px-6 sm:px-8 py-4 hover:bg-gray-50 transition-colors group"
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 + 0.3, duration: 0.35 }}>

              <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400 flex-shrink-0">{i + 1}</div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-700 truncate group-hover:text-blue-600 transition-colors">
                  {b.full_address.split(",")[0]}
                </p>
                <div className="flex items-center gap-3 mt-1 text-[9px] text-gray-400">
                  {b.total_units != null && <span>{b.total_units} units</span>}
                  {b.year_built != null && <span>{b.year_built}</span>}
                  <span>{b.violation_count} viol.</span>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                {b.median_rent != null && (
                  <span className="flex items-center gap-1 text-[9px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                    <DollarSign size={9} />${b.median_rent.toLocaleString()}
                  </span>
                )}
                {premium > 0 && (
                  <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                    +{(premium * 100).toFixed(0)}% amenity
                  </span>
                )}
                {b.is_rent_stabilized && (
                  <span className="flex items-center gap-1 text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                    <ShieldCheck size={9} />RS
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <Star size={11} style={{ color: scoreColor(score) }} fill="currentColor" />
                <span className="text-sm font-bold" style={{ color: scoreColor(score) }}>{score.toFixed(1)}</span>
              </div>

              <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
            </motion.a>
          );
        })}
      </div>

      <div className="px-6 sm:px-8 py-3 border-t border-gray-100 bg-gray-50">
        <p className="text-[8px] text-gray-400 text-center">
          Scores from Lucid Rents · Amenity premiums from Furman Center / NMHC research
        </p>
      </div>
    </div>
  );
}
