import type { Detector, SignalCandidate } from "./types";
import { CITY_META } from "@/lib/cities";

/**
 * How to file a habitability complaint in this city — evergreen service piece.
 */
export const detectExplainerFileComplaint: Detector = async ({ city, cfg }) => {
  const channelByCity: Record<string, string> = {
    nyc: "311 (NYC) or HPD online portal",
    "los-angeles": "311 (LA) or LAHD online portal",
    chicago: "311 (Chicago) / CBS inspector request",
    miami: "311 (Miami-Dade) or Code Compliance",
    houston: "311 (Houston) or Harris County Code",
  };
  const channel = channelByCity[city];
  if (!channel) return [];
  return [{
    type: "explainer-file-complaint",
    score: 0.75,
    headline_seed: `How to file a habitability complaint in ${CITY_META[city].fullName}`,
    metadata: { explainer: "file-complaint", channel, agencies: cfg.agencies, city },
    image_hint: "tenant complaint filing",
  }];
};
