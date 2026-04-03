import { StarRating } from "@/components/ui/StarRating";
import { Badge } from "@/components/ui/Badge";
import { ThumbsUp, User } from "lucide-react";
import { formatRelativeDate } from "@/lib/utils";
import type { ReviewWithDetails } from "@/types";

interface ReviewCardProps {
  review: ReviewWithDetails;
}

export function ReviewCard({ review }: ReviewCardProps) {
  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#0F1D2E] flex items-center justify-center text-white text-sm font-medium">
            {review.reviewer_display_preference === "anonymous"
              ? <User className="w-5 h-5" />
              : (review.reviewer_name || review.profile?.display_name)?.[0]?.toUpperCase() || <User className="w-5 h-5" />}
          </div>
          <div>
            <p className="text-sm font-medium text-[#0F1D2E]">
              {review.reviewer_display_preference === "anonymous"
                ? "Anonymous"
                : review.reviewer_name || review.profile?.display_name || "Anonymous"}
            </p>
            <p className="text-xs text-[#94a3b8]">
              {formatRelativeDate(review.created_at)}
              {review.unit && ` · Unit ${review.unit.unit_number}`}
            </p>
          </div>
        </div>
        <StarRating value={review.overall_rating} readonly size="sm" />
      </div>

      {review.title && (
        <h4 className="text-base font-semibold text-[#0F1D2E] mt-4">
          {review.title}
        </h4>
      )}

      {review.body && (
        <p className="text-sm text-[#64748b] mt-2 leading-relaxed">
          {review.body}
        </p>
      )}

      {((review.pro_tags && review.pro_tags.length > 0) || (review.con_tags && review.con_tags.length > 0)) && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {review.pro_tags?.map((tag) => (
            <span
              key={`pro-${tag}`}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#10b981]/10 text-[#10b981]"
            >
              {tag}
            </span>
          ))}
          {review.con_tags?.map((tag) => (
            <span
              key={`con-${tag}`}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#ef4444]/10 text-[#ef4444]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {review.category_ratings && review.category_ratings.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {review.category_ratings.map((cr) => (
            <div
              key={cr.id}
              className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5"
            >
              <span className="text-xs text-[#64748b]">
                {cr.category?.name}
              </span>
              <StarRating value={cr.rating} readonly size="sm" />
            </div>
          ))}
        </div>
      )}

      {review.category_ratings?.some(
        (cr) => cr.subcategory_flags && cr.subcategory_flags.length > 0
      ) && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {review.category_ratings
            .flatMap((cr) =>
              (cr.subcategory_flags || []).map((flag) => (
                <Badge key={`${cr.id}-${flag}`} variant="warning">
                  {flag.replace(/_/g, " ")}
                </Badge>
              ))
            )}
        </div>
      )}

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#e2e8f0]">
        <div className="flex items-center gap-4 text-xs text-[#94a3b8]">
          {review.rent_amount && (
            <span>Rent: ${review.rent_amount.toLocaleString()}/mo</span>
          )}
          {review.lease_type && (
            <span>{review.lease_type.replace(/_/g, " ")}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-sm text-[#64748b]">
          <ThumbsUp className="w-4 h-4" />
          <span>{review.helpful_count}</span>
        </div>
      </div>
    </div>
  );
}
