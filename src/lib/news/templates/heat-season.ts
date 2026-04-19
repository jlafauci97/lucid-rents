import type { Detector, SignalCandidate } from "./types";

/**
 * Seasonal "heat period starts" story for NYC + Chicago. Fires only during
 * the first two weeks of October, when NYC's legal heat period begins Oct 1.
 */
export const detectHeatSeasonKickoff: Detector = async ({ city, cfg, today }) => {
  if (city !== "nyc" && city !== "chicago") return [];
  const d = new Date(today + "T00:00:00Z");
  const month = d.getUTCMonth() + 1; // 1-12
  const dayOfMonth = d.getUTCDate();
  if (month !== 10 || dayOfMonth > 14) return [];

  const threshold = city === "nyc" ? "68°F during daytime, 62°F overnight" : "68°F indoors (Chicago Municipal Code §13-196-410)";
  return [{
    type: "heat-season-kickoff",
    score: 4.0, // high — timely seasonal anchor
    headline_seed: `Heat season starts — know your legal ${cfg.agencies[0]} rights`,
    metadata: { agency: cfg.agencies[0], threshold, start_date: "October 1", season: "cold" },
    image_hint: "apartment radiator winter",
  }];
};
