"use client";

import { Star } from "lucide-react";

interface ReviewDistributionProps {
  reviews: { overall_rating: number }[];
}

const BAR_COLORS: Record<number, string> = {
  5: "bg-emerald-500",
  4: "bg-lime-500",
  3: "bg-yellow-400",
  2: "bg-orange-400",
  1: "bg-red-500",
};

export function ReviewDistribution({ reviews }: ReviewDistributionProps) {
  if (reviews.length === 0) return null;

  const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let total = 0;

  for (const r of reviews) {
    const rounded = Math.round(r.overall_rating);
    if (rounded >= 1 && rounded <= 5) {
      counts[rounded]++;
      total += r.overall_rating;
    }
  }

  const avg = total / reviews.length;
  const maxCount = Math.max(...Object.values(counts), 1);

  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 mb-4">
      <div className="flex items-center gap-6 mb-5">
        <div className="text-center">
          <div className="text-4xl font-bold text-[#0F1D2E]">
            {avg.toFixed(1)}
          </div>
          <div className="flex items-center justify-center gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-4 h-4 ${
                  star <= Math.round(avg)
                    ? "fill-[#F59E0B] text-[#F59E0B]"
                    : "text-[#e2e8f0]"
                }`}
              />
            ))}
          </div>
          <div className="text-xs text-[#94a3b8] mt-1">
            {reviews.length} review{reviews.length !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="flex-1 space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = counts[star];
            const pct = (count / maxCount) * 100;

            return (
              <div key={star} className="flex items-center gap-2 text-sm">
                <span className="w-12 text-right text-[#64748b] whitespace-nowrap">
                  {star} star{star !== 1 ? "s" : ""}
                </span>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${BAR_COLORS[star]} transition-all duration-300`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-6 text-right text-xs text-[#94a3b8] tabular-nums">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
