export interface NeighborhoodVibe {
  description: string;
  vibeTags: string[];
  pros: string[];
  cons: string[];
}

import { NYC_VIBES } from "./vibes/nyc-vibes";
import { LA_VIBES } from "./vibes/la-vibes";
import { CHICAGO_VIBES } from "./vibes/chicago-vibes";
import { MIAMI_VIBES } from "./vibes/miami-vibes";
import { HOUSTON_VIBES } from "./vibes/houston-vibes";

// Keyed by city → zip code → vibe data
export const NEIGHBORHOOD_VIBES: Record<string, Record<string, NeighborhoodVibe>> = {
  nyc: NYC_VIBES,
  "los-angeles": LA_VIBES,
  chicago: CHICAGO_VIBES,
  miami: MIAMI_VIBES,
  houston: HOUSTON_VIBES,
};

export function getNeighborhoodVibe(city: string, zipCode: string): NeighborhoodVibe | null {
  return NEIGHBORHOOD_VIBES[city]?.[zipCode] ?? null;
}
