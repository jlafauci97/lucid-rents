import { MCHeader } from "@/components/mission-control/MCHeader";
import { HubCard } from "@/components/mission-control/HubCard";
import { getHubStats } from "@/lib/mission-control/stats";
import { fetchSyncsOk } from "@/lib/mission-control/syncs-health";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MissionControlHub() {
  const [stats, syncsOk] = await Promise.all([getHubStats(), fetchSyncsOk()]);

  return (
    <>
      <MCHeader title="Mission Control" subtitle="Operator dashboard for lucidrents.com" />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <HubCard
            title="News Drafts"
            description="Approve or reject AI-generated articles."
            href="/mission-control/news-drafts"
            stat={{ value: stats.newsDraftsPending, label: "pending" }}
            tone={stats.newsDraftsPending > 0 ? "primary" : "neutral"}
          />
          <HubCard
            title="Syncs"
            description="Data pipeline health and cron status."
            href="/mission-control/syncs"
            stat={{ value: syncsOk ? "OK" : "FAIL", label: syncsOk ? "healthy" : "needs attention" }}
            tone={syncsOk ? "success" : "warning"}
          />
          <HubCard
            title="Users"
            description="Manage accounts, roles, and access."
            href="/mission-control/users"
            stat={{ value: stats.usersTotal, label: `total · +${stats.usersNewLast7d} this week` }}
            tone="neutral"
          />
          <HubCard
            title="Reviews"
            description="Moderate user-generated reviews."
            href="/mission-control/reviews"
            stat={{
              value: stats.reviewsLast24h,
              label: stats.reviewsFlagged > 0 ? `new · ${stats.reviewsFlagged} flagged` : "new in 24h",
            }}
            tone={stats.reviewsFlagged > 0 ? "warning" : "neutral"}
          />
          <HubCard
            title="Marketing"
            description="Content pipeline, Reddit, analytics."
            href="/mission-control/marketing"
            stat={{ value: stats.marketingDraftsPending, label: "drafts in queue" }}
            tone="neutral"
          />
        </div>
      </main>
    </>
  );
}
