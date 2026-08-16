import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * Model used for marketing draft generation (Reddit replies, content posts).
 *
 * Two paths on purpose: the Vercel AI Gateway string works with the team's
 * OIDC auth and no key management, but the gateway's free tier stopped
 * serving this model (every draft failed with "Free tier users do not have
 * access to this model" — the reason no Reddit reply drafts were generated
 * after early August 2026). When ANTHROPIC_API_KEY is present in the
 * environment, use the Anthropic API directly and bypass gateway billing
 * entirely; otherwise fall back to the gateway, which works again if the
 * team tops up gateway credits.
 */
export function marketingModel(): LanguageModel {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const anthropic = createAnthropic({ apiKey });
    return anthropic("claude-sonnet-4-6");
  }
  return "anthropic/claude-sonnet-4.6" as never;
}
