import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ reviewId: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { reviewId } = await context.params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if already voted
  const { data: existing } = await supabase
    .from("helpful_votes")
    .select("id")
    .eq("user_id", user.id)
    .eq("review_id", reviewId)
    .single();

  if (existing) {
    // Remove vote
    await supabase.from("helpful_votes").delete().eq("id", existing.id);
  } else {
    // Add vote
    await supabase.from("helpful_votes").insert({
      user_id: user.id,
      review_id: reviewId,
    });
  }

  // Get updated count
  const { data: review } = await supabase
    .from("reviews")
    .select("helpful_count")
    .eq("id", reviewId)
    .single();

  return NextResponse.json({
    helpful_count: review?.helpful_count || 0,
    user_voted: !existing,
  });
}
