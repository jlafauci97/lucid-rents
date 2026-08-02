import { createAdminClient } from "@/lib/supabase/admin";
import { VALID_CITIES, CITY_META, type City } from "@/lib/cities";
import { getAllNeighborhoodsByCity } from "@/lib/neighborhoods";
import { TARGET_SUBREDDITS } from "@/lib/marketing/brand-voice";
import { buildingUrl, landlordUrl, neighborhoodUrl, canonicalUrl } from "@/lib/seo";

/**
 * A concrete, checkable fact from our own data that a reply can be built on.
 *
 * The rule this type exists to enforce: we only reply to a thread when we can
 * say something specific that nobody else in the thread can say. Generic legal
 * advice is what every other commenter is already posting — it reads as spam,
 * adds nothing, and is what got earlier replies written about California law
 * on threads we had no business answering.
 */
export interface RedditDataHook {
  kind: "building" | "landlord" | "neighborhood";
  /** Human label for the matched entity, e.g. "1520 Sedgwick Ave". */
  label: string;
  /** The specific number the reply must cite. */
  stat: string;
  /** Absolute URL to the page backing the stat. */
  url: string;
  city: City;
}

/** Cities that are actually live on the public site. */
const LIVE_CITIES = VALID_CITIES;

/** ZIP codes appearing in the text, e.g. "11221". */
function extractZips(text: string): string[] {
  return [...new Set(text.match(/\b\d{5}\b/g) ?? [])];
}

/**
 * Street addresses like "1520 Sedgwick Ave" or "425 W 45th Street".
 * Deliberately strict — a loose pattern matches dates, prices and apartment
 * numbers, and a wrong building is worse than no reply.
 */
function extractAddresses(text: string): string[] {
  const rx =
    /\b(\d{1,5}\s+(?:[NSEW]\.?\s+)?(?:[A-Z][a-z]+|\d+(?:st|nd|rd|th))(?:\s+[A-Z][a-z]+)?\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Place|Pl|Lane|Ln|Parkway|Pkwy|Court|Ct|Terrace|Ter)\b)/g;
  return [...new Set(text.match(rx) ?? [])].slice(0, 3);
}

/**
 * Which of our live cities the thread is about.
 *
 * A city-specific subreddit settles it on its own — someone posting "Bushwick"
 * in r/NYCapartments never writes the word "NYC", so requiring the text to name
 * the city would throw away most of the threads worth answering.
 */
function inferCities(text: string, subreddit?: string): City[] {
  if (subreddit) {
    const sub = subreddit.toLowerCase();
    for (const city of LIVE_CITIES) {
      const subs = TARGET_SUBREDDITS[city] ?? [];
      if (subs.some((s) => s.toLowerCase() === sub)) return [city];
    }
  }

  const lower = text.toLowerCase();
  const hits: City[] = [];
  for (const city of LIVE_CITIES) {
    const meta = CITY_META[city];
    const tokens = [
      meta.name.toLowerCase(),
      meta.fullName.toLowerCase(),
      ...meta.regions.map((r) => r.toLowerCase()),
    ];
    if (tokens.some((t) => lower.includes(t))) hits.push(city);
  }
  return hits;
}

function pluralize(n: number, word: string): string {
  return `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Neighborhood names, longest first so "East Village" wins over "Village".
 * Built once per process — the underlying maps are static module data.
 */
let neighborhoodIndex: Array<{ name: string; zipCode: string; city: City }> | null = null;

function getNeighborhoodIndex(): Array<{ name: string; zipCode: string; city: City }> {
  if (neighborhoodIndex) return neighborhoodIndex;
  const all: Array<{ name: string; zipCode: string; city: City }> = [];
  for (const city of LIVE_CITIES) {
    for (const n of getAllNeighborhoodsByCity(city)) {
      // Very short names ("SoHo" is fine, but 3 chars or fewer produces
      // false hits inside ordinary words) are not worth the false positives.
      if (n.name.length < 4) continue;
      all.push({ name: n.name, zipCode: n.zipCode, city });
    }
  }
  all.sort((a, b) => b.name.length - a.name.length);
  neighborhoodIndex = all;
  return all;
}

/** Neighborhoods explicitly named in the text, most specific first. */
function extractNeighborhoods(
  text: string,
  cities: City[]
): Array<{ name: string; zipCode: string; city: City }> {
  const lower = text.toLowerCase();
  const hits: Array<{ name: string; zipCode: string; city: City }> = [];
  for (const entry of getNeighborhoodIndex()) {
    if (!cities.includes(entry.city)) continue;
    // Word-boundary match so "Chelsea" doesn't fire inside "Chelseafc".
    const rx = new RegExp(`\\b${entry.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    if (rx.test(lower)) hits.push(entry);
    if (hits.length >= 3) break;
  }
  return hits;
}

