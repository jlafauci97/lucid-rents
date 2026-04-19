import type { Detector, SignalCandidate } from "./types";

export const detectExplainerRentStab: Detector = async ({ city, cfg }) => {
  if (city !== "nyc" && city !== "los-angeles") return [];
  const agency = city === "nyc" ? "DHCR / HCR" : "LAHD";
  return [{
    type: "explainer-rent-stab",
    score: 0.7,
    headline_seed: city === "nyc"
      ? "Is your building rent-stabilized? A quick explainer"
      : "LA's Rent Stabilization Ordinance, plainly explained",
    metadata: { explainer: "rent-stab", agency, city },
    image_hint: `${cfg.landmark_neighborhoods[0]} apartment building`,
  }];
};
