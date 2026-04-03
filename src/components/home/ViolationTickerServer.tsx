import { ViolationTicker } from "./ViolationTicker";
import type { ActivityItem } from "@/app/api/activity/route";

/**
 * Server component wrapper that pre-fetches ticker data so the client
 * renders immediately without a loading skeleton or client-side fetch.
 */
export async function ViolationTickerServer({ metro }: { metro?: string }) {
  let items: ActivityItem[] = [];

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

    const params = new URLSearchParams({ limit: "30" });
    if (metro) params.set("city", metro);

    const res = await fetch(`${baseUrl}/api/activity?${params}`, {
      next: { revalidate: 600 }, // 10 minutes, matches activity cache TTL
    });

    if (res.ok) {
      const data = await res.json();
      items = data.items || [];

      // Fall back to all-city feed if city has no activity
      if (items.length === 0 && metro) {
        const fallbackRes = await fetch(`${baseUrl}/api/activity?limit=30`, {
          next: { revalidate: 600 },
        });
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          items = fallbackData.items || [];
        }
      }
    }
  } catch {
    // Fall through — client component will fetch as fallback
  }

  return <ViolationTicker metro={metro} initialItems={items} />;
}
