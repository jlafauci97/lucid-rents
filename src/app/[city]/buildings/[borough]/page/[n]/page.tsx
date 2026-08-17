import { notFound } from "next/navigation";
import { BoroughListing, boroughListingMetadata } from "../../_listing";
import type { Metadata } from "next";

// Deep pages of the borough building directory: /nyc/buildings/queens/page/2.
// Path segments (not ?page=) so each page is its own ISR-cacheable route with
// a self-canonical — reading searchParams would make the route dynamic and
// uncacheable, which is why the ?page era served page-1 content everywhere.
// /page/1 301s to the bare borough URL in proxy.ts.
//
// 7-day ISR, matching building pages. Deep pagination exists for crawler
// discovery, not freshness — at 1h these thousands of pages went cold every
// hour and each cold render was the site's slowest crawl response (5–13s),
// dominating Search Console's average response time.
export const revalidate = 604800;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ city: string; borough: string; n: string }>;
}

function parsePageParam(n: string): number | null {
  if (!/^\d{1,5}$/.test(n)) return null;
  const page = Number(n);
  return page >= 2 ? page : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city, borough, n } = await params;
  const page = parsePageParam(n);
  if (!page) return { title: "Not Found" };
  return boroughListingMetadata(city, borough, page);
}

export default async function BoroughDeepPage({ params }: PageProps) {
  const { city, borough, n } = await params;
  const page = parsePageParam(n);
  if (!page) notFound();
  return <BoroughListing cityParam={city} boroughSlug={borough} page={page} />;
}
