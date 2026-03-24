import type { MarketingContentType } from "@/types/marketing";

// ===== PLATFORM CONFIGS =====

export const PLATFORM_CONFIGS = {
  instagram: { maxCaptionLength: 2200, maxHashtags: 30, format: "visual-first" },
  tiktok: { maxCaptionLength: 4000, maxHashtags: 5, format: "hook-first" },
  youtube: { maxTitleLength: 100, maxDescriptionLength: 5000, format: "seo-optimized" },
  x: { maxCaptionLength: 280, maxHashtags: 3, format: "punchy-concise" },
  linkedin: { maxCaptionLength: 3000, maxHashtags: 5, format: "professional" },
  facebook: { maxCaptionLength: 63206, maxHashtags: 10, format: "conversational" },
  pinterest: { maxTitleLength: 100, maxDescriptionLength: 500, format: "seo-search" },
  threads: { maxCaptionLength: 500, maxHashtags: 5, format: "casual" },
  bluesky: { maxCaptionLength: 300, maxHashtags: 0, format: "concise" },
} as const;

// ===== PINTEREST BOARDS =====

export const PINTEREST_BOARDS: Record<string, string[]> = {
  nyc: [
    "NYC Apartment Tips",
    "NYC Rental Market Data",
    "Landlord Red Flags",
    "Apartment Hunting Checklist",
  ],
  "los-angeles": [
    "LA Renter's Guide",
    "LA Rental Market Data",
    "Landlord Red Flags",
    "Apartment Hunting Checklist",
  ],
  chicago: [
    "Chicago Renter's Guide",
    "Chicago Rental Market Data",
    "Landlord Red Flags",
    "Apartment Hunting Checklist",
  ],
};

// ===== PINTEREST SEO KEYWORDS =====

export const PINTEREST_KEYWORDS: Record<string, string[]> = {
  nyc: [
    "NYC apartments",
    "apartment red flags",
    "landlord violations",
    "rent stabilized apartments",
    "tenant rights NYC",
    "NYC renting tips",
    "apartment hunting NYC",
  ],
  "los-angeles": [
    "LA rentals",
    "LAHD violations",
    "Los Angeles apartment tips",
    "LA renter rights",
    "apartment hunting LA",
  ],
  chicago: [
    "Chicago apartments",
    "Chicago building violations",
    "RLTO",
    "Chicago tenant rights",
    "Chicago renting tips",
  ],
};

// ===== CONTENT SYSTEM PROMPT =====
// This is the master system prompt for Claude when generating marketing content.

export const CONTENT_SYSTEM_PROMPT = `You are a social media content creator for LucidRents, a rental intelligence platform that helps renters make informed apartment decisions.

BRAND VOICE:
- Informative but punchy. Data-first. Never fear-mongering — empowering.
- You translate housing data into content that helps renters protect themselves.
- You are the renter's advocate. Not aggressive, not passive — direct and factual.

CTA PATTERN:
- Every post ends with a soft call-to-action: "Check your building free at lucidrents.com"
- Never use hard-sell language ("Sign up now!", "Don't miss out!")
- The CTA should feel like a natural next step, not a sales pitch.

PLATFORM RULES:
- TikTok/Reels: Hook in first 2 seconds. Under 60 seconds. Reference trending audio formats.
- X (Twitter): Sharp one-liner + data point + link. Under 280 chars total.
- LinkedIn: Professional angle — "housing transparency" and "data-driven decisions" framing.
- Pinterest: Search-optimized titles and descriptions. Infographic style. Long shelf life.
- Reddit: NO promotional tone. Genuinely helpful. Link only if it naturally fits.
- Threads/Bluesky: Casual, conversational tone. No hard sell.

HASHTAG RULES:
- Instagram: 15-20 relevant hashtags (mix of broad + niche)
- TikTok: 3-5 highly relevant hashtags
- X: 1-2 hashtags max
- LinkedIn: 3-5 professional hashtags
- Pinterest: No hashtags (use keywords in description instead)

CONTENT ACCURACY:
- All data points MUST come from the source_data provided. Never fabricate statistics.
- Always cite the data source (e.g., "per HPD records", "according to LAHD data")
- If the data is from a specific date range, mention it.
`;

// ===== REDDIT SYSTEM PROMPT =====

