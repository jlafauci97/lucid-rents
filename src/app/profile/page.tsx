import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildingUrl, cityPath } from "@/lib/seo";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StarRating } from "@/components/ui/StarRating";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { Badge } from "@/components/ui/Badge";
import { ActivityTimeline } from "@/components/dashboard/ActivityTimeline";
import {
  PenSquare,
  Bookmark,
  ThumbsUp,
  Bell,
  AlertTriangle,
  Search,
  ArrowLeftRight,
  Shield,
  MapPin,
} from "lucide-react";
import { formatRelativeDate } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Compute 7-day cutoff for alerts
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const alertCutoff = sevenDaysAgo.toISOString().split("T")[0];

  const [
    profileRes,
    reviewsRes,
    savedRes,
    monitoredRes,
    savedCountRes,
    monitoredCountRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("reviews")
      .select("*, building:buildings(id, full_address, borough, slug)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("saved_buildings")
      .select("*, building:buildings(id, full_address, borough, slug, overall_score)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("monitored_buildings")
      .select("*, building:buildings(id, full_address, borough, slug, overall_score)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("saved_buildings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("monitored_buildings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const profile = profileRes.data;
  const reviews = reviewsRes.data || [];
  const saved = savedRes.data || [];
  const monitored = monitoredRes.data || [];
  const savedCount = savedCountRes.count ?? 0;
  const monitoredCount = monitoredCountRes.count ?? 0;

  // Get monitored building IDs for alerts count and activity timeline
  const monitoredBuildingIds = monitored
    .map((item) => {
      const b = item.building as { id: string } | null;
      return b?.id;
    })
    .filter((id): id is string => !!id);

  // Fetch alert count: violations on monitored buildings in last 7 days
  let alertCount = 0;
  if (monitoredBuildingIds.length > 0) {
    const alertRes = await supabase
      .from("hpd_violations")
      .select("id", { count: "exact", head: true })
      .in("building_id", monitoredBuildingIds)
      .gte("nov_issue_date", alertCutoff);
    alertCount = alertRes.count ?? 0;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1F36]">
            Welcome, {profile?.display_name || "User"}
          </h1>
          <p className="text-sm text-[#5E6687]">
            Your apartment insights profile
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <PenSquare className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#1A1F36]">
                {profile?.review_count || 0}
              </p>
              <p className="text-sm text-[#5E6687]">Reviews</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <ThumbsUp className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#1A1F36]">
                {profile?.helpful_count || 0}
              </p>
              <p className="text-sm text-[#5E6687]">Helpful Votes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Bookmark className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#1A1F36]">
                {savedCount}
              </p>
              <p className="text-sm text-[#5E6687]">Saved Buildings</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Bell className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#1A1F36]">
                {monitoredCount}
              </p>
              <p className="text-sm text-[#5E6687]">Monitored</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#1A1F36]">
                {alertCount}
              </p>
              <p className="text-sm text-[#5E6687]">Alerts (7d)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Link href={cityPath("/buildings")}>
          <Card hover className="h-full">
            <CardContent className="flex flex-col items-center gap-2 py-5 text-center">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Search className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-[#1A1F36]">
                Search Buildings
              </span>
            </CardContent>
          </Card>
        </Link>
        <Link href={cityPath("/compare")}>
          <Card hover className="h-full">
            <CardContent className="flex flex-col items-center gap-2 py-5 text-center">
              <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                <ArrowLeftRight className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-[#1A1F36]">
                Compare Buildings
              </span>
            </CardContent>
          </Card>
        </Link>
        <Link href={cityPath("/crime")}>
          <Card hover className="h-full">
            <CardContent className="flex flex-col items-center gap-2 py-5 text-center">
              <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-[#1A1F36]">
                View Crime Data
              </span>
            </CardContent>
          </Card>
        </Link>
        <Link href={cityPath("/tenant-rights")}>
          <Card hover className="h-full">
            <CardContent className="flex flex-col items-center gap-2 py-5 text-center">
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-[#1A1F36]">
                Tenant Rights
              </span>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* My Reviews */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-[#1A1F36]">My Reviews</h2>
          </CardHeader>
          <CardContent>
            {reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map((review) => {
                  const building = review.building as { id: string; full_address: string; borough: string; slug: string } | null;
                  const title = review.title as string | null;
                  const status = review.status as string;
                  return (
                    <Link
                      key={review.id}
                      href={building ? buildingUrl(building) : "#"}
                      className="flex items-start justify-between py-2 hover:bg-gray-50 rounded px-2 -mx-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#1A1F36] truncate">
                          {building?.full_address}
                        </p>
                        {title && (
                          <p className="text-xs text-[#5E6687] truncate mt-0.5">
                            {title}
                          </p>
                        )}
                        <p className="text-xs text-[#A3ACBE] mt-0.5">
                          {formatRelativeDate(review.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        <Badge
                          variant={
                            status === "published"
                              ? "success"
                              : status === "flagged"
                              ? "warning"
                              : "default"
                          }
                        >
                          {status}
                        </Badge>
                        <StarRating
                          value={review.overall_rating}
                          readonly
                          size="sm"
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[#5E6687] text-center py-6">
                No reviews yet.{" "}
                <Link
                  href={cityPath("/review/new")}
                  className="text-[#6366F1] hover:text-[#4F46E5] font-medium"
                >
                  Write your first review
                </Link>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Saved Buildings */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-[#1A1F36]">Saved Buildings</h2>
          </CardHeader>
          <CardContent>
            {saved.length > 0 ? (
              <div className="space-y-4">
                {saved.map((item) => {
                  const building = item.building as {
                    id: string;
                    full_address: string;
                    borough: string;
                    slug: string;
                    overall_score: number | null;
                  } | null;
                  return (
                    <Link
                      key={item.id}
                      href={building ? buildingUrl(building) : "#"}
                      className="flex items-center justify-between py-2 hover:bg-gray-50 rounded px-2 -mx-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#1A1F36] truncate">
                          {building?.full_address}
                        </p>
                        <p className="text-xs text-[#A3ACBE]">
                          {building?.borough}
                        </p>
                      </div>
                      {building && (
                        <div className="flex-shrink-0 ml-3">
                          <LetterGrade
                            score={building.overall_score}
                            size="sm"
                          />
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[#5E6687] text-center py-6">
                No saved buildings yet.{" "}
                <Link
                  href={cityPath("/search")}
                  className="text-[#6366F1] hover:text-[#4F46E5] font-medium"
                >
                  Search for buildings
                </Link>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Monitored Buildings */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-[#1A1F36]">Monitored Buildings</h2>
          </CardHeader>
          <CardContent>
            {monitored.length > 0 ? (
              <div className="space-y-4">
                {monitored.map((item) => {
                  const building = item.building as {
                    id: string;
                    full_address: string;
                    borough: string;
                    slug: string;
                    overall_score: number | null;
                  } | null;
                  return (
                    <Link
                      key={item.id}
                      href={building ? buildingUrl(building) : "#"}
                      className="flex items-center justify-between py-2 hover:bg-gray-50 rounded px-2 -mx-2"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Bell className="w-4 h-4 text-[#6366F1] flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#1A1F36] truncate">
                            {building?.full_address}
                          </p>
                          <p className="text-xs text-[#A3ACBE]">
                            {building?.borough}
                          </p>
                        </div>
                      </div>
                      {building && (
                        <div className="flex-shrink-0 ml-3">
                          <LetterGrade
                            score={building.overall_score}
                            size="sm"
                          />
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[#5E6687] text-center py-6">
                No monitored buildings yet. Visit a building page and click
                &quot;Monitor&quot; to track new violations.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-[#1A1F36]">
              Recent Activity on Monitored Buildings
            </h2>
          </CardHeader>
          <CardContent>
            <ActivityTimeline buildingIds={monitoredBuildingIds} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
