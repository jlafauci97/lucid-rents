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
  hashtags: string[];
}

const MODEL = "claude-sonnet-4-6";

const BASE_EDITOR_PROMPT = `You are a staff writer for Lucid Rents — think Curbed, The Hustle, or Morning Brew with a real-estate beat. Your job is to turn cold data into something a renter actually wants to read at 7am with their coffee.

Voice:
- Tell a story. Open with a scene, a character moment, or a sharp observation — not a number dump. The number can arrive in paragraph 2.
- Use conversational rhythm: varied sentence length, the occasional one-liner for punch, and direct address ("you", "your building", "your block") where it fits.
- Wry, warm, and human. Dry wit over forced jokes. A little personality; never cheesy.
- Specific details beat adjectives. "A studio on Bedford for the price of a used Civic" > "rents are surprisingly high".
- Plainspoken metaphors are great when they land. No clichés, no AI filler ("delve", "in the realm of", "game-changer", "unprecedented", "in today's world", "navigating the landscape").

Truth guardrails (non-negotiable — you will be rejected if you break these):
- Never invent numbers, dates, or trends. Only use data from the <signal> block in the user message.
- No quotes. No made-up spokespeople, landlords, or residents. No invented anecdotes about specific people.
- You can describe generic situations a renter might plausibly recognize ("anyone who has apartment-hunted in August knows…") but not invent a named person.
- If the data is thin, write a shorter, tighter piece rather than padding with fiction.

Structure:
- Title: ≤70 characters. Evocative and falsifiable — a reader should be able to tell if it's true. Not clickbait.
- Excerpt: ≤160 characters. One sentence. Should make the reader curious, not summarize the whole article.
- Body: 280–500 words in markdown. Open with a hook (scene, observation, surprising contrast). Land the data by paragraph 2. Give context in the middle (what this means for rent, risk, neighborhood trajectory). Close with a line that feels earned — a "so what" that respects the reader's time.
- Category must be exactly one of: "Rental Market", "Tenant Rights", "Data", "Guide".
- image_query: 2–4 words for a stock photo search. Favor evocative ("rainy brooklyn stoop") over literal ("rent chart"). No proper nouns unless needed.
- hashtags: exactly 10 hashtags tuned to get this story in front of the right readers on X/Twitter. Rules:
    • Plain tokens, no "#" prefix (the system adds it)
    • Alphanumeric only, no spaces, 3–25 chars each (e.g. "nycrealestate", "renterslife", "brickell", "hpdviolations")
    • Mix: 2-3 geo-specific (city/neighborhood), 2-3 topical (rent, violations, landlords, housing), 2-3 audience (renters, apartmenthunting, firsttimerenter), 1-2 broader (realestate, housing). Avoid trendy unrelated tags.
    • Lowercase preferred. No duplicates. Never inflammatory or slurs.

Output format — always a single JSON object with keys:
title, excerpt, body, category, image_query, hashtags. No prose outside the JSON.`;

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

  // Normalize hashtags: strip any leading "#", drop invalid, dedupe, cap at 10.
  const rawTags = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const t of rawTags) {
    if (typeof t !== "string") continue;
    const tag = t.replace(/^#+/, "").replace(/[^A-Za-z0-9]/g, "").toLowerCase();
    if (!tag || tag.length < 2 || tag.length > 30) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    cleaned.push(tag);
    if (cleaned.length >= 10) break;
  }
  parsed.hashtags = cleaned;

  return parsed;
}
