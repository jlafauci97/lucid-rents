// Shared LLM helpers for the Reddit pipeline: relevance scoring and reply
// drafting. Used by BOTH the legacy Vercel workflow (workflows/
// marketing-reddit.ts) and the active GitHub-Actions path
// (/api/marketing/reddit/draft-batch), so the two can never drift on
// quality bar or prompt wording again.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  REDDIT_SYSTEM_PROMPT,
  getSubredditTone,
} from "./brand-voice";

// Minimum weighted relevance score required to keep a candidate.
// 0.5 was too permissive — it let lease-takeover ads, job posts, and
// out-of-state rants through. 0.7 is roughly "this is clearly about a
// renter problem in one of our markets and we can add real value."
export const MIN_RELEVANCE_SCORE = 0.7;

// Posts with geoMatch below this are about a metro we don't cover (or no
// metro at all) and are killed outright, regardless of other scores.
export const MIN_GEO_MATCH = 0.5;

const REDDIT_MODEL = "anthropic/claude-sonnet-4.6";

export interface RedditThreadInput {
  subreddit: string;
  title: string;
  selftext: string;
  score: number;
  numComments: number;
}

export interface RelevanceResult {
  geoMatch: number;
  directRelevance: number;
  valueOpportunity: number;
  naturalFit: number;
  /** geoMatch*0.4 + directRelevance*0.3 + valueOpportunity*0.2 + naturalFit*0.1, rounded to 2dp */
  weighted: number;
  /** geoMatch >= MIN_GEO_MATCH && weighted >= MIN_RELEVANCE_SCORE */
  qualified: boolean;
}

const SCORING_SYSTEM_PROMPT = `You are a relevance scorer for LucidRents, a rental intelligence platform that ONLY covers 5 metros: NYC, Los Angeles, Chicago, Miami, and Houston. Score how relevant a Reddit thread is for a helpful, non-promotional reply that could mention lucidrents.com.

Return ONLY a JSON object with this structure:
{
  "geoMatch": 0.0-1.0,
  "directRelevance": 0.0-1.0,
  "valueOpportunity": 0.0-1.0,
  "naturalFit": 0.0-1.0
}

HARD RULES — give 0.0 on geoMatch (which kills the post) when:
- The post is explicitly about a state or city we don't cover (Denver, San Diego, Seattle, Atlanta, Detroit, anywhere outside NYC/LA/Chicago/Miami/Houston).
- The post is about home buying / mortgages / selling a house — we serve renters, not buyers.
- The post is an apartment listing, sublease ad, lease takeover, or roommate-search ad — these are ads, not problems we can help with.
- The post is unrelated to housing entirely (jobs, jury duty, event tickets, dating, car leases).
- The post is from a national sub (renters / Tenant / realestate / personalfinance) WITHOUT explicitly mentioning NYC/LA/Chicago/Miami/Houston by name.

Scoring criteria (only matters if geoMatch > 0):
- geoMatch (0.4 weight): Is the post about a renter problem in NYC, LA, Chicago, Miami, or Houston? 1.0 = clearly one of our metros. 0.0 = elsewhere or no city mentioned.
- directRelevance (0.3 weight): Renter problem we have data for — landlord violations, building conditions, tenant rights, rent stabilization, eviction, habitability.
- valueOpportunity (0.2 weight): Can we add genuine value by referencing specific data (HPD/LAHD/RLTO records, building violation history, rent law)?
- naturalFit (0.1 weight): Can we mention lucidrents.com without feeling forced?`;

/**
 * Score a thread's relevance via Claude. Returns null when the model output
 * can't be parsed (caller should skip the thread, not fail the batch).
 */
export async function scoreThreadRelevance(
  thread: RedditThreadInput
): Promise<RelevanceResult | null> {
  const { generateText } = await import("ai");

  const result = await generateText({
    model: REDDIT_MODEL as never,
    system: SCORING_SYSTEM_PROMPT,
    prompt: `Subreddit: r/${thread.subreddit}
Title: ${thread.title}
Body: ${thread.selftext.slice(0, 1000)}
Score: ${thread.score} | Comments: ${thread.numComments}`,
    maxOutputTokens: 300,
  });

  let parsed: {
    geoMatch: number;
    directRelevance: number;
    valueOpportunity: number;
    naturalFit: number;
  };
  try {
    let text = result.text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  const weighted =
    Math.round(
      (parsed.geoMatch * 0.4 +
        parsed.directRelevance * 0.3 +
        parsed.valueOpportunity * 0.2 +
        parsed.naturalFit * 0.1) *
        100
    ) / 100;

  return {
    ...parsed,
    weighted,
    qualified:
      parsed.geoMatch >= MIN_GEO_MATCH && weighted >= MIN_RELEVANCE_SCORE,
  };
}

/**
 * If the thread text contains an address-like pattern, look up matching
 * buildings and return a context block for the drafting prompt. Returns ""
 * when nothing matches.
 */
export async function lookupBuildingContext(
  supabase: SupabaseClient,
  text: string
): Promise<string> {
  const addressMatch = text.match(
    /\d+\s+[\w\s]+(?:st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|pl|place|way|ln|lane)\b/i
  );
  if (!addressMatch) return "";

  const { data: buildings } = await supabase
    .from("buildings")
    .select("address, city, violation_count, owner_name")
    .ilike("address", `%${addressMatch[0].trim()}%`)
    .limit(3);

  if (!buildings || buildings.length === 0) return "";

  return `\n\nRELEVANT BUILDING DATA FROM LUCIDRENTS:\n${buildings
    .map(
      (b) =>
        `- ${b.address}, ${b.city}: ${b.violation_count ?? 0} violations, owner: ${b.owner_name ?? "unknown"}`
    )
    .join("\n")}`;
}

/**
 * Draft a Reddit reply for a thread. `guidance` lets a reviewer steer a
 * regeneration ("shorter", "don't mention the site", ...).
 */
export async function draftRedditReply(
  thread: RedditThreadInput,
  buildingContext: string,
  guidance?: string
): Promise<string> {
  const { generateText } = await import("ai");

  const result = await generateText({
    model: REDDIT_MODEL as never,
    system:
      REDDIT_SYSTEM_PROMPT +
      `\n\nSUBREDDIT TONE for r/${thread.subreddit}: ${getSubredditTone(thread.subreddit)}`,
    prompt: `THREAD in r/${thread.subreddit}:
Title: ${thread.title}
Body: ${thread.selftext}
Thread score: ${thread.score} | Comments: ${thread.numComments}
${buildingContext}

Write a helpful Reddit reply. Lead with value. Be genuine. If there is relevant building data above, weave it in naturally. Only mention lucidrents.com if it fits as a natural next step (e.g., "you can look up any building's violation history at lucidrents.com").${
      guidance ? `\n\nREVIEWER GUIDANCE for this draft: ${guidance}` : ""
    }

Reply:`,
    maxOutputTokens: 800,
  });

  return result.text.trim();
}
