import type { Detector, SignalCandidate } from "./types";

/**
 * Evergreen guide — always available, low score so any real data signal wins.
 * "Red flags to check before signing a lease," framed around the records Lucid
 * Rents surfaces (violations, evictions, complaints, reviews).
 */
export const detectGuideRedFlags: Detector = async ({ city }) => [
  {
    type: "guide-red-flags",
    score: 0.8,
    headline_seed: `7 red flags to check before signing a lease in ${city.toUpperCase()}`,
    metadata: { topic: "red-flags" },
    image_hint: `${city} apartment lease signing`,
  } satisfies SignalCandidate,
];
