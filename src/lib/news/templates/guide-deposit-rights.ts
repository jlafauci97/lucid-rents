import type { Detector, SignalCandidate } from "./types";

/**
 * Evergreen guide — security-deposit rights for renters in this city. Low score
 * so it only surfaces when no stronger data-backed signal is available.
 */
export const detectGuideDepositRights: Detector = async ({ city, cfg }) => [
  {
    type: "guide-deposit-rights",
    score: 0.75,
    headline_seed: `Security deposit rights every ${city.toUpperCase()} renter should know`,
    metadata: { topic: "security-deposit", agencies: cfg.agencies },
    image_hint: `${city} apartment keys and deposit`,
  } satisfies SignalCandidate,
];
