import type { Detector, SignalCandidate } from "./types";

/**
 * City-specific 30-day (or city-applicable) notice rights explainer.
 */
export const detectExplainerNoticeRights: Detector = async ({ city, cfg }) => {
  const noticeByCity: Record<string, { period: string; statute: string; headline: string }> = {
    nyc: { period: "30 days", statute: "NY RPL §226-c", headline: "Your 30-day notice rights in NYC, explained" },
    "los-angeles": { period: "60 days", statute: "LAMC §151", headline: "California's 60-day notice rule for tenants of 1+ year" },
    chicago: { period: "30 days", statute: "Chicago RLTO §5-12-130", headline: "Chicago's 30-day notice rule for non-renewal" },
    miami: { period: "30 days", statute: "Florida §83.57", headline: "Your Florida notice-to-vacate rights as a Miami renter" },
    houston: { period: "30 days", statute: "Texas Property Code §91.001", headline: "Texas notice-to-vacate rights for Houston renters" },
  };
  const entry = noticeByCity[city];
  if (!entry) return [];
  return [{
    type: "explainer-notice-rights",
    score: 0.8,
    headline_seed: entry.headline,
    metadata: { explainer: "notice-rights", ...entry, city },
    image_hint: "lease paperwork apartment",
  }];
};
