import type { City } from "@/lib/cities";

/**
 * Chip = one of the "best buildings by category" filters.
 * Each chip has a slug used in URLs and a filter applied to the buildings table.
 */
export type ChipId =
  | "top-rated"
  | "rent-stabilized"
  | "most-reviewed"
  | "no-violations"
  | "large-buildings";

export interface Chip {
  id: ChipId;
  /** URL slug — same as id */
  slug: ChipId;
  /** Short label for cards */
  label: string;
  /** One-sentence description for index card + detail header */
  description: string;
  /** Longer copy for the detail page hero */
  long_description: string;
  /** Cities this chip is available for. 'all' = every city. */
  cities: City[] | "all";
  /** Supabase column filters. Applied to buildings query. */
  column_filters: Array<{ column: string; op: "eq" | "gte" | "lte" | "gt" | "lt"; value: unknown }>;
  /** Default sort column + direction. */
  sort: { column: string; ascending: boolean };
  /** Background hint for the card image (loremflickr query). */
  image_hint: string;
}

export const CHIPS: Record<ChipId, Chip> = {
  "top-rated": {
    id: "top-rated",
    slug: "top-rated",
    label: "Top-rated",
    description: "A-grade buildings, ranked by LucidIQ.",
    long_description:
      "Buildings with a LucidIQ score of 4.0 or higher — strong tenant reviews and a clean public-data record.",
    cities: "all",
    column_filters: [
      { column: "overall_score", op: "gte", value: 4.0 },
      { column: "review_count", op: "gte", value: 5 },
    ],
    sort: { column: "overall_score", ascending: false },
    image_hint: "luxury apartment",
  },
  "rent-stabilized": {
    id: "rent-stabilized",
    slug: "rent-stabilized",
    label: "Rent-stabilized",
    description: "Protected from aggressive rent hikes.",
    long_description:
      "Every rent-stabilized building in the city, covered by state or local rent-stabilization law. We flag these so you know your renewal can't be priced out from under you.",
    cities: ["nyc", "los-angeles"],
    column_filters: [{ column: "is_rent_stabilized", op: "eq", value: true }],
    sort: { column: "overall_score", ascending: false },
    image_hint: "brownstone apartment",
  },
  "most-reviewed": {
    id: "most-reviewed",
    slug: "most-reviewed",
    label: "Most-reviewed",
    description: "Buildings our community has the most to say about.",
    long_description:
      "Buildings with at least 5 verified tenant reviews. More reviews = higher confidence in the LucidIQ score.",
    cities: "all",
    column_filters: [{ column: "review_count", op: "gte", value: 5 }],
    sort: { column: "review_count", ascending: false },
    image_hint: "apartment lobby",
  },
  "no-violations": {
    id: "no-violations",
    slug: "no-violations",
    label: "No violations",
    description: "Clean public record, no open code violations.",
    long_description:
      "Buildings with zero open housing-code violations and at least one tenant review on file.",
    cities: "all",
    column_filters: [
      { column: "violation_count", op: "eq", value: 0 },
      { column: "review_count", op: "gte", value: 1 },
    ],
    sort: { column: "overall_score", ascending: false },
    image_hint: "modern apartment",
  },
  "large-buildings": {
    id: "large-buildings",
    slug: "large-buildings",
    label: "Large buildings",
    description: "50+ unit buildings with full amenities.",
    long_description:
      "Bigger buildings (50+ residential units), usually with doormen, elevators, and shared amenities.",
    cities: "all",
    column_filters: [{ column: "residential_units", op: "gte", value: 50 }],
    sort: { column: "residential_units", ascending: false },
    image_hint: "high-rise apartment tower",
  },
};

export const ALL_CHIPS: ChipId[] = Object.keys(CHIPS) as ChipId[];

/** Returns chips available for a given city. */
export function chipsForCity(city: City): Chip[] {
  return ALL_CHIPS.map((id) => CHIPS[id]).filter((c) =>
    c.cities === "all" ? true : c.cities.includes(city),
  );
}

/** Validates a chip slug against the city. */
export function isValidChipForCity(chip: string, city: City): chip is ChipId {
  if (!(chip in CHIPS)) return false;
  const c = CHIPS[chip as ChipId];
  return c.cities === "all" || c.cities.includes(city);
}
