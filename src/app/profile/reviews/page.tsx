import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildingUrl, cityPath } from "@/lib/seo";
import { Card, CardContent } from "@/components/ui/Card";
import { StarRating } from "@/components/ui/StarRating";
import { Badge } from "@/components/ui/Badge";
import { formatRelativeDate } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Reviews",
};

export default async function MyReviewsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: reviews } = await supabase
    .from("reviews")
    .select("*, building:buildings(id, full_address, borough, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-[#0F1D2E] mb-6">My Reviews</h1>
      {reviews && reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews.map((review) => {
            const building = review.building as { id: string; full_address: string; borough: string; slug: string } | null;
            const title = review.title as string | null;
            const status = review.status as string;
            return (
              <Card key={review.id} hover>
                <CardContent>
                  <Link href={building ? buildingUrl(building) : "#"}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-base font-semibold text-[#0F1D2E]">
                          {building?.full_address}
                        </p>
                        <p className="text-sm text-[#64748b]">
                          {building?.borough} ·{" "}
                          {formatRelativeDate(review.created_at)}
                        </p>
                        {title ? (
                          <p className="text-sm text-[#0F1D2E] mt-2">
                            {title}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3">
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
                    </div>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent>
            <p className="text-center text-[#64748b] py-8">
              You haven&apos;t written any reviews yet.{" "}
              <Link
                href={cityPath("/review/new")}
                className="text-[#3B82F6] hover:text-[#2563EB] font-medium"
              >
                Write your first review
              </Link>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
