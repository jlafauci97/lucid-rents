"use client";
import { useEffect, useState } from "react";
import { HubCard } from "./HubCard";
import type { HubStats } from "@/lib/mission-control/stats";

interface Props {
  initial: HubStats;
  initialSyncsOk: boolean;
}

interface PollPayload extends HubStats {
  syncsOk?: boolean;
}

export function HubStatsClient({ initial, initialSyncsOk }: Props) {
  const [stats, setStats] = useState<HubStats>(initial);
  const [syncsOk, setSyncsOk] = useState(initialSyncsOk);

  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const res = await fetch("/api/mission-control/stats", { cache: "no-store" });
        if (!res.ok) return;
        const body: PollPayload = await res.json();
        setStats(body);
        if (typeof body.syncsOk === "boolean") setSyncsOk(body.syncsOk);
      } catch {
        // transient — will retry next tick
      }
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const pending = stats.newsDraftsPending + stats.reviewsFlagged;
    document.title = pending > 0 ? `(${pending}) Mission Control` : "Mission Control";
    return () => {
      document.title = "Mission Control";
    };
  }, [stats.newsDraftsPending, stats.reviewsFlagged]);

  return (
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
        stat={{
          value: stats.usersTotal,
          label: `total · +${stats.usersNewLast7d} this week`,
        }}
        tone="neutral"
      />
      <HubCard
        title="Reviews"
        description="Moderate user-generated reviews."
        href="/mission-control/reviews"
        stat={{
          value: stats.reviewsLast24h,
          label:
            stats.reviewsFlagged > 0
              ? `new · ${stats.reviewsFlagged} flagged`
              : "new in 24h",
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
  );
}
