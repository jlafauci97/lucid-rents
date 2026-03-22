import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SearchBar } from "@/components/search/SearchBar";
import { ActivityFeed } from "@/components/ActivityFeed";
import { LiveStats } from "@/components/home/LiveStats";
import { NearbyBuildings } from "@/components/home/NearbyBuildings";
import { ViolationTicker } from "@/components/home/ViolationTicker";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import {
  Building2,
  Users,
  Siren,
  Train,
  BarChart3,
  HardHat,
} from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  return {
    title: `${meta.fullName} Apartment Building Data | Lucid Rents`,
    description: `Looking for an apartment in ${meta.fullName}? Search any building for violations, tenant reviews, crime data, and rent history — all free.`,
    alternates: { canonical: canonicalUrl(cityPath("/", city)) },
  };
}

const searchPlaceholders: Record<City, string> = {
  nyc: "Enter any NYC address, zip code, or neighborhood...",
  "los-angeles": "Enter any LA address, zip code, or neighborhood...",
};

const searchExamples: Record<City, string> = {
  nyc: "Try \u201c123 Main Street Brooklyn\u201d or \u201c10001\u201d",
  "los-angeles": "Try \u201c456 Sunset Blvd\u201d or \u201c90028\u201d",
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
      <div>
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: `${meta.fullName} Apartment Building Data`,
            url: `https://lucidrents.com${cityPath("/", city)}`,
            description: `Search building violations, tenant reviews, crime data, and more for ${meta.fullName} apartments.`,
          }}
        />

        {/* Hero */}
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
            <Image
              src="/lucid-rents-logo.png"
              alt="Lucid Rents"
              width={300}
              height={200}
              className="mx-auto mb-1 h-[120px] sm:h-[150px] w-auto drop-shadow-lg"
              priority
            />
            <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-white/70 font-medium mb-3">
              A Rental Intelligence Platform
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-1">
              Check Your {meta.name} Apartment Building
            </h1>
            <p className="text-sm sm:text-base text-white/80 mb-4 max-w-2xl mx-auto">
              See the truth about any {meta.name} building before you sign.
              Violations, complaints, tenant reviews, and crime data — all in
              one place.
            </p>
            <div className="max-w-2xl mx-auto">
              <SearchBar
                size="hero"
                placeholder={searchPlaceholders[city]}
              />
            </div>
            <p className="text-sm text-white/60 mt-2">
              {searchExamples[city]}
            </p>
          </div>
        </section>

        {/* Violation Ticker */}
        <ViolationTicker metro={city} />

        {/* Stats */}
        <section className="border-b border-[#e2e8f0]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <LiveStats metro={city} />
          </div>
        </section>

        {/* Nearby Buildings */}
        <section className="py-12 bg-white">
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

        {/* Recent Activity */}
        <section className="py-16 bg-[#EFF6FF]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-[#0F1D2E] mb-2">
                Recent Activity
              </h2>
              <p className="text-[#64748b]">
                The latest violations, complaints, and tenant reviews across{" "}
                {meta.name} buildings
              </p>
            </div>
            <ActivityFeed />
          </div>
        </section>

        {/* Ad */}
        <AdBlock adSlot="HOME_MID_2" adFormat="horizontal" />

        {/* Explore */}
        <section className="py-12 bg-white border-t border-[#e2e8f0]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-center text-[#0F1D2E] mb-8">
              Explore {meta.name} Housing Data
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                {
                  href: cityPath("/buildings", city),
                  icon: Building2,
                  label: "Buildings",
                },
                {
                  href: cityPath("/landlords", city),
                  icon: Users,
                  label: "Landlords",
                },
                {
                  href: cityPath("/crime", city),
                  icon: Siren,
                  label: "Crime Data",
                },
                {
                  href: cityPath("/transit", city),
                  icon: Train,
                  label: "Transit",
                },
                {
                  href: cityPath("/rent-data", city),
                  icon: BarChart3,
                  label: "Rent Data",
                },
                {
                  href: cityPath("/permits", city),
                  icon: HardHat,
                  label: "Permits",
                },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[#e2e8f0] hover:border-[#3B82F6] hover:bg-[#EFF6FF] transition-colors text-center"
                >
                  <item.icon className="w-6 h-6 text-[#3B82F6]" />
                  <span className="text-sm font-medium text-[#0F1D2E]">
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[#0F1D2E] text-white py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              Lived in a {meta.name} Apartment?
            </h2>
            <p className="text-gray-300 mb-8">
              Help fellow renters by sharing your experience. Rate your building
              on noise, pests, management, and more.
            </p>
            <a
              href={cityPath("/review/new", city)}
              className="inline-flex items-center px-6 py-3 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold rounded-lg transition-colors"
            >
              Submit a Review
            </a>
          </div>
        </section>
      </div>
    </AdSidebar>
  );
}
