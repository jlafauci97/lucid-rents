import { generateText } from "ai";
import { marketingModel } from "@/lib/marketing/ai-model";
import { REDDIT_KEYWORDS } from "./brand-voice";

/**
 * Relevance scoring for Reddit candidates.
 *
 * Lives here rather than in the monitor workflow because scanning now happens
 * off-platform (Reddit blocks datacenter IPs), and a score supplied by the
 * caller is not a score — it has to be computed somewhere we control.
 *
 * Note the metro list is NYC only. LA/Chicago (August 2026) and Miami/Houston were pulled
 * from public view, so a reply pointing at them would link to pages that are
 * not live.
 */
const SCORING_SYSTEM_PROMPT = `You are a relevance scorer for LucidRents, a rental intelligence platform that ONLY covers New York City. Score how relevant a Reddit thread is for a helpful, non-promotional reply that could mention lucidrents.com.

Return ONLY a JSON object with this structure:
{
  "geoMatch": 0.0-1.0,
  "directRelevance": 0.0-1.0,
  "valueOpportunity": 0.0-1.0,
  "naturalFit": 0.0-1.0
}

HARD RULES — give 0.0 on geoMatch (which kills the post) when:
- The post is explicitly about a city we don't cover (LA, Chicago, Miami, Houston, Denver, San Diego, Seattle, Atlanta, Detroit — anywhere outside NYC).
- The post is about home buying / mortgages / selling a house — we serve renters, not buyers.
- The post is an apartment listing, sublease ad, lease takeover, or roommate-search ad — these are ads, not problems we can help with.
- The post is unrelated to housing entirely (jobs, jury duty, event tickets, dating, car leases).
- The post is from a national sub (renters / Tenant / realestate / personalfinance) WITHOUT explicitly mentioning NYC by name.

Scoring criteria (only matters if geoMatch > 0):
- geoMatch (0.4 weight): Is the post about a renter problem in NYC? 1.0 = clearly NYC. 0.0 = elsewhere or no city mentioned.
- directRelevance (0.3 weight): Renter problem we have data for — landlord violations, building conditions, tenant rights, rent stabilization, eviction, habitability.
- valueOpportunity (0.2 weight): Can we add genuine value by referencing specific data (HPD/LAHD/RLTO records, building violation history, rent law)?
- naturalFit (0.1 weight): Can we mention lucidrents.com without feeling forced?`;

export interface ScoredThread {
  relevanceScore: number;
  keywordsMatched: string[];
}

/**
 * Scores one thread. Returns null when the post fails the geographic hard
 * rule, which is a rejection rather than a low score — a Denver post with a
 * vivid habitability problem should never be rescued by its other dimensions.
 */
export async function scoreThread(candidate: {
  subreddit: string;
  title: string;
  selftext: string;
  score?: number;
  numComments?: number;
}): Promise<ScoredThread | null> {
  const result = await generateText({
    model: marketingModel(),
    system: SCORING_SYSTEM_PROMPT,
    prompt: `Subreddit: r/${candidate.subreddit}
Title: ${candidate.title}
Body: ${(candidate.selftext ?? "").slice(0, 1000)}
Score: ${candidate.score ?? 0} | Comments: ${candidate.numComments ?? 0}`,
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

  if (!(parsed.geoMatch >= 0.5)) return null;

  const weighted =
    parsed.geoMatch * 0.4 +
    parsed.directRelevance * 0.3 +
    parsed.valueOpportunity * 0.2 +
    parsed.naturalFit * 0.1;

  const combined = `${candidate.title} ${candidate.selftext ?? ""}`.toLowerCase();
  const keywordsMatched = REDDIT_KEYWORDS.map((k) => k.toLowerCase()).filter((kw) =>
    combined.includes(kw)
  );

  return {
    relevanceScore: Math.round(weighted * 100) / 100,
    keywordsMatched,
  };
}