/**
 * Looks for something real in our database to anchor a reply to.
 *
 * Returns null when we have nothing specific to add — the caller must treat
 * that as "skip this thread", not "reply generically".
 */
export async function findDataHook(
  title: string,
  selftext: string,
  subreddit?: string
): Promise<RedditDataHook | null> {
  const text = `${title}\n${selftext}`;
  const cities = inferCities(text, subreddit);
  if (cities.length === 0) return null;

  const supabase = createAdminClient();
  const cityFilter = cities;

  // 1. A specific building beats everything else — it is the most concrete
  //    thing we can offer and the hardest for anyone else to look up.
  for (const address of extractAddresses(text)) {
    const { data } = await supabase
      .from("buildings")
      .select("slug, borough, full_address, violation_count, metro")
      .in("metro", cityFilter)
      .ilike("full_address", `${address}%`)
      .not("slug", "is", null)
      .order("violation_count", { ascending: false, nullsFirst: false })
      .limit(1);

    const b = data?.[0];
    if (b?.slug) {
      const city = (b.metro as City) ?? cities[0];
      if (!LIVE_CITIES.includes(city)) continue;
      return {
        kind: "building",
        label: b.full_address as string,
        stat: `${pluralize((b.violation_count as number) ?? 0, "open violation")} on record`,
        url: canonicalUrl(
          buildingUrl({ borough: b.borough as string, slug: b.slug as string }, city)
        ),
        city,
      };
    }
  }

  // 2. A neighborhood the thread named, by ZIP or by name. Names carry far
  //    more often than ZIPs in practice — people write "Bushwick", not "11221".
  const areaCandidates: Array<{ zip: string; label: string; city: City }> = [
    ...extractZips(text).map((zip) => ({ zip, label: `ZIP ${zip}`, city: cities[0] })),
    ...extractNeighborhoods(text, cities).map((n) => ({
      zip: n.zipCode,
      label: n.name,
      city: n.city,
    })),
  ];

  for (const area of areaCandidates) {
    const { data } = await supabase
      .from("buildings")
      .select("zip_code, violation_count, metro")
      .in("metro", cityFilter)
      .eq("zip_code", area.zip)
      .limit(500);

    if (data && data.length >= 5) {
      const city = (data[0].metro as City) ?? area.city;
      if (!LIVE_CITIES.includes(city)) continue;
      const total = data.reduce(
        (sum, r) => sum + (((r.violation_count as number) ?? 0) || 0),
        0
      );
      if (total <= 0) continue;
      return {
        kind: "neighborhood",
        label: area.label,
        stat: `${pluralize(data.length, "building")} tracked, ${pluralize(total, "violation")} between them`,
        url: canonicalUrl(neighborhoodUrl(area.zip, city)),
        city,
      };
    }
  }

  // 3. A landlord or management company named in the post.
  const quoted = [...text.matchAll(/"([A-Z][\w&.\- ]{4,40})"/g)].map((m) => m[1]);
  const mgmt = [...text.matchAll(/\b([A-Z][\w&.\-]+(?:\s+[A-Z][\w&.\-]+){0,3}\s+(?:Management|Properties|Realty|LLC|Holdings|Group))\b/g)].map(
    (m) => m[1]
  );
  for (const name of [...new Set([...quoted, ...mgmt])].slice(0, 3)) {
    const { data } = await supabase
      .from("buildings")
      .select("owner_name, violation_count, metro")
      .in("metro", cityFilter)
      .ilike("owner_name", `%${name}%`)
      .limit(200);

    if (data && data.length > 0) {
      const city = (data[0].metro as City) ?? cities[0];
      if (!LIVE_CITIES.includes(city)) continue;
      const owner = data[0].owner_name as string;
      const total = data.reduce(
        (sum, r) => sum + (((r.violation_count as number) ?? 0) || 0),
        0
      );
      if (total <= 0) continue;
      return {
        kind: "landlord",
        label: owner,
        stat: `${pluralize(data.length, "building")} on file, ${pluralize(total, "violation")} across them`,
        url: canonicalUrl(landlordUrl(owner, city)),
        city,
      };
    }
  }

  return null;
}
