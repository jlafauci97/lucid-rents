import Anthropic from "@anthropic-ai/sdk";
import type { City } from "@/lib/cities";
import type { CityNewsConfig } from "@/lib/news/cities-news";
import type { SignalCandidate } from "./templates/types";

export interface DraftedArticle {
  title: string;
  excerpt: string;
  body: string;
  category: "Rental Market" | "Tenant Rights" | "Data" | "Guide";
  image_query: string;
}

const MODEL = "claude-sonnet-4-6";

const BASE_EDITOR_PROMPT = `You are a staff editor for Lucid Rents, a rental-intelligence platform.
You write like The Real Deal, Crain's, or Bloomberg — short, factual, evidence-first.

Hard rules:
- Never invent numbers. Only use data from the <signal> block in the user message.
- No clickbait. No AI filler words ("delve", "in the realm of", "game-changer", "unprecedented").
- Title: ≤70 characters. Specific and falsifiable.
- Excerpt: ≤160 characters. One sentence. Plain English.
- Body: 250–400 words in markdown. Lead with the number. One paragraph of context. Close with what it means for renters.
- No quotes you didn't receive. No made-up spokespeople.
- Category must be exactly one of: "Rental Market", "Tenant Rights", "Data", "Guide".
- image_query: 2–4 words for a stock photo search (no proper nouns if possible).

Output format — always a single JSON object with keys:
title, excerpt, body, category, image_query.`;

export async function draftArticle({
  city,
  cfg,
  signal,
}: {
  city: City;
  cfg: CityNewsConfig;
  signal: SignalCandidate;
}): Promise<DraftedArticle> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const anthropic = new Anthropic({ apiKey });

  const cityVoice = `City context — ${city.toUpperCase()}:
Voice: ${cfg.voice}
Comparable outlets: ${cfg.comparable_outlets.join(", ")}
Local agencies (cite by correct name): ${cfg.agencies.join(", ")}
Landmark neighborhoods: ${cfg.landmark_neighborhoods.join(", ")}
Never reference another city.`;

  const userPrompt = `<signal type="${signal.type}">
Headline seed: ${signal.headline_seed}
Data to cite:
${JSON.stringify(signal.metadata, null, 2)}
</signal>

Write the article as JSON now. No prose outside the JSON.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1600,
    system: [
      {
        type: "text",
        text: BASE_EDITOR_PROMPT,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: cityVoice,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((c) => c.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  const raw = textBlock.text.trim();
  // Strip code fences if the model wrapped the JSON
  const jsonText = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: DraftedArticle;
  try {
    parsed = JSON.parse(jsonText) as DraftedArticle;
  } catch (e) {
    throw new Error(
      `Failed to parse Claude JSON output: ${(e as Error).message}\nRaw:\n${raw.slice(0, 500)}`
    );
  }

  // Minimal validation — fail loud so the cron logs a useful error
  const validCategories = ["Rental Market", "Tenant Rights", "Data", "Guide"];
  if (!validCategories.includes(parsed.category)) {
    throw new Error(`Invalid category: ${parsed.category}`);
  }
  if (!parsed.title || !parsed.excerpt || !parsed.body || !parsed.image_query) {
    throw new Error(`Missing required fields in draft: ${Object.keys(parsed).join(",")}`);
  }

  return parsed;
}
