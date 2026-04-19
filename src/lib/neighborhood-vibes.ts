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

// Aliases: zip codes that share a neighborhood with another zip but don't
// have their own vibe entry. Maps "lookup zip" -> "fallback zip with vibe data".
const ZIP_VIBE_ALIASES: Record<string, Record<string, string>> = {
  nyc: {
    "11249": "11211", // North Williamsburg waterfront -> Williamsburg
    "10004": "10005", // Battery Park area
    "10006": "10005", // FiDi
    "10007": "10005", // Tribeca/FiDi
    "10038": "10005", // Lower Manhattan
  },
  "los-angeles": {},
  chicago: {},
  miami: {},
  houston: {},
};

// Lazy-load per-city vibe maps to avoid bundling all 5 cities for every page.
// Each per-city file has 50-180 zips of coverage; combined they cover ~650 zips.
let _cityVibes: Record<string, Record<string, NeighborhoodVibe>> | null = null;
function getCityVibes(): Record<string, Record<string, NeighborhoodVibe>> {
  if (_cityVibes) return _cityVibes;
  // Synchronous require so the function stays sync — Next.js bundles these.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { NYC_VIBES } = require("./vibes/nyc-vibes");
  const { LA_VIBES } = require("./vibes/la-vibes");
  const { CHICAGO_VIBES } = require("./vibes/chicago-vibes");
  const { MIAMI_VIBES } = require("./vibes/miami-vibes");
  const { HOUSTON_VIBES } = require("./vibes/houston-vibes");
  /* eslint-enable @typescript-eslint/no-require-imports */
  _cityVibes = {
    nyc: NYC_VIBES,
    "los-angeles": LA_VIBES,
    chicago: CHICAGO_VIBES,
    miami: MIAMI_VIBES,
    houston: HOUSTON_VIBES,
  };
  return _cityVibes;
}

export function getNeighborhoodVibe(city: string, zipCode: string): NeighborhoodVibe | null {
  // 1. Per-city files (primary source, ~650 zips total)
  const cityMap = getCityVibes()[city];
  if (cityMap?.[zipCode]) return cityMap[zipCode];

  // 2. Inline fallback map (legacy, ~28 zips)
  const inlineDirect = NEIGHBORHOOD_VIBES[city]?.[zipCode];
  if (inlineDirect) return inlineDirect;

  // 3. Alias map for zips that share a neighborhood
  const alias = ZIP_VIBE_ALIASES[city]?.[zipCode];
  if (alias) {
    return cityMap?.[alias] ?? NEIGHBORHOOD_VIBES[city]?.[alias] ?? null;
  }

  return null;
}