export const REDDIT_SYSTEM_PROMPT = `You are helping a Reddit user with a housing/rental question. You work for LucidRents, a rental intelligence platform.

RULES:
1. Lead with genuine help. Answer their question FIRST.
2. Include specific data when possible (e.g., "that building at 123 Main St has 47 open violations per HPD records")
3. Only mention LucidRents if it fits naturally. Acceptable: "you can check any building's violation history on lucidrents.com" as part of a longer helpful answer.
4. NEVER fake being a tenant. If asked, be transparent: "I built a tool that tracks this data."
5. Match the subreddit's communication style.
6. Max 2-3 paragraphs. Redditors don't read walls of text.
7. Never use marketing language. Sound like a knowledgeable person, not a company.
`;

// ===== CONTENT TYPE PROMPTS =====

export function getContentTypePrompt(type: MarketingContentType): string {
  const prompts: Record<MarketingContentType, string> = {
    landlord_expose: `Create a data-driven post exposing a problematic landlord's portfolio. Focus on: total violations, buildings owned, worst building, most common violation types. Tone: factual and measured, not angry. Let the data speak for itself.`,

    building_horror: `Create a post highlighting a building with alarming recent violations. Focus on: what was found, how many violations in what timeframe, type of violations (heat, pests, structural, etc.). Make it feel urgent but informative, not sensational.`,

    neighborhood_trend: `Create a post about rent and violation trends in a specific neighborhood. Focus on: rent changes (up/down %), violation trend direction, how the neighborhood compares to city average. Make it useful for someone considering moving there.`,

    tenant_rights: `Create an educational post about a specific tenant right. Focus on: what the law says, when it applies, what to do if it's violated. Make it actionable — the reader should know their next step after reading.`,

    news_reaction: `Create a post that adds LucidRents data context to a trending housing news story. Focus on: what the story is, what our data shows about the issue, why it matters for renters. Don't just summarize the news — add value with data.`,

    viral_humor: `Create a funny, absurdist post where an AI character (a fruit, vegetable, or everyday object) discovers housing data from LucidRents. The character should be shocked, outraged, or hilariously concerned by the data. The data must be REAL (from source_data). The humor comes from the contrast between a silly character and serious housing issues. Think: "An AI strawberry reads your landlord's violation history and is NOT happy." Keep it short, punchy, and shareable.`,
  };
  return prompts[type];
}

// ===== SUBREDDIT TONE GUIDE =====

export function getSubredditTone(subreddit: string): string {
  const tones: Record<string, string> = {
    NYCapartments:
      "Direct and experienced. NYC renters are battle-hardened. Skip pleasantries, get to the point.",
    AskNYC: "Blunt but helpful. This sub values concise, no-BS answers.",
    nycrentals: "Practical. Focus on actionable advice about the rental process.",
    AskLosAngeles: "Friendly but informative. LA culture is more laid-back than NYC.",
    LosAngeles: "Casual. Match the community vibe — informative but not stiff.",
    LArentals: "Practical and supportive. Many first-time renters here.",
    chicago: "Midwest-friendly. Helpful and straightforward.",
    chicagoapartments: "Practical housing advice. Reference RLTO when relevant.",
    realestate: "Professional and measured. Data-heavy responses do well here.",
    FirstTimeHomeBuyer: "Empathetic and educational. Many anxious first-timers here.",
    Tenant: "Supportive and advocacy-oriented. This community rallies around tenant rights.",
    renters: "Casual and supportive. Mix of experienced and new renters.",
    personalfinance: "Numbers-first. This sub respects data and financial analysis.",
  };
  return tones[subreddit] || "Helpful and informative. Match the community's existing tone.";
}

// ===== TARGET SUBREDDITS =====

export const TARGET_SUBREDDITS = {
  nyc: ["NYCapartments", "AskNYC", "nycrentals", "NYCinfohub"],
  "los-angeles": ["AskLosAngeles", "LosAngeles", "LArentals"],
  chicago: ["chicago", "chicagoapartments"],
  general: ["realestate", "FirstTimeHomeBuyer", "Tenant", "renters", "personalfinance"],
};

// ===== REDDIT KEYWORDS =====

export const REDDIT_KEYWORDS = [
  "violations",
  "landlord",
  "lease",
  "HPD",
  "LAHD",
  "building complaints",
  "rent stabilized",
  "tenant rights",
  "311",
  "apartment search",
  "moving to nyc",
  "moving to la",
  "moving to chicago",
  "bad landlord",
  "slumlord",
  "mold",
  "bedbugs",
  "no heat",
  "no hot water",
  "building inspection",
  "housing court",
  "rent increase",
  "apartment hunting",
  "apartment advice",
  "renter tips",
];
