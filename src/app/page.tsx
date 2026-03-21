import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { SearchBar } from "@/components/search/SearchBar";
import { ActivityFeed } from "@/components/ActivityFeed";
import { LiveStats } from "@/components/home/LiveStats";
import { NearbyBuildings } from "@/components/home/NearbyBuildings";
import { ViolationTicker } from "@/components/home/ViolationTicker";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { FileSearch, Users, Shield, Building2, Siren, MapPin, Train, BarChart3, HardHat } from "lucide-react";

export const metadata: Metadata = {
  alternates: { canonical: canonicalUrl("/") },
};

const features = [
  {
    icon: FileSearch,
    title: "Complete Building History",
    description:
      "Every HPD violation, DOB complaint, and 311 report — all in one place. Know what happened before you sign.",
  },
  {
    icon: Users,
    title: "Real Tenant Reviews",
    description:
      "Hear from people who actually lived there. Creaky floors, thin walls, pest problems — the stuff landlords don't mention.",
  },
  {
    icon: Shield,
    title: "Transparent Scoring",
    description:
      "Our scoring combines public violation data with tenant reviews to give you an honest picture of any building.",
  },
];

export default function HomePage() {
  return (
    <AdSidebar>
    <div>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Lucid Rents",
        url: "https://lucidrents.com",
        description: "Discover the truth about NYC apartments. Search building violations, bedbug reports, evictions, lead paint violations, read real tenant reviews, and uncover hidden issues before signing your lease.",
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: "https://lucidrents.com/nyc/search?q={search_term_string}",
          },
          "query-input": "required name=search_term_string",
        },
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Lucid Rents",
        url: "https://lucidrents.com",
        logo: "https://lucidrents.com/lucid-rents-logo.png",
        description: "A rental intelligence platform helping NYC renters make informed decisions with building violations, tenant reviews, and public data.",
        sameAs: [],
      }} />

      {/* Hero */}
      <section className="relative text-white overflow-x-clip">
        <Image
          src="/homepage-background.jpg"
          alt="City skyline"
          fill
          className="object-cover object-center"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[#0F1D2E]/40" />
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
            Check Your NYC Apartment Building
          </h1>
          <p className="text-sm sm:text-base text-white/80 mb-4 max-w-2xl mx-auto">
            See the truth about any NYC building before you sign.
            Violations, complaints, tenant reviews, and crime data — all in one place.
          </p>
          <div className="max-w-2xl mx-auto">
            <SearchBar size="hero" placeholder="Enter any NYC address, zip code, or neighborhood..." />
          </div>
          <p className="text-sm text-white/60 mt-2">
            Try &ldquo;123 Main Street Brooklyn&rdquo; or &ldquo;10001&rdquo;
          </p>
        </div>
      </section>

      {/* Violation Ticker */}
      <ViolationTicker />

      {/* Stats */}
      <section className="border-b border-[#e2e8f0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LiveStats />
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
              The latest violations, complaints, and tenant reviews across NYC buildings
            </p>
          </div>
          <ActivityFeed />
        </div>
      </section>

      {/* Ad */}
      <AdBlock adSlot="HOME_MID_2" adFormat="horizontal" />

      {/* Features */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-[#0F1D2E] mb-12">
            The Apartment Details No One Tells You
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-xl border border-[#e2e8f0] p-8 text-center"
              >
                <div className="w-14 h-14 bg-[#EFF6FF] rounded-xl flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-7 h-7 text-[#3B82F6]" />
                </div>
                <h3 className="text-lg font-semibold text-[#0F1D2E] mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-[#64748b] leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Explore NYC */}
      <section className="py-12 bg-white border-t border-[#e2e8f0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center text-[#0F1D2E] mb-8">
            Explore NYC Housing Data
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { href: cityPath("/buildings"), icon: Building2, label: "Buildings" },
              { href: cityPath("/landlords"), icon: Users, label: "Landlords" },
              { href: cityPath("/crime"), icon: Siren, label: "Crime Data" },
              { href: cityPath("/transit"), icon: Train, label: "Transit" },
              { href: cityPath("/rent-data"), icon: BarChart3, label: "Rent Data" },
              { href: cityPath("/permits"), icon: HardHat, label: "Permits" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[#e2e8f0] hover:border-[#3B82F6] hover:bg-[#EFF6FF] transition-colors text-center"
              >
                <item.icon className="w-6 h-6 text-[#3B82F6]" />
                <span className="text-sm font-medium text-[#0F1D2E]">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-white border-t border-[#e2e8f0]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E] mb-6 text-center">
            How Lucid Rents Works
          </h2>
          <div className="prose prose-slate max-w-none text-sm leading-relaxed text-[#334155] space-y-4">
            <p>
              Finding the right apartment in New York City is hard enough without
              hidden surprises. Lucid Rents was built to give renters the same
              level of information that landlords, brokers, and property managers
              already have access to &mdash; completely free.
            </p>
            <p>
              We pull data directly from official NYC government sources every
              day. This includes HPD housing violations from the Department of
              Housing Preservation and Development, DOB violations and permits
              from the Department of Buildings, 311 service request complaints,
              NYPD crime data, energy benchmarking scores, rent stabilization
              records from Department of Finance tax bills, and MTA transit stop
              locations. Every data point is tied to a specific building using
              BBL (Borough-Block-Lot) tax lot identifiers, giving you a complete
              picture of any property in the city.
            </p>
            <p>
              Each building on Lucid Rents receives a letter grade from A+ to F,
              calculated from its violation history, complaint volume, and tenant
              reviews. This score helps you compare buildings at a glance and
              avoid properties with chronic maintenance issues, pest problems, or
              unresponsive management. You can also read reviews from real
              tenants who have lived in the building &mdash; covering
              everything from noise levels and heating to how quickly the
              landlord responds to repair requests.
            </p>
            <p>
              Beyond individual building lookups, our tenant tools help you
              explore NYC housing data at scale. Check if your apartment is rent
              stabilized, track active scaffolding and sidewalk sheds in your
              neighborhood, compare multiple buildings side by side, browse crime
              statistics by zip code, and find apartments near any subway or bus
              line. Every tool is designed to help you make a more informed
              decision before signing a lease.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0F1D2E] text-white py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Lived in an NYC Apartment?
          </h2>
          <p className="text-gray-300 mb-8">
            Help fellow renters by sharing your experience. Rate your building
            on noise, pests, management, and more.
          </p>
          <a
            href={cityPath("/review/new")}
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
