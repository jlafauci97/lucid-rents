"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Eye, Heart, TrendingUp, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { MarketingAnalyticsRow } from "@/types/marketing";

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "..." : s;
}

interface AnalyticsWithDraft extends MarketingAnalyticsRow {
  caption?: string;
  published_at?: string;
}

export function AnalyticsTab() {
  const [rows, setRows] = useState<AnalyticsWithDraft[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch("/api/marketing/analytics");
      const data = await res.json();
      setRows(data.analytics ?? []);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const totalImpressions = rows.reduce((sum, r) => sum + (r.impressions ?? 0), 0);
  const totalEngagements = rows.reduce((sum, r) => sum + (r.engagements ?? 0), 0);
  const uniqueDrafts = new Set(rows.map((r) => r.draft_id)).size;
  const topPost = rows.length > 0
    ? rows.reduce((top, r) =>
        (r.engagements ?? 0) > (top.engagements ?? 0) ? r : top
      )
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[#5E6687]">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Loading analytics...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <TrendingUp className="h-10 w-10 mx-auto text-[#e2e8f0] mb-3" />
          <p className="text-[#5E6687]">No published posts with analytics yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <TrendingUp className="h-5 w-5 text-[#6366F1]" />
              </div>
              <div>
                <p className="text-xs text-[#5E6687]">Posts Published</p>
                <p className="text-xl font-semibold text-[#1A1F36]">
                  {uniqueDrafts}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Eye className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-[#5E6687]">Total Impressions</p>
                <p className="text-xl font-semibold text-[#1A1F36]">
                  {totalImpressions.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Heart className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-[#5E6687]">Total Engagements</p>
                <p className="text-xl font-semibold text-[#1A1F36]">
                  {totalEngagements.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Trophy className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-[#5E6687]">Top Post Engagements</p>
                <p className="text-xl font-semibold text-[#1A1F36]">
                  {topPost ? topPost.engagements.toLocaleString() : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[#1A1F36]">
              Post Performance
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setLoading(true);
                fetchAnalytics();
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                <th className="px-4 py-3 text-left font-medium text-[#5E6687]">
                  Caption
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#5E6687]">
                  Platform
                </th>
                <th className="px-4 py-3 text-right font-medium text-[#5E6687]">
                  Impressions
                </th>
                <th className="px-4 py-3 text-right font-medium text-[#5E6687]">
                  Engagements
                </th>
                <th className="px-4 py-3 text-right font-medium text-[#5E6687]">
                  Clicks
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#5E6687]">
                  Fetched
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[#E2E8F0] last:border-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 text-[#1A1F36] max-w-xs">
                    {row.caption
                      ? truncate(row.caption, 60)
                      : truncate(row.draft_id, 12)}
                  </td>
                  <td className="px-4 py-3 text-[#5E6687] capitalize">
                    {row.platform}
                  </td>
                  <td className="px-4 py-3 text-right text-[#1A1F36]">
                    {row.impressions.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-[#1A1F36]">
                    {row.engagements.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-[#1A1F36]">
                    {row.clicks.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-[#5E6687] text-xs whitespace-nowrap">
                    {new Date(row.fetched_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
