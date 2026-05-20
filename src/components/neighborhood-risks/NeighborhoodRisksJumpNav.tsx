"use client";

import type {
  ConcernCategory,
  NeighborhoodRisksResult,
} from "@/lib/neighborhood-risks/types";
import { CATEGORY_COLORS, CATEGORY_ORDER } from "@/lib/neighborhood-risks/colors";

interface NeighborhoodRisksJumpNavProps {
  result: NeighborhoodRisksResult;
}

function countForCategory(
  result: NeighborhoodRisksResult,
  category: ConcernCategory,
): number {
  if (category === "block_level") {
    return (
      result.block_level.rat_failures +
      result.block_level.noise_311 +
      result.block_level.bedbug_history
    );
  }
  const groupSum = result.groups
    .filter((g) => g.category === category)
    .reduce((acc, g) => acc + g.total_count, 0);
  if (category === "public_safety") return groupSum + result.sex_offender_count;
  return groupSum;
}

export function NeighborhoodRisksJumpNav({
  result,
}: NeighborhoodRisksJumpNavProps) {
  const handleClick = (category: ConcernCategory) => {
    const el = document.getElementById(`section-${category}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      aria-label="Category quick-jump"
      className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] px-4 sm:px-6 lg:px-8 py-2.5 flex items-center gap-2 overflow-x-auto"
    >
      <span className="text-[11px] text-[#94a3b8] uppercase tracking-wide font-bold mr-1 whitespace-nowrap">
        Jump to:
      </span>
      {CATEGORY_ORDER.map((category) => {
        const color = CATEGORY_COLORS[category];
        const count = countForCategory(result, category);
        const shortLabel = color.label.split(" ")[0];
        return (
          <button
            key={category}
            type="button"
            onClick={() => handleClick(category)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#E2E8F0] text-sm text-[#475569] font-semibold whitespace-nowrap hover:border-[#cbd5e1] hover:bg-[#F8FAFC] transition-colors"
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: color.hex }}
              aria-hidden="true"
            />
            {shortLabel}
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B] font-bold">
              {count}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
