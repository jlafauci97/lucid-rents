import type { Detector, SignalCandidate } from "./types";

/**
 * LA-only. Peak wildfire season Aug-Oct. Evergreen enough to emit through
 * end of the year as air-quality and insurance context stays relevant.
 */
export const detectWildfireImpact: Detector = async ({ city, cfg, today }) => {
  if (city !== "los-angeles") return [];
  const d = new Date(today + "T00:00:00Z");
  const month = d.getUTCMonth() + 1;
  if (month < 7 || month > 12) return [];

  return [{
    type: "wildfire-impact",
    score: 2.5,
    headline_seed: "Wildfire season: renters rights when your unit is affected",
    metadata: { season_month: month, agencies: cfg.agencies },
    image_hint: "Los Angeles wildfire smoke skyline",
  }];
};
