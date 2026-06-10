import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
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

  const rl = await checkRateLimit(`helpful:${user.id}`);
  if (rl.limited) return rl.response;

  // Check if already voted
  const { data: existing, error: voteLookupError } = await supabase
    .from("helpful_votes")
    .select("id")
    .eq("user_id", user.id)
    .eq("review_id", reviewId)
    .maybeSingle();

  if (voteLookupError) {
    console.error("Failed to look up helpful vote:", voteLookupError);
    return NextResponse.json(
      { error: "Failed to record vote" },
      { status: 500 }
    );
  }

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
  const { data: review, error: countError } = await supabase
    .from("reviews")
    .select("helpful_count")
    .eq("id", reviewId)
    .maybeSingle();

  if (countError) {
    // Vote already toggled — log and fall back to 0 rather than failing.
    console.error("Failed to read helpful count:", countError);
  }

  return NextResponse.json({
    helpful_count: review?.helpful_count || 0,
    user_voted: !existing,
  });
}
