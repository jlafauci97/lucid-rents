import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildingUrl, cityPath } from "@/lib/seo";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StarRating } from "@/components/ui/StarRating";
import { PenSquare, Bookmark, ThumbsUp, ChevronRight, Bell } from "lucide-react";
import { formatRelativeDate } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, reviewsRes, savedRes, monitoredRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("reviews")
      .select("*, building:buildings(full_address, borough)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("saved_buildings")
      .select("*, building:buildings(id, full_address, borough, slug, overall_score)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("monitored_buildings")
      .select("*, building:buildings(id, full_address, borough, slug)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const profile = profileRes.data;
  const reviews = reviewsRes.data || [];
  const saved = savedRes.data || [];
  const monitored = monitoredRes.data || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#0F1D2E]">
            Welcome, {profile?.display_name || "User"}
          </h1>
          <p className="text-sm text-[#64748b]">
            Your apartment insights dashboard
          </p>
        </div>
        <Link href={cityPath("/review/new")}>
          <Button>
            <PenSquare className="w-4 h-4 mr-2" />
            Write Review
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <PenSquare className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#0F1D2E]">
                {profile?.review_count || 0}
              </p>
              <p className="text-sm text-[#64748b]">Reviews</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
              <ThumbsUp className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#0F1D2E]">
                {profile?.helpful_count || 0}
              </p>
              <p className="text-sm text-[#64748b]">Helpful Votes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
              <Bookmark className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#0F1D2E]">
                {saved.length}
              </p>
              <p className="text-sm text-[#64748b]">Saved Buildings</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
              <Bell className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#0F1D2E]">
                {monitored.length}
              </p>
              <p className="text-sm text-[#64748b]">Monitored</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Reviews */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="font-semibold text-[#0F1D2E]">Recent Reviews</h2>
            <Link
              href="/dashboard/reviews"
              className="text-sm text-[#3B82F6] hover:text-[#2563EB] flex items-center"
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map((review) => {
                  const building = review.building as { full_address: string; borough: string } | null;
                  return (
                    <div
                      key={review.id}
                      className="flex items-start justify-between py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#0F1D2E] truncate">
                          {building?.full_address}
                        </p>
                        <p className="text-xs text-[#94a3b8]">
                          {formatRelativeDate(review.created_at)}
                        </p>
                      </div>
                      <StarRating
                        value={review.overall_rating}
                        readonly
                        size="sm"
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[#64748b] text-center py-6">
                No reviews yet. Start by writing your first review!
              </p>
            )}
          </CardContent>
        </Card>

        {/* Saved Buildings */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="font-semibold text-[#0F1D2E]">Saved Buildings</h2>
            <Link
              href="/dashboard/saved"
              className="text-sm text-[#3B82F6] hover:text-[#2563EB] flex items-center"
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {saved.length > 0 ? (
              <div className="space-y-4">
                {saved.map((item) => {
                  const building = item.building as { id: string; full_address: string; borough: string; slug: string } | null;
                  return (
                    <Link
                      key={item.id}
                      href={building ? buildingUrl(building) : "#"}
                      className="flex items-center justify-between py-2 hover:bg-gray-50 rounded px-2 -mx-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#0F1D2E] truncate">
                          {building?.full_address}
                        </p>
                        <p className="text-xs text-[#94a3b8]">
                          {building?.borough}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[#64748b] text-center py-6">
                No saved buildings yet. Search and save buildings you&apos;re
                interested in!
              </p>
            )}
          </CardContent>
        </Card>

        {/* Monitored Buildings */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <h2 className="font-semibold text-[#0F1D2E]">Monitored Buildings</h2>
            <Link
              href="/dashboard/monitoring"
              className="text-sm text-[#3B82F6] hover:text-[#2563EB] flex items-center"
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {monitored.length > 0 ? (
              <div className="space-y-4">
                {monitored.map((item) => {
                  const building = item.building as { id: string; full_address: string; borough: string; slug: string } | null;
                  return (
                    <Link
                      key={item.id}
                      href={building ? buildingUrl(building) : "#"}
                      className="flex items-center justify-between py-2 hover:bg-gray-50 rounded px-2 -mx-2"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Bell className="w-4 h-4 text-[#3B82F6] flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#0F1D2E] truncate">
                            {building?.full_address}
                          </p>
                          <p className="text-xs text-[#94a3b8]">
                            {building?.borough}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[#64748b] text-center py-6">
                No monitored buildings yet. Visit a building page and click
                &quot;Monitor&quot; to track new violations.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
