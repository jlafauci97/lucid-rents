import type { PlatformVariants, PublishResult } from "@/types/marketing";

const POST_BRIDGE_API_URL = "https://api.postbridge.io/v1";

async function postBridgeRequest(endpoint: string, body: unknown): Promise<Response> {
  const apiKey = process.env.POST_BRIDGE_API_KEY;
  if (!apiKey) throw new Error("Missing POST_BRIDGE_API_KEY env var");

  return fetch(`${POST_BRIDGE_API_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
}

/**
 * Publishes content to all configured social media platforms via Post Bridge.
 * Individual platform failures are handled gracefully — one failing platform
 * does not block others from being published.
 */
export async function publishToAllPlatforms(
  variants: PlatformVariants,
  mediaUrls: string[]
): Promise<PublishResult[]> {
  const platformEntries = Object.entries(variants) as [
    keyof PlatformVariants,
    PlatformVariants[keyof PlatformVariants]
  ][];

  const results = await Promise.allSettled(
    platformEntries.map(async ([platform, variant]) => {
      if (!variant) return null;

      let payload: Record<string, unknown>;

      if (platform === "pinterest") {
        const pv = variant as PlatformVariants["pinterest"];
        payload = {
          platform,
          title: pv?.title,
          description: pv?.description,
          board: pv?.board,
          media_urls: pv?.image_url ? [pv.image_url] : mediaUrls,
        };
      } else if (platform === "youtube") {
        const yv = variant as PlatformVariants["youtube"];
        payload = {
          platform,
          caption: yv?.caption,
          title: yv?.title,
          hashtags: yv?.hashtags ?? [],
          tags: yv?.tags ?? [],
          media_urls: mediaUrls,
        };
      } else {
        const pv = variant as PlatformVariants["instagram"];
        payload = {
          platform,
          caption: pv?.caption,
          hashtags: pv?.hashtags ?? [],
          media_urls: mediaUrls,
        };
      }

      const response = await postBridgeRequest("/publish", payload);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Post Bridge publish failed for ${platform} (HTTP ${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as { post_id?: string; url?: string };

      return {
        platform,
        post_id: data.post_id,
        url: data.url,
      } satisfies PublishResult;
    })
  );

  return results
    .map((result, index): PublishResult => {
      const platform = platformEntries[index][0];
      if (result.status === "fulfilled" && result.value !== null) {
        return result.value;
      }
      if (result.status === "rejected") {
        return {
          platform,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        };
      }
      return { platform };
    })
    .filter((r) => r.platform);
}

/**
 * Retrieves analytics (impressions, engagements, clicks) for a set of
 * published posts, keyed by platform name.
 */
export async function getPostAnalytics(
  postIds: Record<string, string>
): Promise<Record<string, { impressions: number; engagements: number; clicks: number }>> {
  const response = await postBridgeRequest("/analytics", { post_ids: postIds });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Post Bridge analytics request failed (HTTP ${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    analytics: Record<string, { impressions: number; engagements: number; clicks: number }>;
  };

  return data.analytics;
}
