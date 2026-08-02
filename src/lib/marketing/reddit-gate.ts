import { findDataHook, type RedditDataHook } from "./reddit-data-hook";

/**
 * Minimum weighted relevance score required to reply.
 *
 * This is enforced here, server-side. It previously lived only inside the
 * monitor workflow while the draft-batch route accepted a caller-supplied
 * score and never checked it — which is how every reply we have ever posted
 * (scores 0.36 to 0.64) got through a nominal 0.7 bar.
 */
export const MIN_RELEVANCE_SCORE = 0.7;

/**
 * Posts advertising a unit rather than asking for help.
 *
 * These dominate the city apartment subs and are the single biggest source of
 * off-key replies: answering "1BR in East Village, W/D in unit" with violation
 * statistics is unsolicited advertising, no matter how accurate the numbers.
 */
const LISTING_PATTERNS: RegExp[] = [
  /\b(?:ISO|in search of)\b/i,
  /\b(?:sublet|sublease|subletting)\b/i,
  /\bfor rent\b/i,
  /\b(?:available|move[- ]in ready)\s+(?:now|immediately|\w+\s+\d{1,2}|[A-Z][a-z]+\s*\d*)/i,
  /\broommate\s+(?:wanted|needed)\b/i,
  /\bno\s+fee\b/i,
  /\b\d+\s*(?:BR|BD|bed)\s*\/\s*\d+\s*(?:BA|bath)\b/i,
  /\bW\/D in unit\b/i,
  /\$\s?\d[\d,]{2,}\s*(?:\/|\s+per\s+)?(?:mo\b|month)/i,
];

/** Posts that are actually asking something we might be able to answer. */
const HELP_SIGNALS: RegExp[] = [
  /\?/,
  /\b(?:is it legal|can (?:my|a) landlord|what (?:are|should)|how do i|advice|help|anyone know|is this normal|am i (?:being|entitled))\b/i,
  /\b(?:withheld|withholding|refuses?|refused|retaliat|harass|illegal|violation|no heat|no hot water|mold|bed ?bugs|eviction|security deposit)\b/i,
];

export interface GateResult {
  pass: boolean;
  /** Why the thread was rejected — recorded so the skip reasons stay auditable. */
  reason?: string;
  hook?: RedditDataHook;
}

export interface GateCandidate {
  title: string;
  selftext: string;
  subreddit: string;
  relevanceScore: number;
}

/**
 * Decides whether a thread earns a reply.
 *
 * Three independent things must all hold: the thread is asking for help (not
 * advertising), it clears the relevance bar, and we hold a specific fact that
 * speaks to it. Any one of them missing means we say nothing — silence is the
 * correct output for most threads, and the cost of a bad reply (subreddit ban,
 * domain blacklisting) is permanent while the cost of skipping is zero.
 */
export async function evaluateThread(candidate: GateCandidate): Promise<GateResult> {
  const text = `${candidate.title}\n${candidate.selftext ?? ""}`;

  if (!Number.isFinite(candidate.relevanceScore)) {
    return { pass: false, reason: "missing relevance score" };
  }
  if (candidate.relevanceScore < MIN_RELEVANCE_SCORE) {
    return {
      pass: false,
      reason: `relevance ${candidate.relevanceScore.toFixed(2)} < ${MIN_RELEVANCE_SCORE}`,
    };
  }

  const listingHit = LISTING_PATTERNS.find((rx) => rx.test(text));
  if (listingHit) {
    return { pass: false, reason: `listing/ad post (matched ${listingHit})` };
  }

  if (!HELP_SIGNALS.some((rx) => rx.test(text))) {
    return { pass: false, reason: "no question or problem being described" };
  }

  const hook = await findDataHook(candidate.title, candidate.selftext, candidate.subreddit);
  if (!hook) {
    return { pass: false, reason: "no specific LucidRents data covers this thread" };
  }

  return { pass: true, hook };
}
