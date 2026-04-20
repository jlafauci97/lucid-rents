import type { City } from "@/lib/cities";
import { NYC_ZIP_SUBMARKETS } from "./nyc-zip-submarkets";
import { CHICAGO_ZIP_SUBMARKETS } from "./chicago-zip-submarkets";
import { LA_ZIP_SUBMARKETS } from "./la-zip-submarkets";
import { HOUSTON_ZIP_SUBMARKETS } from "./houston-zip-submarkets";
import { MIAMI_ZIP_SUBMARKETS } from "./miami-zip-submarkets";

const BY_CITY: Record<City, Record<string, string>> = {
  "nyc": NYC_ZIP_SUBMARKETS,
  "chicago": CHICAGO_ZIP_SUBMARKETS,
  "los-angeles": LA_ZIP_SUBMARKETS,
  "houston": HOUSTON_ZIP_SUBMARKETS,
  "miami": MIAMI_ZIP_SUBMARKETS,
};

/** Resolve a zip code to its submarket slug for the given city. */
export function submarketSlugForZip(city: City, zip: string | null | undefined): string | null {
  if (!zip) return null;
  const z = zip.trim().slice(0, 5);
  return BY_CITY[city]?.[z] ?? null;
}

export {
  NYC_ZIP_SUBMARKETS,
  CHICAGO_ZIP_SUBMARKETS,
  LA_ZIP_SUBMARKETS,
  HOUSTON_ZIP_SUBMARKETS,
  MIAMI_ZIP_SUBMARKETS,
};
