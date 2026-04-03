const XPOZ_API_URL = "https://api.xpoz.io/v1";

async function xpozRequest(
  method: "GET" | "POST",
  endpoint: string,
  body?: unknown
): Promise<Response> {
  const apiKey = process.env.XPOZ_API_KEY;
  if (!apiKey) throw new Error("Missing XPOZ_API_KEY env var");

  return fetch(`${XPOZ_API_URL}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export interface TrendResult {
  platform: string;
  trends: Array<{
    topic: string;
    score: number;
    posts: number;
    url?: string;
  }>;
}

/**
 * Searches for trending topics on a given platform using Xpoz.
 * Returns ranked trend results with engagement scores and post counts.
 */
export async function searchTrends(params: {
  platform: "twitter" | "reddit" | "tiktok" | "instagram";
  keywords: string[];
  limit?: number;
}): Promise<TrendResult> {
  const response = await xpozRequest("POST", "/trends/search", {
    platform: params.platform,
    keywords: params.keywords,
    limit: params.limit ?? 20,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Xpoz trend search failed for ${params.platform} (HTTP ${response.status}): ${errorText}`
    );
  }

  const data = (await response.json()) as {
    platform: string;
    trends: Array<{
      topic: string;
      score: number;
      posts: number;
      url?: string;
    }>;
  };

  return {
    platform: data.platform,
    trends: data.trends,
  };
}

/**
 * Searches for specific posts across social platforms using Xpoz.
 * Returns posts sorted by engagement with their URLs.
 */
export async function searchPosts(params: {
  platform: string;
  query: string;
  limit?: number;
}): Promise<Array<{ id: string; text: string; url: string; engagement: number }>> {
  const response = await xpozRequest("POST", "/posts/search", {
    platform: params.platform,
    query: params.query,
    limit: params.limit ?? 20,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Xpoz post search failed for platform "${params.platform}" (HTTP ${response.status}): ${errorText}`
    );
  }

  const data = (await response.json()) as {
    posts: Array<{ id: string; text: string; url: string; engagement: number }>;
  };

  return data.posts;
}
