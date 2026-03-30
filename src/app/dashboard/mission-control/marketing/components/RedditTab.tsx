"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, MessageSquare, ExternalLink, Clipboard, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { MarketingRedditThread, MarketingRedditStatus } from "@/types/marketing";

type RedditFilter = "draft_ready" | "approved" | "replied" | "skipped" | "all";

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
  { key: "replied", label: "Replied" },
  { key: "skipped", label: "Skipped" },
  { key: "all", label: "All" },
];

export function RedditTab() {
  const [threads, setThreads] = useState<MarketingRedditThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RedditFilter>("draft_ready");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editedReplies, setEditedReplies] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

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

  useEffect(() => {
    fetchThreads();
    const interval = setInterval(fetchThreads, 30000);
    return () => clearInterval(interval);
  }, [fetchThreads]);

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
          {REDDIT_FILTERS.map(({ key, label }) => (
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
            </button>
          ))}
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

      {threads.length === 0 && !loading && (
        <Card>
          <CardContent className="py-16 text-center">
            <MessageSquare className="h-10 w-10 mx-auto text-[#e2e8f0] mb-3" />
            <p className="text-[#64748b]">
              {filter === "draft_ready"
                ? "No Reddit threads awaiting review"
                : `No ${filter === "all" ? "" : filter} threads`}
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
                  <div className="flex items-center gap-1">
                    <h3 className="text-sm font-medium text-[#0F1D2E] truncate">
                      {thread.title}
                    </h3>
                    {thread.url && (
                      <a
                        href={thread.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-[#64748b] hover:text-[#3B82F6]" />
                      </a>
                    )}
                  </div>
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
                className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-y"
              />
            )}

            {/* Actions — only on pending tab */}
            {!isReadOnly && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {copied === thread.id && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Copied! Paste in Reddit
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
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
                    onClick={async () => {
                      const reply = editedReplies[thread.id] ?? thread.draft_reply ?? "";
                      // Copy reply to clipboard
                      try {
                        await navigator.clipboard.writeText(reply);
                        setCopied(thread.id);
                        setTimeout(() => setCopied(null), 5000);
                      } catch {
                        // Fallback for clipboard API failure
                        const textarea = document.createElement("textarea");
                        textarea.value = reply;
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand("copy");
                        document.body.removeChild(textarea);
                        setCopied(thread.id);
                        setTimeout(() => setCopied(null), 5000);
                      }
                      // Open thread in new tab
                      if (thread.url) {
                        window.open(thread.url, "_blank");
                      }
                      // Mark as replied in our DB
                      handleAction(thread.id, "approve");
                    }}
                    loading={actionLoading === thread.id}
                  >
                    <Clipboard className="h-3.5 w-3.5 mr-1" />
                    Copy & Open Thread
                  </Button>
                </div>
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
