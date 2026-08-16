import { BoroughListing, boroughListingMetadata } from "./_listing";
import type { Metadata } from "next";

export const revalidate = 3600;

interface BoroughPageProps {
  params: Promise<{ city: string; borough: string }>;
}

// Allow any borough/region slug — don't restrict with generateStaticParams,
// but provide an empty list + dynamicParams=true so Next.js ISR-caches each
// unique slug on first hit instead of treating the route as fully dynamic.
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: BoroughPageProps): Promise<Metadata> {
  const { city, borough } = await params;
  return boroughListingMetadata(city, borough, 1);
}

export default async function BoroughPage({ params }: BoroughPageProps) {
  const { city, borough } = await params;
  return <BoroughListing cityParam={city} boroughSlug={borough} page={1} />;
}
