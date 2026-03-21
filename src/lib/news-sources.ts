export interface NewsSource {
  name: string;
  slug: string;
  feedUrl: string;
  defaultCategory: NewsCategory;
  /** If true, all articles from this source are considered housing-relevant (skip keyword filter) */
  alwaysRelevant?: boolean;
  /** Metro area this source covers. Defaults to 'nyc' if not set. */
  metro?: string;
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
    description: "Rental market trends, pricing, and housing supply updates",
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
    description: "Practical tips and guides for renters",
    icon: "BookOpen",
    color: "#F59E0B",
  },
  general: {
    label: "General",
    description: "General housing and real estate news",
    icon: "Newspaper",
    color: "#64748B",
  },
};

export const NEWS_SOURCES: NewsSource[] = [
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
    name: "City Limits",
    slug: "city-limits",
    feedUrl: "https://citylimits.org/feed/",
    defaultCategory: "tenant-rights",
  },
  {
    name: "StreetEasy",
    slug: "streeteasy",
    feedUrl: "https://streeteasy.com/blog/feed/",
    defaultCategory: "rental-market",
    alwaysRelevant: true,
  },
  {
    name: "Brownstoner",
    slug: "brownstoner",
    feedUrl: "https://www.brownstoner.com/feed/",
    defaultCategory: "rental-market",
    alwaysRelevant: true,
  },
  {
    name: "6sqft",
    slug: "6sqft",
    feedUrl: "https://www.6sqft.com/feed/",
    defaultCategory: "rental-market",
    alwaysRelevant: true,
  },
  // --- Los Angeles sources ---
  {
    name: "Urbanize LA",
    slug: "urbanize-la",
    feedUrl: "https://la.urbanize.city/rss.xml",
    defaultCategory: "rental-market",
    alwaysRelevant: true,
    metro: "los-angeles",
  },
  {
    name: "The Real Deal LA",
    slug: "real-deal-la",
    feedUrl: "https://therealdeal.com/la/feed/",
    defaultCategory: "rental-market",
    alwaysRelevant: true,
    metro: "los-angeles",
  },
  {
    name: "Knock LA",
    slug: "knock-la",
    feedUrl: "https://knock-la.com/feed/",
    defaultCategory: "tenant-rights",
    metro: "los-angeles",
  },
];

/**
 * Keywords that indicate an article is relevant to housing/real estate.
 * Articles that don't match ANY of these are filtered out entirely.
 */
const RELEVANCE_KEYWORDS: string[] = [
  "rent ",
  "renter",
  "rental",
  "housing",
  "apartment",
  "tenant",
  "landlord",
  "eviction",
  "lease",
  "real estate",
  "condo",
  "co-op",
  "coop",
  "mortgage",
  "zoning",
  "affordable housing",
  "hpd",
  "nycha",
  "homeless shelter",
  "vacancy rate",
  "rezoning",
  "housing development",
  "property tax",
  "broker",
  "stabiliz",
  "bedroom",
  "sqft",
  "square feet",
  "roommate",
  "sublease",
  "sublet",
  "gentrification",
  "displacement",
  "dwelling",
  "residential",
  "townhouse",
  "penthouse",
  "rent-stabiliz",
  "housing court",
  "building code",
  "housing policy",
  "housing market",
  "home price",
  "home sale",
  "homeowner",
  "homebuyer",
  // LA-specific keywords
  "lahd",
  "lamc",
  "rent control",
  "rso",
  "ellis act",
  "measure hhh",
  "proposition hhh",
  "inclusionary",
  "adus",
  "accessory dwelling",
];

/**
 * Check if an article is relevant to housing/real estate.
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
