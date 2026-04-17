export const AMENITY_CATEGORIES = [
  "in-home",
  "building-services",
  "fitness",
  "outdoor",
  "transit-parking",
  "pets",
  "community",
  "security",
  "other",
] as const;

export type AmenityCategory = (typeof AMENITY_CATEGORIES)[number];

// Keyword → category mapping. Case-insensitive substring match.
const CATEGORY_KEYWORDS: Record<Exclude<AmenityCategory, "other">, string[]> = {
  "in-home": [
    "washer",
    "dryer",
    "dishwasher",
    "in-unit",
    "in unit",
    "central air",
    "hardwood",
    "microwave",
    "laundry",
  ],
  "building-services": [
    "doorman",
    "concierge",
    "elevator",
    "superintendent",
    "super",
    "mail room",
    "package",
  ],
  fitness: ["gym", "fitness", "yoga", "sauna", "spa", "pool", "swim"],
  outdoor: [
    "rooftop",
    "roof deck",
    "patio",
    "garden",
    "courtyard",
    "terrace",
    "balcony",
    "outdoor",
  ],
  "transit-parking": ["parking", "garage", "bike", "bicycle", "valet", "car share"],
  pets: ["pet", "dog", "cat"],
  community: [
    "lounge",
    "resident",
    "common area",
    "rec room",
    "game room",
    "coworking",
    "co-working",
    "community",
    "library",
    "screening",
  ],
  security: [
    "security",
    "camera",
    "keyfob",
    "key fob",
    "intercom",
    "alarm",
    "surveillance",
  ],
};

export function categorizeAmenity(name: string): AmenityCategory {
  const lc = (name ?? "").toLowerCase();
  if (!lc) return "other";
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as Array<
    [Exclude<AmenityCategory, "other">, string[]]
  >) {
    if (keywords.some((k) => lc.includes(k))) return cat;
  }
  return "other";
}
