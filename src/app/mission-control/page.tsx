import { MCHeader } from "@/components/mission-control/MCHeader";
import { HubStatsClient } from "@/components/mission-control/HubStatsClient";
import { RecentActivityFeed } from "@/components/mission-control/RecentActivityFeed";
import { RecentReviewsFeed } from "@/components/mission-control/RecentReviewsFeed";
import { getHubStats } from "@/lib/mission-control/stats";
import { fetchSyncsOk } from "@/lib/mission-control/syncs-health";
import { listRecentSignups } from "@/lib/mission-control/users";
import { listRecentReviews } from "@/lib/mission-control/reviews";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MissionControlHub() {
  const [stats, syncsOk, signups, recentReviews] = await Promise.all([
    getHubStats(),
    fetchSyncsOk(),
    listRecentSignups(10),
    listRecentReviews({ status: "all", limit: 10 }),
  ]);

  return (
    <>
      <MCHeader title="Mission Control" subtitle="Operator dashboard for lucidrents.com" />
      <main className="flex-1 overflow-y-auto p-8">
        <HubStatsClient initial={stats} initialSyncsOk={syncsOk} />

        <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-5">
          <RecentActivityFeed signups={signups} />
          <RecentReviewsFeed reviews={recentReviews} />
        </div>
      </main>
    </>
  );
}
