import { permanentRedirect } from "next/navigation";
import { VALID_CITIES, CITY_META, type City } from "@/lib/cities";

export const revalidate = 86400; // 24h ISR — permanent redirect, safe to cache

export function generateStaticParams() {
  return VALID_CITIES.map((city) => ({ city }));
}

// The /worst-rated-buildings route was renamed to /building-rankings on
// 2026-04-28. proxy.ts now issues a real 301 for BOTH single-segment city URLs
// (/nyc/...) and state-prefixed ones (/CA/Los-Angeles/...), so nothing should
// reach this component in normal routing. It stays as a backstop.
//
// It must redirect to the city's EXTERNAL prefix. `params.city` is the
// INTERNAL slug (proxy.ts rewrites /IL/Chicago/... → /chicago/...), so the old
// `/${city}/building-rankings` sent Google to /chicago/building-rankings — a
// non-canonical URL that canonicalises again to /IL/Chicago/building-rankings.
// Worse, permanentRedirect() from a page component is coerced by Next 16
// streaming SSR into an HTTP 200 carrying `<meta http-equiv="refresh">`, which
// Google files under "Page with redirect" (~2.6K URLs of the 40,459 in the
// 2026-08-02 coverage export).
//
// searchParams are intentionally NOT forwarded — this is a static
// prerenderable page (no per-request work), and the old route had no
// known query-string features. The new /building-rankings page handles
// sort/borough/page itself.

interface Props {
  params: Promise<{ city: string }>;
}

export default async function WorstRatedBuildingsRedirect({ params }: Props) {
  const { city } = await params;
  const prefix = CITY_META[city as City]?.urlPrefix ?? city;
  permanentRedirect(`/${prefix}/building-rankings`);
}
