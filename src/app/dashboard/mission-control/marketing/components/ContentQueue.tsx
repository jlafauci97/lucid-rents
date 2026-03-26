"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Eye, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ReviewModal } from "./ReviewModal";
import type { MarketingDraft, MarketingDraftStatus } from "@/types/marketing";

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "..." : s;
}

const STATUS_BADGES: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  generating: "info",
  draft: "warning",
  approved: "default",
  published: "success",
  rejected: "danger",
  failed: "danger",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  landlord_expose: "Landlord Expose",
  building_horror: "Building Horror",
  neighborhood_trend: "Neighborhood Trend",
  tenant_rights: "Tenant Rights",
  news_reaction: "News Reaction",
  viral_humor: "Viral Humor",
};

const VIDEO_TYPE_LABELS: Record<string, string> = {
  avatar: "Nano Banana",
  data_viz: "Remotion",
  viral_character: "Nano Banana",
  none: "None",
};

export function ContentQueue() {
  const [drafts, setDrafts] = useState<MarketingDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewDraft, setReviewDraft] = useState<MarketingDraft | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<MarketingDraftStatus | "all">("all");

  const fetchDrafts = useCallback(async () => {
    try {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/marketing/drafts${params}`);
      const data = await res.json();
      setDrafts(data.drafts ?? []);
    } catch (err) {
      console.error("Failed to fetch drafts:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchDrafts();
    const interval = setInterval(fetchDrafts, 30000);
    return () => clearInterval(interval);
  }, [fetchDrafts]);

  const draftCount = drafts.filter((d) => d.status === "draft").length;
  const draftIds = drafts.filter((d) => d.status === "draft").map((d) => d.id);

  async function handleBatchApprove() {
    if (draftIds.length < 2) return;
    setBatchLoading(true);
    try {
      await fetch("/api/marketing/approve-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftIds }),
      });
      await fetchDrafts();
    } catch (err) {
      console.error("Batch approve failed:", err);
    } finally {
      setBatchLoading(false);
    }
  }

  const statuses: (MarketingDraftStatus | "all")[] = [
    "all",
    "generating",
    "draft",
    "approved",
    "published",
    "rejected",
    "failed",
  ];

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                statusFilter === s
                  ? "bg-[#0F1D2E] text-white"
                  : "bg-gray-100 text-[#64748b] hover:bg-gray-200"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setLoading(true);
            fetchDrafts();
          }}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Batch action bar */}
      {draftCount >= 2 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-amber-800">
              {draftCount} drafts ready
            </span>
            <Button
              size="sm"
              onClick={handleBatchApprove}
              loading={batchLoading}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Approve All
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0]">
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">
                  Type
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">
                  Caption
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">
                  Video
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">
                  Created
                </th>
                <th className="px-4 py-3 text-right font-medium text-[#64748b]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && drafts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[#64748b]">
                    Loading drafts...
                  </td>
                </tr>
              ) : drafts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[#64748b]">
                    No content drafts yet
                  </td>
                </tr>
              ) : (
                drafts.map((draft) => (
                  <tr
                    key={draft.id}
                    className="border-b border-[#e2e8f0] last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGES[draft.status] ?? "default"}>
                        {draft.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[#0F1D2E]">
                      {CONTENT_TYPE_LABELS[draft.content_type] ?? draft.content_type}
                    </td>
                    <td className="px-4 py-3 text-[#0F1D2E] max-w-xs">
                      {draft.caption ? truncate(draft.caption, 80) : (
                        <span className="text-[#64748b] italic">Generating...</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#64748b]">
                      {VIDEO_TYPE_LABELS[draft.video_type] ?? draft.video_type}
                    </td>
                    <td className="px-4 py-3 text-[#64748b] whitespace-nowrap">
                      {formatRelativeTime(draft.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {draft.status === "draft" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReviewDraft(draft)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Review
                        </Button>
                      ) : draft.status === "published" && draft.publish_results?.[0]?.url ? (
                        <a
                          href={draft.publish_results[0].url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#3B82F6] hover:underline text-xs"
                        >
                          View post
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Review Modal */}
      {reviewDraft && (
        <ReviewModal
          draft={reviewDraft}
          onClose={() => setReviewDraft(null)}
          onActionComplete={() => {
            setReviewDraft(null);
            fetchDrafts();
          }}
        />
      )}
    </div>
  );
}
