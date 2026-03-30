/**
 * Address abbreviation normalization for search.
 *
 * PostgreSQL full-text search treats "W" and "West" as different tokens.
 * Our DB stores addresses in abbreviated form (e.g., "254 W 51ST ST").
 * Users may type either form.
 *
 * Strategy: produce TWO versions of the query — one with all abbreviations
 * expanded to full words, and one with all full words contracted to abbreviations.
 * The SQL function ORs both tsqueries together so either form matches.
 */

// Direction abbreviations
const DIRECTION_MAP: Record<string, string> = {
  n: "north",
  s: "south",
  e: "east",
  w: "west",
  ne: "northeast",
  nw: "northwest",
  se: "southeast",
  sw: "southwest",
};

// Street type abbreviations (abbreviation -> full form)
const STREET_TYPE_MAP: Record<string, string> = {
  st: "street",
  ave: "avenue",
  av: "avenue",
  blvd: "boulevard",
  dr: "drive",
  ln: "lane",
  rd: "road",
  ct: "court",
  pl: "place",
  ter: "terrace",
  terr: "terrace",
  cir: "circle",
  pkwy: "parkway",
  hwy: "highway",
  sq: "square",
  aly: "alley",
  brg: "bridge",
  crk: "creek",
  xing: "crossing",
  hl: "hill",
  hls: "hills",
  pt: "point",
  trl: "trail",
  vw: "view",
  wy: "way",
};

// Build reverse maps (full form -> abbreviation)
const REVERSE_DIRECTION_MAP: Record<string, string> = {};
for (const [abbr, full] of Object.entries(DIRECTION_MAP)) {
  REVERSE_DIRECTION_MAP[full] = abbr;
}

const REVERSE_STREET_TYPE_MAP: Record<string, string> = {};
for (const [abbr, full] of Object.entries(STREET_TYPE_MAP)) {
  // Only keep the first abbreviation for each full form
  if (!REVERSE_STREET_TYPE_MAP[full]) {
    REVERSE_STREET_TYPE_MAP[full] = abbr;
  }
}

/**
 * Convert a token to its abbreviated form (or return as-is).
 * "West" -> "W", "Street" -> "St", "21st" -> "21st" (unchanged)
 */
function toAbbreviated(token: string): string {
  const lower = token.toLowerCase();
  if (REVERSE_DIRECTION_MAP[lower]) return REVERSE_DIRECTION_MAP[lower];
  if (REVERSE_STREET_TYPE_MAP[lower]) return REVERSE_STREET_TYPE_MAP[lower];
  return token;
}

/**
 * Convert a token to its expanded form (or return as-is).
 * "W" -> "West", "St" -> "Street", "21st" -> "21st" (unchanged)
 */
function toExpanded(token: string): string {
  const lower = token.toLowerCase();
  if (DIRECTION_MAP[lower]) return DIRECTION_MAP[lower];
  if (STREET_TYPE_MAP[lower]) return STREET_TYPE_MAP[lower];
  return token;
}

// Ordinal suffixes that users might split from numbers: "21 st" -> "21st"
const ORDINAL_SUFFIXES = new Set(["st", "nd", "rd", "th"]);

/**
 * Pre-process tokens to rejoin split ordinals.
 * Handles cases like "21 st" -> "21st", "3 rd" -> "3rd"
 * This runs before abbreviation expansion so "21 st" doesn't get
 * confused with "st" meaning "street".
 */
function rejoinSplitOrdinals(tokens: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i];
    const next = tokens[i + 1]?.toLowerCase();
    // If current token is a number and next is an ordinal suffix, merge them
    if (/^\d+$/.test(current) && next && ORDINAL_SUFFIXES.has(next)) {
      result.push(current + tokens[i + 1]);
      i++; // skip the suffix token
    } else {
      result.push(current);
    }
  }
  return result;
}

/**
 * Produce both abbreviated and expanded versions of an address query.
 *
 * Returns an object with two strings — the caller should search with both
 * (typically OR'd together in the DB query).
 *
 * Also handles fuzzy inputs:
 *   - Split ordinals: "21 st" -> "21st"
 *   - Abbreviation expansion: "W" -> "West", "St" -> "Street"
 *   - Abbreviation contraction: "West" -> "W", "Street" -> "St"
 *
 * Example:
 *   normalizeAddressQuery("319 west 21 st")
 *   => { abbreviated: "319 w 21st st", expanded: "319 west 21st street" }
 */
export function normalizeAddressQuery(query: string): {
  abbreviated: string;
  expanded: string;
} {
  if (!query || !query.trim()) return { abbreviated: query, expanded: query };

  // First rejoin split ordinals ("21 st" -> "21st") before abbreviation mapping
  const tokens = rejoinSplitOrdinals(query.trim().split(/\s+/));

  const abbreviated = tokens.map(toAbbreviated).join(" ");
  const expanded = tokens.map(toExpanded).join(" ");

  return { abbreviated, expanded };
}
