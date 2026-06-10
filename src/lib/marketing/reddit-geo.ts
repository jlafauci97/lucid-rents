// Geographic gating for the Reddit scanner. LucidRents only covers five
// metros (NYC / LA / Chicago / Miami / Houston), so posts from national subs
// or with explicit out-of-state tags must be dropped before we spend tokens
// scoring or drafting them.
//
// NOTE: scripts/scan-and-draft-reddit.mjs (plain Node, runs in GitHub
// Actions) mirrors this logic — it can't import TS. If you change behavior
// here, update the script too. The data both sides use lives in
// reddit-config.json.

import config from "./reddit-config.json";

export const SUPPORTED_GEO_TOKENS: string[] = config.supportedGeoTokens;

/**
 * State codes for the 45 states we DON'T cover. Used to hard-reject a post
 * whose title is tagged like "[MI]" or "[OR] my landlord ...". Bracketed
 * two-letter tags follow the r/legaladvice state-code convention, so "[LA]"
 * means Louisiana here, not Los Angeles. Faster and more reliable than
 * asking the LLM to figure out the geography.
 */
export const UNSUPPORTED_STATE_CODES = new Set<string>(
  config.unsupportedStateCodes
);

/**
 * Reject a post if its title or body is tagged with a US state code we don't
 * cover (e.g. "[MI] my LL ..." or "[CA] [SK] LL gave notice"). Returns true
 * when the post should be DROPPED.
 */
export function hasUnsupportedStateTag(title: string, body: string): boolean {
  const text = `${title} ${body}`;
  // Match bracketed two-letter codes like [MI], [PA], [GA].
  const matches = text.match(/\[([A-Z]{2})\]/g);
  if (!matches) return false;
  for (const m of matches) {
    const code = m.slice(1, 3);
    if (UNSUPPORTED_STATE_CODES.has(code)) return true;
  }
  return false;
}

/**
 * For posts from general (national) subs, require the title or body to
 * explicitly mention one of our metros. Without this, we drown in posts
 * from random states.
 */
export function mentionsSupportedMetro(title: string, body: string): boolean {
  const text = `${title} ${body}`.toLowerCase();
  return SUPPORTED_GEO_TOKENS.some((tok) => {
    // Match as a whole word so "ca" doesn't trigger on "scary".
    const re = new RegExp(`\\b${tok.replace(/\./g, "\\.")}\\b`, "i");
    return re.test(text);
  });
}
