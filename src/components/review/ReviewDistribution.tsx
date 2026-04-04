"use client";

import { Star } from "lucide-react";
import { T } from "@/lib/design-tokens";

interface ReviewDistributionProps {
  reviews: { overall_rating: number }[];
}

const BAR_COLORS: Record<number, string> = {
  5: T.sage,
  4: T.blue,
  3: T.gold,
  2: T.coral,
  1: T.danger,
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
    <div className="rounded-2xl border p-6 mb-4 shadow-sm" style={{ backgroundColor: T.surface, borderColor: T.border }}>
      <div className="flex items-center gap-6 mb-5">
        <div className="text-center">
          <div className="text-4xl font-bold" style={{ color: T.text1 }}>
            {avg.toFixed(1)}
          </div>
          <div className="flex items-center justify-center gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className="w-4 h-4"
                style={{
                  fill: star <= Math.round(avg) ? T.gold : "none",
                  color: star <= Math.round(avg) ? T.gold : T.border,
                }}
              />
            ))}
          </div>
          <div className="text-xs mt-1" style={{ color: T.text3 }}>
            {reviews.length} review{reviews.length !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="flex-1 space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = counts[star];
            const pct = (count / maxCount) * 100;

            return (
              <div key={star} className="flex items-center gap-2 text-sm">
                <span className="w-12 text-right whitespace-nowrap" style={{ color: T.text2 }}>
                  {star} star{star !== 1 ? "s" : ""}
                </span>
                <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: T.subtle }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, backgroundColor: BAR_COLORS[star] }}
                  />
                </div>
                <span className="w-6 text-right text-xs tabular-nums" style={{ color: T.text3, fontFamily: "var(--font-mono)" }}>
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
