import Image from "next/image";
import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SearchBar } from "@/components/search/SearchBar";
import { ActivityFeed } from "@/components/ActivityFeed";
import { LiveStats } from "@/components/home/LiveStats";
import { NearbyBuildings } from "@/components/home/NearbyBuildings";
import { ViolationTickerServer } from "@/components/home/ViolationTickerServer";
import { RegionGrid } from "@/components/home/RegionGrid";
import { PopularListicles } from "@/components/home/PopularListicles";
import { LucidIQShowcase } from "@/components/home/LucidIQShowcase";
import { ExploreDataGrid } from "@/components/home/ExploreDataGrid";
import { HomepageNewsGrid } from "@/components/home/HomepageNewsGrid";
import { CityFaq } from "@/components/home/CityFaq";
import { CityHomeCta } from "@/components/home/CityHomeCta";
import { BrandShield } from "@/components/layout/BrandShield";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { isValidCity, CITY_META, type City } from "@/lib/cities";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  return {
    title: `${meta.fullName} Apartment Reviews & Building Reports — Free`,
    description: `Looking for an apartment in ${meta.fullName}? Search any building for violations, tenant reviews, crime data, and rent history — all free.`,
    alternates: { canonical: canonicalUrl(cityPath("/", city)) },
  };
}

const searchPlaceholders: Record<City, string> = {
  nyc: "Enter any NYC address, zip code, or neighborhood...",
  "los-angeles": "Enter any LA address, zip code, or neighborhood...",
  chicago: "Enter any Chicago address, zip code, or neighborhood...",
  miami: "Enter any Miami address, zip code, or neighborhood...",
  houston: "Enter any Houston address, zip code, or neighborhood...",
};

const searchExamples: Record<City, string> = {
  nyc: "Try \u201c123 Main Street Brooklyn\u201d or \u201c10001\u201d",
  "los-angeles": "Try \u201c456 Sunset Blvd\u201d or \u201c90028\u201d",
  chicago: "Try \u201c1200 N Lake Shore Dr\u201d or \u201c60614\u201d",
  miami: "Try \u201c1000 Brickell Ave\u201d or \u201c33131\u201d",
  houston: "Try \u201c1500 Hermann Dr\u201d or \u201c77004\u201d",
};

export default async function CityHomePage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: cityParam } = await params;
  if (!isValidCity(cityParam)) notFound();
  const city = cityParam;
  const meta = CITY_META[city];

  return (
    <AdSidebar>
      <div style={{ zoom: 0.9 }}>
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: `${meta.fullName} Apartment Building Data`,
            url: `https://lucidrents.com${cityPath("/", city)}`,
            description: `Search building violations, tenant reviews, crime data, and more for ${meta.fullName} apartments.`,
          }}
        />

        {/* Hero — preserved */}
        <section className="relative text-white overflow-x-clip">
          <Image
            src={meta.heroImage}
            alt={`${meta.fullName} skyline`}
            fill
            className="object-cover object-center"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[#0F1D2E]/50" />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-12 pb-10 sm:pb-16 text-center">
            <div className="mx-auto mb-3 w-fit drop-shadow-[0_10px_15px_rgba(0,0,0,0.4)]">
              <BrandShield size={140} clipId="heroShield" />
            </div>
            <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-white/70 font-medium mb-3">
              A Rental Intelligence Platform
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-1">
              Check Your {meta.name} Apartment Building
            </h1>
            <p className="text-sm sm:text-base text-white/80 mb-4 max-w-2xl mx-auto">
              See the truth about any {meta.name} building before you sign.
              Violations, complaints, tenant reviews, and crime data — all in one place.
            </p>
            <div className="max-w-2xl mx-auto">
              <SearchBar size="hero" placeholder={searchPlaceholders[city]} />
            </div>
            <p className="text-sm text-white/60 mt-2">{searchExamples[city]}</p>
          </div>
        </section>

        {/* Violation Ticker */}
        <Suspense fallback={<div className="bg-[#3B82F6] border-y border-blue-400/30 py-3 h-[52px]" />}>
          <ViolationTickerServer metro={city} />
        </Suspense>

        {/* Stats */}
        <section className="border-b border-[#e2e8f0]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Suspense
              fallback={
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="text-center">
                      <div className="w-8 h-8 bg-[#e2e8f0] rounded mx-auto mb-2 animate-pulse" />
                      <div className="h-7 w-20 bg-[#e2e8f0] rounded mx-auto mb-1 animate-pulse" />
                      <div className="h-4 w-24 bg-[#e2e8f0] rounded mx-auto animate-pulse" />
                    </div>
                  ))}
                </div>
              }
            >
              <LiveStats metro={city} />
            </Suspense>
          </div>
        </section>

        {/* NEW — Region grid */}
        <RegionGrid city={city} />

        {/* NEW — Popular listicles, links into /best-buildings */}
        <PopularListicles city={city} />

        {/* NEW — Explore grid (moved up to follow listicles) */}
        <ExploreDataGrid city={city} />

        {/* NEW — per-city news from news_articles (moved up to follow explore) */}
        <Suspense fallback={null}>
          <HomepageNewsGrid city={city} />
        </Suspense>

        {/* NEW — LucidIQ educational showcase */}
        <LucidIQShowcase city={city} />

        {/* Live Activity — preserved */}
        <section className="py-16 bg-[#EFF6FF]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-[#0F1D2E] mb-2">
                Recent Activity
              </h2>
              <p className="text-[#64748b]">
                The latest violations, complaints, and tenant reviews across {meta.name} buildings
              </p>
            </div>
            <ActivityFeed />
          </div>
        </section>

        <AdBlock adSlot="HOME_MID_2" adFormat="horizontal" />

        {/* Nearby Buildings — moved to bottom, right before FAQ */}
        <section className="py-16 bg-white border-t border-[#e2e8f0]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-[#0F1D2E] mb-2">
                Buildings Near You
              </h2>
              <p className="text-[#64748b] text-sm">
                Discover what&apos;s happening in buildings around your location
              </p>
            </div>
            <NearbyBuildings />
          </div>
        </section>

        {/* NEW — FAQ */}
        <CityFaq city={city} />

        {/* NEW — Close-out CTA (replaces old inline review CTA) */}
        <CityHomeCta city={city} />
      </div>
    </AdSidebar>
  );
}
