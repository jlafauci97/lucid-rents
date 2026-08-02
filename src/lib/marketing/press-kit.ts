import { createAdminClient } from "@/lib/supabase/admin";
import { VALID_CITIES, CITY_META, type City } from "@/lib/cities";
import { getAllNeighborhoodsByCity } from "@/lib/neighborhoods";
import { buildingUrl, landlordUrl, canonicalUrl } from "@/lib/seo";

/**
 * Press kits: when a landlord we hold records on turns up in the news, assemble
 * what we know so it can be offered to the reporter covering it.
 *
 * The entire value of this depends on never being wrong. A kit asserts that a
 * named company appeared in a specific article; a false match is a claim we
 * would have to retract to a journalist, which costs more than every kit we
 * would ever send is worth. So the matcher is deliberately conservative and
 * everything it produces is a draft for a human to read.
 */

export interface PressKitStats {
  buildings: number;
  violations: number;
  worstBuilding: { address: string; url: string; violations: number } | null;
  landlordUrl: string;
}

export interface PressKit {
  articleId: string;
  articleTitle: string;
  articleUrl: string | null;
  sourceName: string | null;
  city: City;
  ownerName: string;
  matchedOn: string;
  confidence: number;
  stats: PressKitStats;
  body: string;
}

/**
 * Corporate boilerplate — present in most entity names, identifies none of them.
 */
const GENERIC_NAME_TOKENS = new Set([
  "the", "and", "of", "at", "new", "for",
  "related", "standard", "premier", "quality", "american", "national", "united",
  "first", "best", "metro", "urban", "central", "main", "shares", "acres",
  "properties", "property", "management", "realty", "holdings", "group",
  "associates", "partners", "development", "developm", "housing", "apartments",
  "llc", "inc", "corp", "company", "co", "lp", "trust", "fund", "capital",
  "equities", "preservation", "residential", "tower", "towers", "plaza",
  "gardens", "house", "houses", "court", "manor", "village", "story", "square",
]);

/**
 * Place names, built from our own neighborhood and borough data.
 *
 * This is the reason the first version of this matcher had zero precision.
 * Real-estate entities are overwhelmingly named after where they are — "South
 * Side Shares", "East River Preservation", "Staten Island 18 Acres" — and local
 * news mentions those same places constantly, about anything. Matching on a
 * place name inside a company name asserts a company appeared in a story about
 * a swimming pool.
 *
 * A place token can therefore never be the evidence; it can only ever be
 * context around a token that is genuinely distinctive.
 */
let placeTokens: Set<string> | null = null;

function getPlaceTokens(): Set<string> {
  if (placeTokens) return placeTokens;
  const s = new Set<string>();
  for (const city of VALID_CITIES) {
    const meta = CITY_META[city];
    for (const label of [meta.name, meta.fullName, meta.state, ...meta.regions]) {
      for (const t of label.toLowerCase().split(/\s+/)) s.add(t);
    }
    for (const n of getAllNeighborhoodsByCity(city)) {
      for (const t of n.name.toLowerCase().split(/[\s/-]+/)) s.add(t);
      for (const t of n.region.toLowerCase().split(/[\s/-]+/)) s.add(t);
    }
  }
  // Compass and geography words that pair with place names.
  for (const t of ["north", "south", "east", "west", "side", "river", "park", "island", "heights", "hill", "hills", "bay", "beach", "lake", "valley", "avenue", "street", "road", "boulevard"]) {
    s.add(t);
  }
  placeTokens = s;
  return s;
}

/** Words in an owner name that carry no identifying information on their own. */
function isNoiseToken(t: string): boolean {
  return t.length < 4 || GENERIC_NAME_TOKENS.has(t) || getPlaceTokens().has(t);
}

/**
 * Tokens that actually identify an owner — corporate boilerplate and place
 * names removed. "LINDEN PLAZA HOUSING CO., INC." reduces to ["linden"];
 * "SOUTH SIDE SHARES II LLC" reduces to nothing, which is the correct answer.
 */
