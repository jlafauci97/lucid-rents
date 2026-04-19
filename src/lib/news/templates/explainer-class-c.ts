import type { Detector, SignalCandidate } from "./types";

export const detectExplainerClassC: Detector = async ({ city, cfg }) => {
  if (city !== "nyc") return [];
  return [{
    type: "explainer-class-c",
    score: 0.7,
    headline_seed: "What a Class C HPD violation actually means",
    metadata: { explainer: "class-c", agency: "HPD", city },
    image_hint: "NYC apartment building",
  }];
};
