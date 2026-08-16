"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, FileText, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

/**
 * Queue of original Reddit posts generated daily from our own data.
 *
 * Same approval gate as replies: a draft does nothing until it is approved
 * here, then the Mac mini poster publishes it to our profile within ~15
 * minutes (max 3 self-posts per 24h, 3h apart).
 */

interface SelfPost {
  id: string;
  kind: string;
  city: string;
  title: string;
  body: string;
  links: string[];
  status: string;
  posted_url: string | null;
  posted_at: string | null;
  created_at: string;
}

type SelfPostFilter = "draft" | "approved" | "posted" | "rejected" | "all";

const FILTERS: { key: SelfPostFilter; label: string }[] = [
  { key: "draft", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "posted", label: "Posted" },
  { key: "rejected", label: "Denied" },
  { key: "all", label: "All" },
];

const KIND_LABEL: Record<string, string> = {
  worst_buildings: "Worst buildings",
  worst_landlords: "Worst landlords",
  worst_neighborhoods: "Worst neighborhoods",
  most_311_complaints: "Most 311 complaints",
  most_evictions: "Most evictions",
  most_litigated: "Most litigated",
  bedbug_hotspots: "Bedbug hotspots",
};

const CITY_LABEL: Record<string, string> = {
  nyc: "NYC",
  "los-angeles": "Los Angeles",
  chicago: "Chicago",
};

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function SelfPostsTab() {
  const [posts, setPosts] = useState<SelfPost[]>([]);
  const [counts, setCounts] = useState<Partial<Record<SelfPostFilter, number>>>({});
  const [filter, setFilter] = useState<SelfPostFilter>("draft");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/marketing/reddit/selfpost?status=${filter}`);
      if (!res.ok) throw new Error(`Failed to load (HTTP ${res.status})`);
      const json = (await res.json()) as {
        posts?: SelfPost[];
        byStatus?: Record<string, number>;
      };
      setPosts(json.posts ?? []);
      if (json.byStatus) {
        const total = Object.values(json.byStatus).reduce((a, b) => a + b, 0);
        setCounts({ ...json.byStatus, all: total });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    void load();
    const interval = setInterval(() => void load(), 30000);
    return () => clearInterval(interval);
  }, [load]);

  async function mark(id: string, status: "approved" | "rejected") {
    setBusyId(id);
    try {
      const res = await fetch("/api/marketing/reddit/selfpost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[#64748b]">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Loading self-posts...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {FILTERS.map(({ key, label }) => {
            const count = counts[key];
            return (
              <button
                key={key}
                onClick={() => {
                  setFilter(key);
                  setLoading(true);
                }}
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
                      filter === key ? "bg-white/20 text-white" : "bg-gray-200 text-[#64748b]"
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
            void load();
          }}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {filter === "approved" && posts.length > 0 && (
        <div className="rounded-lg border border-[#f59e0b]/30 bg-[#fffbeb] px-3 py-2 text-xs text-[#92400e]">
          <strong>{posts.length}</strong> approved self-post{posts.length === 1 ? "" : "s"} queued.
          The poster publishes one to our profile within ~15 min (max 3/day, 3h apart).
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-[#ef4444]/30 bg-[#fef2f2] px-3 py-2 text-xs text-[#991b1b]">
          {error}
        </div>
      )}

      {posts.length === 0 && !loading && (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-10 w-10 mx-auto text-[#e2e8f0] mb-3" />
            <p className="text-[#64748b]">
              {filter === "draft"
                ? "No self-post drafts awaiting review — new ones generate daily at 9 AM"
                : filter === "approved"
                  ? "No approved self-posts waiting to publish"
                  : filter === "posted"
                    ? "No published self-posts yet"
                    : filter === "rejected"
                      ? "No denied drafts"
                      : "No self-posts"}
            </p>
          </CardContent>
        </Card>
      )}

      {posts.map((post) => (
        <Card key={post.id}>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="info">{CITY_LABEL[post.city] ?? post.city}</Badge>
                  <span className="text-xs text-[#64748b]">
                    {KIND_LABEL[post.kind] ?? post.kind}
                  </span>
                  <span className="text-xs text-[#64748b]">
                    {formatRelativeTime(post.created_at)}
                  </span>
                </div>
                <h3 className="text-sm font-medium text-[#0F1D2E]">{post.title}</h3>
              </div>
            </div>

            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-[#e2e8f0] bg-gray-50 p-3 font-mono text-[11px] leading-relaxed text-[#334155]">
              {post.body}
            </pre>

            {post.status === "draft" && (
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void mark(post.id, "rejected")}
                  loading={busyId === post.id}
                >
                  Decline
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void mark(post.id, "approved")}
                  loading={busyId === post.id}
                >
                  Approve
                </Button>
              </div>
            )}

            {post.status === "posted" && (
              <p className="flex items-center gap-2 text-xs text-[#64748b]">
                Posted {post.posted_at ? formatRelativeTime(post.posted_at) : ""}
                {post.posted_url && (
                  <a
                    href={post.posted_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#3B82F6] hover:underline"
                  >
                    View on Reddit
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
