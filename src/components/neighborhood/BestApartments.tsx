"use client";

import { useState } from "react";
import Link from "next/link";
import { DollarSign } from "lucide-react";

interface ApartmentEntry {
  id: string;
  full_address: string;
  borough: string;
  slug: string;
  overall_score: number | null;
  median_rent: number;
  buildingUrl: string;
}

interface BestApartmentsProps {
  tiers: {
    label: string;
    max: number;
    buildings: ApartmentEntry[];
  }[];
  areaName: string;
}

export function BestApartments({ tiers, areaName }: BestApartmentsProps) {
  const [activeTier, setActiveTier] = useState(0);

  const current = tiers[activeTier];

  if (tiers.every((t) => t.buildings.length === 0)) return null;

  return (
    <section className="bg-white border border-[#e2e8f0] rounded-xl p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-5 h-5 text-[#3B82F6]" />
        <h2 className="text-lg font-bold text-[#0F1D2E]">
          Best Apartments in {areaName}
        </h2>
      </div>
      <p className="text-sm text-[#64748b] mb-4">
        Top-rated buildings by price tier, ranked by building score.
      </p>

      {/* Tier tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {tiers.map((tier, i) => (
          <button
            key={tier.label}
            onClick={() => setActiveTier(i)}
            className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
              activeTier === i
                ? "bg-[#0F1D2E] text-white"
                : "bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]"
            }`}
          >
            Under {tier.label} ({tier.buildings.length})
          </button>
        ))}
      </div>

      {current.buildings.length === 0 ? (
        <p className="text-sm text-[#94a3b8] text-center py-6">
          No rental data available for this price range in {areaName}.
        </p>
      ) : (
        <div className="space-y-2">
          {current.buildings.map((b, rank) => (
            <Link
              key={b.id}
              href={b.buildingUrl}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#f8fafc] transition-colors group"
            >
              <div className="w-7 h-7 rounded-full bg-[#f1f5f9] flex items-center justify-center text-xs font-bold text-[#64748b] flex-shrink-0">
                {rank + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#0F1D2E] truncate group-hover:text-[#3B82F6] transition-colors">
                  {b.full_address}
                </p>
                <p className="text-xs text-[#94a3b8]">{b.borough}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-[#0F1D2E]">
                  ${b.median_rent.toLocaleString()}/mo
                </p>
                {b.overall_score !== null && (
                  <p className="text-xs text-[#3B82F6]">Score: {b.overall_score.toFixed(1)}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
