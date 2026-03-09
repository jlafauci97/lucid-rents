export interface NewsSource {
  name: string;
  slug: string;
  feedUrl: string;
  defaultCategory: NewsCategory;
}

export type NewsCategory =
  | "rental-market"
  | "tenant-rights"
  | "data-insights"
  | "guides"
  | "general";

export const NEWS_CATEGORIES: Record<
  NewsCategory,
  { label: string; description: string; icon: string; color: string }
> = {
  "rental-market": {
    label: "Rental Market",
    description: "NYC rental market trends, pricing, and housing supply updates",
    icon: "TrendingUp",
    color: "#3B82F6",
  },
  "tenant-rights": {
    label: "Tenant Rights",
    description: "Tenant protections, rent stabilization, and housing court news",
    icon: "Shield",
    color: "#8B5CF6",
  },
  "data-insights": {
    label: "Data & Insights",
    description: "Housing data analysis, reports, and research findings",
    icon: "BarChart3",
    color: "#10B981",
  },
  guides: {
    label: "Guides",
    description: "Practical tips and guides for NYC renters",
    icon: "BookOpen",
    color: "#F59E0B",
  },
  general: {
    label: "General",
    description: "General NYC housing and real estate news",
    icon: "Newspaper",
    color: "#64748B",
  },
};

export const NEWS_SOURCES: NewsSource[] = [
  {
    name: "The Real Deal",
    slug: "the-real-deal",
    feedUrl: "https://therealdeal.com/new-york/feed/",
    defaultCategory: "rental-market",
  },
  {
    name: "Gothamist",
    slug: "gothamist",
    feedUrl: "https://gothamist.com/feed",
    defaultCategory: "general",
  },
  {
    name: "The City",
    slug: "the-city",
    feedUrl: "https://www.thecity.nyc/feed/",
    defaultCategory: "general",
  },
  {
    name: "Brick Underground",
    slug: "brick-underground",
    feedUrl: "https://www.brickunderground.com/rss.xml",
    defaultCategory: "guides",
  },
  {
    name: "Curbed NY",
    slug: "curbed-ny",
    feedUrl: "https://www.curbed.com/rss/index.xml",
    defaultCategory: "rental-market",
  },
];

/**
 * Keywords that indicate an article is relevant to NYC housing/real estate.
 * Articles that don't match ANY of these are filtered out entirely.
 */
const RELEVANCE_KEYWORDS: string[] = [
  "rent",
  "housing",
  "apartment",
  "tenant",
  "landlord",
  "eviction",
  "lease",
  "building",
  "real estate",
  "condo",
  "co-op",
  "coop",
  "mortgage",
  "zoning",
  "affordable",
  "hpd",
  "nycha",
  "shelter",
  "homeless",
  "vacancy",
  "rezoning",
  "development",
  "construction",
  "property",
  "broker",
  "stabiliz",
  "bedroom",
  "studio",
  "sqft",
  "square feet",
  "living space",
  "move-in",
  "move in",
  "roommate",
  "sublease",
  "sublet",
  "gentrification",
  "displacement",
  "house",
  "home",
  "dwelling",
  "residential",
];

/**
 * Check if an article is relevant to NYC housing/real estate.
 */
export function isHousingRelevant(title: string, excerpt: string | null): boolean {
  const text = `${title} ${excerpt || ""}`.toLowerCase();
  return RELEVANCE_KEYWORDS.some((kw) => text.includes(kw));
}

const CATEGORY_KEYWORDS: Record<NewsCategory, string[]> = {
  "rental-market": [
    "rent increase",
    "rental market",
    "median rent",
    "housing market",
    "vacancy",
    "asking rent",
    "rental price",
    "apartment price",
    "housing supply",
    "new construction",
    "development",
    "real estate market",
    "housing crisis",
    "affordable housing",
  ],
  "tenant-rights": [
    "rent stabiliz",
    "tenant right",
    "tenant protection",
    "housing court",
    "eviction",
    "good cause",
    "lease renewal",
    "rent control",
    "hpd",
    "housing preservation",
    "code violation",
    "building violation",
    "habitability",
    "warranty of habitability",
    "tenant organiz",
    "rent strike",
  ],
  "data-insights": [
    "census",
    "housing data",
    "study finds",
    "report shows",
    "survey",
    "statistics",
    "analysis",
    "research",
    "percent of",
    "housing report",
  ],
  guides: [
    "how to",
    "tips for",
    "guide to",
    "what to know",
    "first-time",
    "checklist",
    "should you",
    "everything you need",
    "moving to",
    "apartment hunting",
  ],
  general: [],
};

/**
 * Auto-categorize an article based on keyword matching in title and excerpt.
 * Falls back to the source's default category.
 */
export function categorizeArticle(
  title: string,
  excerpt: string | null,
  defaultCategory: NewsCategory
): NewsCategory {
  const text = `${title} ${excerpt || ""}`.toLowerCase();

  // Check categories in priority order (more specific first)
  const priorityOrder: NewsCategory[] = [
    "tenant-rights",
    "guides",
    "data-insights",
    "rental-market",
  ];

  for (const category of priorityOrder) {
    const keywords = CATEGORY_KEYWORDS[category];
    if (keywords.some((kw) => text.includes(kw))) {
      return category;
    }
  }

  return defaultCategory;
}

/**
 * Generate a URL-safe slug from an article title and date.
 */
export function generateArticleSlug(title: string, publishedAt: string): string {
  const datePrefix = publishedAt.slice(0, 10); // YYYY-MM-DD
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 80);
  return `${datePrefix}-${titleSlug}`;
}
