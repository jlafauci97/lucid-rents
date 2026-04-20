import { MCHeader } from "@/components/mission-control/MCHeader";
import { StatTile } from "@/components/mission-control/StatTile";
import { ReviewsTable } from "@/components/mission-control/ReviewsTable";
import { listRecentReviews, type ReviewStatus } from "@/lib/mission-control/reviews";
import { getHubStats } from "@/lib/mission-control/stats";
import { flagReview, removeReview, restoreReview } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Tab "published" is display-equivalent to "published-like" (includes legacy 'approved')
const TABS = ["published", "flagged", "removed", "all"] as const;
type Tab = (typeof TABS)[number];

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : "published";

  const statusFilter: ReviewStatus | "published-like" | "all" =
    activeTab === "published" ? "published-like" : (activeTab as ReviewStatus | "all");

  const [reviews, stats] = await Promise.all([
    listRecentReviews({ status: statusFilter, limit: 100 }),
    getHubStats(),
  ]);

  return (
    <>
      <MCHeader title="Reviews" subtitle="Monitor and moderate user reviews." />
      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <StatTile value={stats.reviewsLast24h} label="new in 24h" />
          <StatTile value={stats.reviewsFlagged} label="flagged" />
          <StatTile value={reviews.length} label="shown" />
        </div>

        <div className="flex gap-2 border-b border-slate-800">
          {TABS.map((t) => (
            <a
              key={t}
              href={`/mission-control/reviews?tab=${t}`}
              className={`px-3 py-2 text-sm capitalize ${
                t === activeTab
                  ? "border-b-2 border-[#3B82F6] text-[#3B82F6]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t}
            </a>
          ))}
        </div>

        <ReviewsTable
          reviews={reviews}
          onFlag={flagReview}
          onRemove={removeReview}
          onRestore={restoreReview}
        />
      </main>
    </>
  );
}
