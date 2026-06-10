import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { DEFAULT_CITY, VALID_CITIES, isValidCity, type City } from "@/lib/cities";
import { searchNeighborhoodsByCity } from "@/lib/neighborhoods";
import { SEARCH_SORTS, type SearchSort } from "@/lib/search/query";

/**
 * Natural-language → structured search translation.
 *
 * Calls a small/cheap Claude model with a single forced tool call and parses
 * the result strictly. On ANY failure (no API key, API error, schema
 * mismatch) it returns null so the caller can fall back to plain text search.
 *
 * Cost controls: haiku-class model, ~300 max output tokens, server-side only
 * (the calling route is rate-limited).
 */

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

const NYC_BOROUGHS = [
  "Manhattan",
  "Brooklyn",
  "Queens",
  "Bronx",
  "Staten Island",
] as const;

/** What the model is allowed to return — everything optional, strictly typed. */
const rawParsedSchema = z.object({
  city: z.enum(["nyc", "los-angeles", "chicago", "miami", "houston"]).nullish(),
  borough: z.enum(NYC_BOROUGHS).nullish(),
  neighborhood: z.string().min(1).max(80).nullish(),
  zip: z
    .string()
    .regex(/^\d{5}$/)
    .nullish(),
  keywords: z.string().max(160).nullish(),
  filters: z
    .object({
      rentStabilized: z.boolean().nullish(),
      maxViolations: z.enum(["none", "low"]).nullish(),
      minScore: z.number().min(0).max(5).nullish(),
    })
    .nullish(),
  sort: z.enum(SEARCH_SORTS).nullish(),
});

export interface ParsedNaturalQuery {
  city: City;
  /** NYC borough — only set for city === "nyc". */
  borough: string | null;
  /** Neighborhood name as the user said it (display only). */
  neighborhood: string | null;
  /** ZIP filter — explicit, or resolved from the neighborhood name. */
  zip: string | null;
  /** Free-text remainder for the ranked text search. May be empty. */
  keywords: string;
  filters: {
    rentStabilized: boolean | null;
    maxViolations: "none" | "low" | null;
    minScore: number | null;
  };
  sort: SearchSort;
}

const SYSTEM_PROMPT = `You translate a renter's natural-language apartment search into structured filters for LucidRents building search. Call set_search_filters exactly once.

Rules:
- city: one of ${VALID_CITIES.join(", ")}. Use the default city given in the message unless the query clearly names another supported city.
- borough: ONLY for NYC boroughs (${NYC_BOROUGHS.join(", ")}). Any other neighborhood/area name (e.g. Astoria, Wynwood, Silver Lake) goes in neighborhood.
- zip: only if a 5-digit ZIP code appears in the query.
- filters.rentStabilized: true only if rent-stabilized / rent-controlled / RSO is mentioned.
- filters.maxViolations: "none" for no violations / clean record; "low" for few or minimal violations.
- filters.minScore (0-5): only when a rating bar is implied ("highly rated" / "well reviewed" → 4).
- sort: "score-desc" for best/top-rated, "reviews-desc" for most reviewed, "violations-desc" for worst/most violations, else "relevance".
- keywords: leftover text useful for matching a building ADDRESS or NAME (street, building name). Exclude location names and filter words already captured. Often empty — vibe words like "quiet", "1BR", "cheap" are NOT keywords.
- Never invent values not implied by the query.`;

const SEARCH_TOOL: Anthropic.Tool = {
  name: "set_search_filters",
  description: "Set the structured building-search filters extracted from the query.",
  input_schema: {
    type: "object",
    properties: {
      city: { type: "string", enum: [...VALID_CITIES] },
      borough: { type: "string", enum: [...NYC_BOROUGHS] },
      neighborhood: { type: "string", description: "Neighborhood or area name" },
      zip: { type: "string", description: "5-digit ZIP code" },
      keywords: {
        type: "string",
        description: "Free-text remainder for address/name matching; may be empty",
      },
      filters: {
        type: "object",
        properties: {
          rentStabilized: { type: "boolean" },
          maxViolations: { type: "string", enum: ["none", "low"] },
          minScore: { type: "number", description: "Minimum LucidIQ score, 0-5" },
        },
        additionalProperties: false,
      },
      sort: { type: "string", enum: [...SEARCH_SORTS] },
    },
    additionalProperties: false,
  },
};

/** Normalize the model output into a fully-populated interpretation. */
function normalizeParsed(
  raw: z.infer<typeof rawParsedSchema>,
  defaultCity: City
): ParsedNaturalQuery {
  const city: City = raw.city && isValidCity(raw.city) ? raw.city : defaultCity;
  // borough is an NYC concept in our schema; other cities use neighborhoods.
  const borough = city === "nyc" ? (raw.borough ?? null) : null;
  const neighborhood = raw.neighborhood?.trim() || null;

  let zip = raw.zip ?? null;
  if (!zip && neighborhood) {
    const match = searchNeighborhoodsByCity(neighborhood, city, 1)[0];
    if (match) zip = match.zipCode;
  }

  return {
    city,
    borough,
    neighborhood,
    zip,
    keywords: raw.keywords?.trim() ?? "",
    filters: {
      rentStabilized: raw.filters?.rentStabilized ?? null,
      maxViolations: raw.filters?.maxViolations ?? null,
      minScore: raw.filters?.minScore ?? null,
    },
    sort: raw.sort ?? "relevance",
  };
}

/**
 * Parse a natural-language query into structured search filters.
 * Returns null on any failure so the caller can fall back to plain search.
 */
export async function parseNaturalQuery(
  q: string,
  defaultCity: City = DEFAULT_CITY
): Promise<ParsedNaturalQuery | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: process.env.NL_SEARCH_MODEL || DEFAULT_MODEL,
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      tools: [SEARCH_TOOL],
      tool_choice: {
        type: "tool",
        name: "set_search_filters",
        disable_parallel_tool_use: true,
      },
      messages: [
        {
          role: "user",
          content: `Default city: ${defaultCity}\nQuery: ${q}`,
        },
      ],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );
    if (!toolUse) return null;

    const parsed = rawParsedSchema.safeParse(toolUse.input);
    if (!parsed.success) return null;

    return normalizeParsed(parsed.data, defaultCity);
  } catch {
    // API error, timeout, malformed response — caller falls back to text search.
    return null;
  }
}
