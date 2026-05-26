import { permanentRedirect } from "next/navigation";
import { VALID_CITIES } from "@/lib/cities";

export const revalidate = 86400; // 24h ISR — permanent redirect, safe to cache

export function generateStaticParams() {
  return VALID_CITIES.map((city) => ({ city }));
}

// The /worst-rated-buildings route was renamed to /building-rankings on
// 2026-04-28. The proxy.ts rule handles single-segment city URLs (e.g.
// /nyc/worst-rated-buildings), but multi-segment forms like
// /CA/Los-Angeles/worst-rated-buildings reach this server component before
// the proxy rule fires. We do a permanent server-side redirect here so
// every URL form converges on the new path.
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
  permanentRedirect(`/${city}/building-rankings`);
}
