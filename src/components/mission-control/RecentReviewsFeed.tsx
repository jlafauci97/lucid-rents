import Link from "next/link";
import type { MCReview } from "@/lib/mission-control/reviews";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function RecentReviewsFeed({ reviews }: { reviews: MCReview[] }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-[#0F1D2E] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Recent reviews
        </h3>
        <Link href="/mission-control/reviews" className="text-xs text-[#3B82F6] hover:underline">
          View all
        </Link>
      </div>
      <ul className="space-y-3">
        {reviews.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <div className="truncate text-slate-200">
                {r.reviewer_email || r.reviewer_name || "(scraped)"}
              </div>
              <div className="truncate text-xs text-slate-500">
                {r.building_address ?? r.building_id}
                {r.overall_rating != null && ` · ${r.overall_rating}★`}
              </div>
            </div>
            <span className="shrink-0 text-xs text-slate-500">{timeAgo(r.created_at)}</span>
          </li>
        ))}
        {reviews.length === 0 && (
          <li className="text-sm text-slate-500">No recent reviews.</li>
        )}
      </ul>
    </div>
  );
}
