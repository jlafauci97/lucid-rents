"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cityPath } from "@/lib/seo";
import { useCity } from "@/lib/city-context";

const CHIPS = [
  { label: "Rent Stabilized", param: "rent_stabilized", value: "true" },
  { label: "Grade D or Below", param: "sort", value: "score-asc" },
  { label: "Most Reviewed", param: "sort", value: "reviews-desc" },
  { label: "Most Violations", param: "sort", value: "violations-desc" },
] as const;

export function SearchChips() {
  const router = useRouter();
  const city = useCity();
  const searchParams = useSearchParams();

  function handleChip(param: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    const isActive = params.get(param) === value;

    if (isActive) {
      params.delete(param);
    } else {
      params.set(param, value);
    }
    params.set("page", "1");
    router.push(cityPath(`/search?${params.toString()}`, city));
  }

  return (
    <div className="flex flex-wrap gap-2">
      {CHIPS.map((chip) => {
        const isActive = searchParams.get(chip.param) === chip.value;
        return (
          <button
            key={chip.label}
            onClick={() => handleChip(chip.param, chip.value)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              isActive
                ? "bg-[#EFF6FF] border-[#3B82F6] text-[#3B82F6]"
                : "bg-white border-[#e2e8f0] text-[#64748b] hover:border-[#94a3b8] hover:text-[#0F1D2E]"
            }`}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
