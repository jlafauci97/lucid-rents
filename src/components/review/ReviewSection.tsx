"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PenSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { MonitorButton } from "@/components/building/MonitorButton";
import { ReviewCard } from "@/components/review/ReviewCard";
import { ReviewDistribution } from "@/components/review/ReviewDistribution";
import { T } from "@/lib/design-tokens";
import type { ReviewWithDetails } from "@/types";
import type { ReactNode } from "react";

type SortOption = "recent" | "highest" | "lowest" | "helpful";

interface ReviewSectionProps {
  reviews: ReviewWithDetails[];
  buildingId: string;
  isMonitored: boolean;
  cityPath: string;
  headerActions?: ReactNode;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Most Recent" },
  { value: "highest", label: "Highest Rated" },
  { value: "lowest", label: "Lowest Rated" },
  { value: "helpful", label: "Most Helpful" },
];

function sortReviews(reviews: ReviewWithDetails[], sort: SortOption): ReviewWithDetails[] {
  const sorted = [...reviews];

  switch (sort) {
    case "recent":
      return sorted.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    case "highest":
      return sorted.sort((a, b) => b.overall_rating - a.overall_rating);
    case "lowest":
      return sorted.sort((a, b) => a.overall_rating - b.overall_rating);
    case "helpful":
      return sorted.sort((a, b) => b.helpful_count - a.helpful_count);
    default:
      return sorted;
  }
}

export function ReviewSection({
  reviews,
  buildingId,
  isMonitored,
  cityPath,
  headerActions,
}: ReviewSectionProps) {
  const [sort, setSort] = useState<SortOption>("recent");

  const sortedReviews = useMemo(() => sortReviews(reviews, sort), [reviews, sort]);

  return (
    <section id="reviews" className="scroll-mt-28">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-bold" style={{ color: T.text1 }}>
          Tenant Reviews ({reviews.length})
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {headerActions}
          <MonitorButton buildingId={buildingId} initialMonitored={isMonitored} />
          <Link href={`${cityPath}/review/new?building=${buildingId}`}>
            <Button size="sm" className="whitespace-nowrap">
              <PenSquare className="w-4 h-4 mr-2" />
              Write Review
            </Button>
          </Link>
        </div>
      </div>

      {reviews.length > 0 ? (
        <>
          <ReviewDistribution reviews={reviews} />

          {reviews.length > 1 && (
            <div className="flex items-center justify-end mb-4">
              <label htmlFor="review-sort" className="sr-only">
                Sort reviews
              </label>
              <select
                id="review-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2"
                style={{ border: `1px solid ${T.border}`, color: T.text1, backgroundColor: T.surface, boxShadow: `0 0 0 0px ${T.accent}` }}
                onFocus={(e) => { e.currentTarget.style.boxShadow = `0 0 0 2px ${T.accent}`; }}
                onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-4">
            {sortedReviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        </>
      ) : (
        <Card>
          <CardContent>
            <p className="text-center py-8" style={{ color: T.text2 }}>
              No reviews yet. Be the first to review this building!
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
