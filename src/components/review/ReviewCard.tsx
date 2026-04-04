import { StarRating } from "@/components/ui/StarRating";
import { Badge } from "@/components/ui/Badge";
import { ThumbsUp, ThumbsDown, User } from "lucide-react";
import { formatRelativeDate } from "@/lib/utils";
import { T } from "@/lib/design-tokens";
import type { ReviewWithDetails } from "@/types";

interface ReviewCardProps {
  review: ReviewWithDetails;
}

export function ReviewCard({ review }: ReviewCardProps) {
  const wouldRecommend = (review.overall_rating ?? 0) >= 3;

  return (
    <div className="rounded-2xl border p-6 shadow-sm" style={{ backgroundColor: T.surface, borderColor: T.border }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium" style={{ backgroundColor: T.text1 }}>
            {review.reviewer_display_preference === "anonymous"
              ? <User className="w-5 h-5" />
              : (review.reviewer_name || review.profile?.display_name)?.[0]?.toUpperCase() || <User className="w-5 h-5" />}
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: T.text1 }}>
              {review.reviewer_display_preference === "anonymous"
                ? "Anonymous"
                : review.reviewer_name || review.profile?.display_name || "Anonymous"}
            </p>
            <p className="text-xs" style={{ color: T.text3 }}>
              {formatRelativeDate(review.created_at)}
              {review.unit && ` · Unit ${review.unit.unit_number}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StarRating value={review.overall_rating} readonly size="sm" />
        </div>
      </div>

      {/* Would recommend badge */}
      <div className="mt-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" style={{
          backgroundColor: wouldRecommend ? `${T.sage}12` : `${T.danger}12`,
          color: wouldRecommend ? T.sage : T.danger,
        }}>
          {wouldRecommend
            ? <><ThumbsUp className="w-3 h-3" /> Would recommend</>
            : <><ThumbsDown className="w-3 h-3" /> Would not recommend</>}
        </span>
      </div>

      {review.title && (
        <h4 className="text-base font-semibold mt-3" style={{ color: T.text1 }}>
          {review.title}
        </h4>
      )}

      {review.body && (
        <p className="text-sm mt-2 leading-relaxed" style={{ color: T.text2 }}>
          {review.body}
        </p>
      )}

      {((review.pro_tags && review.pro_tags.length > 0) || (review.con_tags && review.con_tags.length > 0)) && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {review.pro_tags?.map((tag) => (
            <span
              key={`pro-${tag}`}
              className="px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: `${T.sage}10`, color: T.sage }}
            >
              {tag}
            </span>
          ))}
          {review.con_tags?.map((tag) => (
            <span
              key={`con-${tag}`}
              className="px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: `${T.danger}10`, color: T.danger }}
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
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
              style={{ backgroundColor: T.elevated }}
            >
              <span className="text-xs" style={{ color: T.text2 }}>
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

      <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: `1px solid ${T.border}` }}>
        <div className="flex items-center gap-4 text-xs" style={{ color: T.text3 }}>
          {review.rent_amount && (
            <span>Rent: ${review.rent_amount.toLocaleString()}/mo</span>
          )}
          {review.lease_type && (
            <span>{review.lease_type.replace(/_/g, " ")}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-sm" style={{ color: T.text2 }}>
          <ThumbsUp className="w-4 h-4" />
          <span>{review.helpful_count}</span>
        </div>
      </div>
    </div>
  );
}
