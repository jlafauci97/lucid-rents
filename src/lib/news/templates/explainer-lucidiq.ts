import type { Detector, SignalCandidate } from "./types";

export const detectExplainerLucidIQ: Detector = async ({ city, cfg }) => {
  return [{
    type: "explainer-lucidiq",
    score: 0.6,
    headline_seed: "How the LucidIQ score is calculated",
    metadata: { explainer: "lucidiq", city, agencies: cfg.agencies },
    image_hint: "building score data",
  }];
};
