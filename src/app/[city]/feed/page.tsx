import { Suspense } from "react";
import { FeedView } from "@/components/feed/FeedView";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { AdSidebar } from "@/components/ui/AdSidebar";
import type { Metadata } from "next";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { FeedStats, TrendingBuildings } from "./FeedSidebar";
import { FeedStatsSkeleton, TrendingBuildingsSkeleton } from "./FeedSidebarSkeletons";

export const revalidate = 300; // 5min ISR — live feed shell

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  return {
    title: `Live Feed | ${meta.fullName}`,
    description: `See what's happening right now in ${meta.fullName} buildings — new violations, complaints, and tenant reviews as they come in.`,
    alternates: { canonical: canonicalUrl(cityPath("/feed", city)) },
    openGraph: {
      title: `Live Feed — ${meta.fullName} Building Activity`,
      description: `See what's happening right now in ${meta.fullName} buildings — violations, complaints, and reviews as they come in.`,
      url: canonicalUrl(cityPath("/feed", city)),
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

function FeedSourceLabel() {
  // This is a server component — we can't read pathname here.
  // Use a generic label that works for both cities.
  return (
    <div className="px-4 text-xs text-[#94a3b8] space-y-1">
      <p>Data sourced from public records</p>
      <p>Violations &middot; Complaints &middot; Permits &middot; Building Data</p>
    </div>
  );
}

export default async function FeedPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: cityParam } = await params;
  const city = cityParam as City;
  return (
    <AdSidebar>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Main feed */}
        <div className="min-w-0">
          <FeedView />
        </div>

        {/* Sidebar — sticky. Each card streams independently so the shell paints first. */}
        <aside className="hidden lg:block space-y-6 sticky top-20 self-start">
          <Suspense fallback={<FeedStatsSkeleton />}>
            <FeedStats city={city} />
          </Suspense>
          <Suspense fallback={<TrendingBuildingsSkeleton />}>
            <TrendingBuildings city={city} />
          </Suspense>
          <FeedSourceLabel />
        </aside>
      </div>
    </div>
    </AdSidebar>
  );
}
