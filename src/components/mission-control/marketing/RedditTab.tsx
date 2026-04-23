"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, MessageSquare, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { MarketingRedditThread, MarketingRedditStatus } from "@/types/marketing";

type RedditFilter = "draft_ready" | "approved" | "replied" | "skipped" | "all";

type CountsByStatus = Partial<Record<RedditFilter, number>>;

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const REDDIT_FILTERS: { key: RedditFilter; label: string }[] = [
  { key: "draft_ready", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "replied", label: "Posted" },
  { key: "skipped", label: "Denied" },
  { key: "all", label: "All" },
];

export function RedditTab() {
  const [threads, setThreads] = useState<MarketingRedditThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RedditFilter>("draft_ready");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editedReplies, setEditedReplies] = useState<Record<string, string>>({});
  const [counts, setCounts] = useState<CountsByStatus>({});

  const fetchThreads = useCallback(async () => {
    try {
      const params = filter !== "all" ? `?status=${filter}` : "";
      const res = await fetch(`/api/marketing/reddit${params}`);
      const data = await res.json();
      setThreads(data.threads ?? []);
      // Initialize edited replies
      const replies: Record<string, string> = {};
      for (const t of data.threads ?? []) {
        if (t.draft_reply) replies[t.id] = t.draft_reply;
      }
      setEditedReplies((prev) => ({ ...replies, ...prev }));
    } catch (err) {
      console.error("Failed to fetch Reddit threads:", err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch(`/api/marketing/reddit/counts`);
      const data = await res.json();
      if (data?.byStatus) {
        setCounts({ ...data.byStatus, all: data.total });
      }
    } catch (err) {
      console.error("Failed to fetch Reddit counts:", err);
    }
  }, []);

  useEffect(() => {
    fetchThreads();
    fetchCounts();
    const interval = setInterval(() => {
      fetchThreads();
      fetchCounts();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchThreads, fetchCounts]);

  async function handleAction(threadId: string, action: "approve" | "skip") {
    setActionLoading(threadId);
    try {
      await fetch("/api/marketing/approve-reddit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          action,
          ...(action === "approve"
            ? { editedReply: editedReplies[threadId] }
            : {}),
        }),
      });
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
    } catch (err) {
      console.error("Reddit action failed:", err);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[#64748b]">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Loading Reddit threads...
      </div>
    );
  }

  const isReadOnly = filter !== "draft_ready";

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {REDDIT_FILTERS.map(({ key, label }) => {
            const count = counts[key];
            return (
              <button
                key={key}
                onClick={() => { setFilter(key); setLoading(true); }}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  filter === key
                    ? "bg-[#0F1D2E] text-white"
                    : "bg-gray-100 text-[#64748b] hover:bg-gray-200"
                }`}
              >
                {label}
                {typeof count === "number" && (
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] tabular-nums ${
                      filter === key
                        ? "bg-white/20 text-white"
                        : "bg-gray-200 text-[#64748b]"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setLoading(true);
            fetchThreads();
          }}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Approved tab — explain the auto-post cadence */}
      {filter === "approved" && threads.length > 0 && (
        <div className="rounded-lg border border-[#f59e0b]/30 bg-[#fffbeb] px-3 py-2 text-xs text-[#92400e]">
          <strong>{threads.length}</strong> approved repl{threads.length === 1 ? "y" : "ies"} queued.
          A scheduled task posts one every 30 min (respecting 5/day + 15-min gap) via your logged-in Chrome.
        </div>
      )}

      {threads.length === 0 && !loading && (
        <Card>
          <CardContent className="py-16 text-center">
            <MessageSquare className="h-10 w-10 mx-auto text-[#e2e8f0] mb-3" />
            <p className="text-[#64748b]">
              {filter === "draft_ready"
                ? "No Reddit threads awaiting review"
                : filter === "approved"
                  ? "No approved replies waiting to post"
                  : filter === "replied"
                    ? "No posted replies yet"
                    : filter === "skipped"
                      ? "No denied drafts"
                      : "No threads"}
            </p>
          </CardContent>
        </Card>
      )}

      {threads.map((thread) => (
        <Card key={thread.id}>
          <CardContent className="space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="info">r/{thread.subreddit}</Badge>
                  {thread.relevance_score != null && (
                    <span className="text-xs text-[#64748b]">
                      Score: {thread.relevance_score}
                    </span>
                  )}
                  <span className="text-xs text-[#64748b]">
                    {formatRelativeTime(thread.created_at)}
                  </span>
                </div>
                {thread.title && (
                  <>
                    {thread.url ? (
                      <a
                        href={thread.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-center gap-1 text-sm font-medium text-[#0F1D2E] hover:text-[#3B82F6]"
                      >
                        <span className="truncate">{thread.title}</span>
                        <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-[#64748b] group-hover:text-[#3B82F6]" />
                      </a>
                    ) : (
                      <h3 className="text-sm font-medium text-[#0F1D2E] truncate">
                        {thread.title}
                      </h3>
                    )}
                    {thread.url && (
                      <a
                        href={thread.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block mt-0.5 text-[11px] text-[#64748b] hover:text-[#3B82F6] truncate font-mono"
                        title={thread.url}
                      >
                        {thread.url.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Keywords */}
            {thread.keywords_matched && thread.keywords_matched.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {thread.keywords_matched.map((kw) => (
                  <span
                    key={kw}
                    className="px-2 py-0.5 bg-gray-100 text-[#64748b] text-xs rounded"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}

            {/* Reply */}
            {isReadOnly ? (
              <div className="rounded-lg bg-gray-50 border border-[#e2e8f0] px-3 py-2 text-sm text-[#0F1D2E] whitespace-pre-wrap">
                {thread.draft_reply ?? "No reply"}
              </div>
            ) : (
              <textarea
                value={editedReplies[thread.id] ?? thread.draft_reply ?? ""}
                onChange={(e) =>
                  setEditedReplies((prev) => ({
                    ...prev,
                    [thread.id]: e.target.value,
                  }))
                }
                rows={4}
                className="w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0F1D2E] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-y"
              />
            )}

            {/* Actions — only on pending tab */}
            {!isReadOnly && (
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction(thread.id, "skip")}
                  loading={actionLoading === thread.id}
                >
                  Skip
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleAction(thread.id, "approve")}
                  loading={actionLoading === thread.id}
                >
                  Approve
                </Button>
              </div>
            )}

            {/* Status + timestamp for non-pending */}
            {isReadOnly && thread.replied_at && (
              <p className="text-xs text-[#64748b]">
                Replied {formatRelativeTime(thread.replied_at)}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