function distinctiveTokens(ownerName: string): string[] {
  return ownerName
    .toLowerCase()
    .replace(/[.,'"()]/g, " ")
    .split(/\s+/)
    .filter((t) => !isNoiseToken(t));
}

/**
 * Whether an article names this owner specifically.
 *
 * The name must contribute at least one token that is neither boilerplate nor a
 * place, and that token has to appear in the article. Entities whose whole name
 * is geography ("Staten Island 18 Acres LLC") are unmatchable by design — there
 * is no wording that would distinguish a story about them from a story about
 * the neighbourhood they are named after.
 */
function matchOwner(
  text: string,
  ownerName: string
): { matched: boolean; on: string; confidence: number } {
  const tokens = distinctiveTokens(ownerName);
  if (tokens.length === 0) return { matched: false, on: "", confidence: 0 };

  const haystack = text.toLowerCase();
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Two or more consecutive distinctive words, or nothing.
  //
  // Single-token matching was tried and is not salvageable: "SECRETARY OF
  // HOUSING" matched a story about the Secretary of State, "SPARTAN FUNDING"
  // matched "cut funding", and five separate Vanowen LLCs all matched an
  // article about a different address on the same street. One ordinary word is
  // never evidence that a specific company is the subject of a story.
  for (let len = Math.min(tokens.length, 4); len >= 2; len--) {
    for (let start = 0; start + len <= tokens.length; start++) {
      const phrase = tokens.slice(start, start + len).join(" ");
      if (new RegExp(`\\b${esc(phrase)}\\b`).test(haystack)) {
        return { matched: true, on: phrase, confidence: Math.min(0.75 + 0.1 * len, 0.95) };
      }
    }
  }

  return { matched: false, on: "", confidence: 0 };
}

/**
 * Street addresses in article text, e.g. "14430 Vanowen St".
 *
 * This is the signal that actually works. A street number is a strong
 * discriminator — an article naming "2344 Davidson Avenue" is about that
 * building, in a way that no company-name token ever establishes.
 */
export function extractAddresses(text: string): string[] {
  const rx =
    /\b(\d{1,5})\s+((?:[NSEW]\.?\s+)?(?:[A-Z][a-zA-Z]+|\d+(?:st|nd|rd|th))(?:\s+[A-Z][a-zA-Z]+)?)\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Place|Pl|Lane|Ln|Parkway|Pkwy|Court|Ct|Terrace|Ter)\b/g;
  const out = new Set<string>();
  for (const m of text.matchAll(rx)) {
    out.add(`${m[1]} ${m[2]}`.replace(/\s+/g, " ").trim());
  }
  return [...out].slice(0, 5);
}

/** Minimum confidence worth putting in front of a human. */
export const MIN_PRESS_CONFIDENCE = 0.7;

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

function buildBody(kit: Omit<PressKit, "body">): string {
  const { ownerName, stats, articleTitle, sourceName, city } = kit;
  const cityName = CITY_META[city].fullName;

  return [
    `Re: "${articleTitle}"${sourceName ? ` (${sourceName})` : ""}`,
    "",
    `We maintain ${cityName} building violation records and hold data on ${ownerName}, which appears in the piece above. In case it is useful:`,
    "",
    `- ${fmt(stats.buildings)} building${stats.buildings === 1 ? "" : "s"} on file`,
    `- ${fmt(stats.violations)} open violation${stats.violations === 1 ? "" : "s"} across the portfolio`,
    stats.worstBuilding
      ? `- Worst single property: ${stats.worstBuilding.address}, ${fmt(stats.worstBuilding.violations)} violations — ${stats.worstBuilding.url}`
      : null,
    `- Full record: ${stats.landlordUrl}`,
    "",
    `All figures come from public records and are linked to their source on each page. Happy to pull anything more specific.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Scans recent articles for landlords we track.
 *
 * Only considers owners with a real portfolio — a company with one building and
 * two violations is not a story, and including it would bury the ones that are.
 */
export async function findPressKits(options: { sinceHours?: number; limit?: number } = {}) {
  const sinceHours = options.sinceHours ?? 48;
  const supabase = createAdminClient();

  const since = new Date(Date.now() - sinceHours * 3600_000).toISOString();
  const { data: articles, error: articlesError } = await supabase
    .from("news_articles")
    .select("id, title, body, url, source_name, metro, published_at")
    .gte("published_at", since)
    .in("metro", VALID_CITIES)
    .order("published_at", { ascending: false })
    .limit(options.limit ?? 200);

  if (articlesError) throw articlesError;
  if (!articles || articles.length === 0) return [];

  const kits: PressKit[] = [];

  // Candidate owners, per city, that are substantial enough to be newsworthy.
  const ownersByCity = new Map<City, Map<string, { buildings: number; violations: number }>>();
  for (const city of VALID_CITIES) {
    const { data } = await supabase
      .from("buildings")
      .select("owner_name, violation_count")
      .eq("metro", city)
      .not("owner_name", "is", null)
      .gt("violation_count", 20)
      .order("violation_count", { ascending: false, nullsFirst: false })
      .limit(2000);

    const byOwner = new Map<string, { buildings: number; violations: number }>();
    for (const b of data ?? []) {
      const name = (b.owner_name as string).trim();
      if (!name) continue;
      const e = byOwner.get(name) ?? { buildings: 0, violations: 0 };
      e.buildings += 1;
      e.violations += (b.violation_count as number) ?? 0;
      byOwner.set(name, e);
    }
    ownersByCity.set(city, byOwner);
  }

  for (const article of articles) {
    const city = article.metro as City;
    const owners = ownersByCity.get(city);
    if (!owners) continue;

    const text = `${article.title ?? ""}\n${article.body ?? ""}`;
    if (text.trim().length < 40) continue;

    // Address hits first — a street number identifies a building in a way no
    // company-name token does.
    const hits = new Map<string, { on: string; confidence: number }>();

    for (const address of extractAddresses(text)) {
      const { data: matched } = await supabase
        .from("buildings")
        .select("owner_name")
        .eq("metro", city)
        .ilike("full_address", `${address}%`)
        .not("owner_name", "is", null)
        .limit(1);

      const owner = matched?.[0]?.owner_name as string | undefined;
      if (owner && owners.has(owner.trim())) {
        hits.set(owner.trim(), { on: address, confidence: 0.95 });
      }
    }

    for (const [ownerName] of owners) {
      if (hits.has(ownerName)) continue;
      const m = matchOwner(text, ownerName);
      if (m.matched && m.confidence >= MIN_PRESS_CONFIDENCE) {
        hits.set(ownerName, { on: m.on, confidence: m.confidence });
      }
    }

    for (const [ownerName, m] of hits) {
      const agg = owners.get(ownerName);
      if (!agg) continue;

      const { data: worst } = await supabase
        .from("buildings")
        .select("full_address, slug, borough, violation_count")
        .eq("metro", city)
        .eq("owner_name", ownerName)
        .not("slug", "is", null)
        .order("violation_count", { ascending: false, nullsFirst: false })
        .limit(1);

      const w = worst?.[0];
      const stats: PressKitStats = {
        buildings: agg.buildings,
        violations: agg.violations,
        worstBuilding: w
          ? {
              address: w.full_address as string,
              url: canonicalUrl(
                buildingUrl({ borough: w.borough as string, slug: w.slug as string }, city)
              ),
              violations: (w.violation_count as number) ?? 0,
            }
          : null,
        landlordUrl: canonicalUrl(landlordUrl(ownerName, city)),
      };

      const partial = {
        articleId: article.id as string,
        articleTitle: article.title as string,
        articleUrl: (article.url as string) ?? null,
        sourceName: (article.source_name as string) ?? null,
        city,
        ownerName,
        matchedOn: m.on,
        confidence: m.confidence,
        stats,
      };

      kits.push({ ...partial, body: buildBody(partial) });
    }
  }

  return kits;
}
