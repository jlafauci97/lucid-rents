"use client";

/**
 * Client-side wrapper for paginated building reviews. Reads the `page` query
 * param via useSearchParams() and fetches from /api/buildings/[id]/reviews
 * (edge runtime, CDN-cached). By keeping the searchParams read off the server
 * tree, the parent page can be statically prerendered per (city, borough,
 * slug) — eligible for on-demand ISR.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { ReviewSection } from "@/components/review/ReviewSection";
import { SaveButton } from "@/components/building/SaveButton";
import { ShareButton } from "@/components/building/ShareButton";
import { canonicalUrl } from "@/lib/seo";
import type { City } from "@/lib/cities";
import type { ReviewWithDetails } from "@/types";

const PAGE_SIZE = 10;

interface Props {
  buildingId: string;
  city: City;
  shortAddress: string;
  reviewsBase: string;
  totalReviewsFallback: number;
}

interface ApiResponse {
  reviews: ReviewWithDetails[];
  total: number;
  page: number;
}

export function ReviewsClient({
  buildingId,
  city,
  shortAddress,
  reviewsBase,
  totalReviewsFallback,
}: Props) {
  const sp = useSearchParams();
  const currentPage = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const offset = (currentPage - 1) * PAGE_SIZE;

  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const myId = ++reqIdRef.current;
    setIsLoading(true);
    fetch(`/api/buildings/${buildingId}/reviews?page=${currentPage}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((json: ApiResponse) => {
        if (myId !== reqIdRef.current) return;
        setData(json);
        setIsLoading(false);
      })
      .catch(() => {
        if (myId !== reqIdRef.current) return;
        setIsLoading(false);
      });
  }, [buildingId, currentPage]);

  const reviews = data?.reviews ?? [];
  const totalReviews = data?.total ?? totalReviewsFallback;
  const totalPages = Math.max(1, Math.ceil(totalReviews / PAGE_SIZE));

  return (
    <>
      <p className="text-sm text-[#64748B] mb-8">
        {isLoading && !data
          ? "Loading reviews…"
          : reviews.length > 0
            ? (
              <>
                Showing {offset + 1}&ndash;
                {Math.min(offset + PAGE_SIZE, totalReviews)} of{" "}
                {totalReviews.toLocaleString()} review
                {totalReviews !== 1 ? "s" : ""}
                {currentPage > 1 && ` · Page ${currentPage}`}
              </>
            )
            : "No reviews yet."}
      </p>

      <div style={{ opacity: isLoading ? 0.6 : 1, transition: "opacity 150ms" }}>
        <ReviewSection
          reviews={reviews}
          buildingId={buildingId}
          cityPath={`/${city}`}
          headerActions={
            <>
              <SaveButton buildingId={buildingId} />
              <ShareButton address={shortAddress} url={canonicalUrl(reviewsBase)} />
            </>
          }
        />
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#e2e8f0]">
          <span className="text-xs text-[#64748b]">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            {currentPage > 1 ? (
              <Link
                href={`${reviewsBase}?page=${currentPage - 1}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#e2e8f0] text-[#334155] hover:bg-[#f8fafc] transition-colors"
              >
                <ChevronLeft className="w-3 h-3" /> Previous
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#e2e8f0] text-[#334155] opacity-40 cursor-not-allowed">
                <ChevronLeft className="w-3 h-3" /> Previous
              </span>
            )}
            {currentPage < totalPages ? (
              <Link
                href={`${reviewsBase}?page=${currentPage + 1}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#3B82F6] bg-[#3B82F6] text-white hover:bg-[#2563EB] transition-colors"
              >
                Next <ChevronRight className="w-3 h-3" />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#e2e8f0] text-[#334155] opacity-40 cursor-not-allowed">
                Next <ChevronRight className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
