"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Queue of original Reddit posts generated from our own data.
 *
 * These are distinct from the reply drafts in RedditTab: they have no parent
 * thread, they go to our own profile, and nothing here publishes automatically.
 * Copy the body, post it by hand, then mark it posted so it leaves the queue.
 */

interface SelfPost {
  id: string;
  kind: "worst_buildings" | "worst_landlords" | "worst_neighborhoods";
  city: string;
  title: string;
  body: string;
  links: string[];
  status: string;
  created_at: string;
}

const KIND_LABEL: Record<SelfPost["kind"], string> = {
  worst_buildings: "Worst buildings",
  worst_landlords: "Worst landlords",
  worst_neighborhoods: "Worst neighborhoods",
};

const CITY_LABEL: Record<string, string> = {
  nyc: "NYC",
  "los-angeles": "Los Angeles",
  chicago: "Chicago",
};

export function SelfPostsTab() {
  const [posts, setPosts] = useState<SelfPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/marketing/reddit/selfpost");
      if (!res.ok) throw new Error(`Failed to load (HTTP ${res.status})`);
      const json = (await res.json()) as { posts?: SelfPost[] };
      setPosts(json.posts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function mark(id: string, status: "posted" | "rejected") {
    setBusyId(id);
    try {
      const postedUrl =
        status === "posted"
          ? window.prompt("Reddit URL (optional — leave blank to skip):") || undefined
          : undefined;
      const res = await fetch("/api/marketing/reddit/selfpost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, postedUrl }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function copy(post: SelfPost) {
    try {
      await navigator.clipboard.writeText(`${post.title}\n\n${post.body}`);
      setCopiedId(post.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError("Clipboard unavailable — select the text manually.");
    }
  }

  if (loading) {
    return <p className="text-sm text-[#64748b]">Loading self-posts…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs leading-relaxed text-[#64748b]">
          Original posts for our own Reddit profile, built from LucidRents data. Nothing here posts
          automatically — copy it, post it by hand, then mark it posted.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="shrink-0 rounded-lg border border-[#e2e8f0] px-3 py-1.5 text-xs font-medium text-[#475569] transition-colors hover:border-[#3B82F6] hover:text-[#3B82F6]"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-[#ef4444]/30 bg-[#fef2f2] px-3 py-2 text-xs text-[#991b1b]">
          {error}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-6 text-center text-sm text-[#64748b]">
          No self-post drafts. They are generated from the monthly ranking data — run{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
            POST /api/marketing/reddit/selfpost
          </code>{" "}
          to create more.
        </div>
      ) : (
        posts.map((post) => (
          <article
            key={post.id}
            className="rounded-xl border border-[#e2e8f0] bg-white p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[#0F1D2E]">{post.title}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#64748b]">
                  <span className="rounded bg-gray-100 px-2 py-0.5">
                    {CITY_LABEL[post.city] ?? post.city}
                  </span>
                  <span className="rounded bg-gray-100 px-2 py-0.5">{KIND_LABEL[post.kind]}</span>
                  <span>{post.links.length} links</span>
                  <span>· {new Date(post.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void copy(post)}
                className="shrink-0 rounded-lg border border-[#e2e8f0] px-3 py-1.5 text-xs font-medium text-[#475569] transition-colors hover:border-[#3B82F6] hover:text-[#3B82F6]"
              >
                {copiedId === post.id ? "Copied" : "Copy"}
              </button>
            </div>

            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-[#e2e8f0] bg-gray-50 p-3 font-mono text-[11px] leading-relaxed text-[#334155]">
              {post.body}
            </pre>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busyId === post.id}
                onClick={() => void mark(post.id, "posted")}
                className="rounded-lg bg-[#0F1D2E] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busyId === post.id ? "Saving…" : "Mark posted"}
              </button>
              <button
                type="button"
                disabled={busyId === post.id}
                onClick={() => void mark(post.id, "rejected")}
                className="rounded-lg border border-[#e2e8f0] px-3 py-1.5 text-xs font-medium text-[#64748b] transition-colors hover:border-[#ef4444] hover:text-[#ef4444] disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
