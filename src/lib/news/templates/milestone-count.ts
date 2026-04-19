import type { Detector, SignalCandidate } from "./types";
import { CITY_META } from "@/lib/cities";

/**
 * Round-number milestones for total building / review / violation counts.
 * Fires when a count crosses a human-memorable threshold this week.
 */
export const detectMilestoneCount: Detector = async ({ city, cfg, supabase }) => {
  const cityName = CITY_META[city].fullName;
  const [buildings, reviews, violations] = await Promise.all([
    supabase.from("buildings").select("id", { count: "exact", head: true }).eq("metro", city),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("metro", city),
    supabase.from("buildings").select("violation_count").eq("metro", city),
  ]);

  const bCount = buildings.count ?? 0;
  const rCount = reviews.count ?? 0;
  const vSum = (violations.data ?? [])
    .reduce((acc: number, r: { violation_count: number | null }) => acc + (r.violation_count ?? 0), 0);

  // Milestone thresholds for the "big number" stories
  const thresholds = [100000, 500000, 1_000_000, 2_000_000, 5_000_000, 10_000_000];
  const crossedReview = thresholds.find((t) => rCount >= t && rCount < t * 1.01);
  if (!crossedReview) return [];

  return [{
    type: "milestone-count",
    score: 1.8,
    headline_seed: `${cityName} tenant review count passes ${crossedReview.toLocaleString()}`,
    metadata: { buildings: bCount, reviews: rCount, violations: vSum, milestone: crossedReview },
    image_hint: `${cityName} skyline`,
  }];
};
