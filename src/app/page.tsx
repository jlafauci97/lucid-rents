import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { CITY_META, type City } from "@/lib/cities";
import { FileSearch, Users, Shield, ArrowRight, Search, ClipboardList, CheckCircle2 } from "lucide-react";
import { ViolationTicker } from "@/components/home/ViolationTicker";
import { LiveStats } from "@/components/home/LiveStats";
import { ActivityFeed } from "@/components/ActivityFeed";

export const metadata: Metadata = {
  title: "Lucid Rents — Apartment Building Intelligence",
  description:
    "Your next apartment has a history. Search any NYC, LA, or Chicago building to uncover violations, tenant complaints, crime stats, and honest reviews — before you sign.",
  alternates: { canonical: canonicalUrl("/") },
};

const features = [
  {
    icon: FileSearch,
    title: "Complete Building History",
    description:
      "Every violation, complaint, and 311 report — all in one place. Know what happened before you sign.",
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

const cities: { key: City; tagline: string; example: string }[] = [
  {
    key: "nyc",
    tagline: "Search violations, complaints, and reviews for any NYC building.",
    example: "Try \"123 Main Street Brooklyn\" or \"10001\"",
  },
  {
    key: "los-angeles",
    tagline: "Search violations, complaints, and reviews for any LA building.",
    example: "Try \"456 Sunset Blvd\" or \"90028\"",
  },
  {
    key: "chicago",
    tagline: "Search violations, complaints, and reviews for any Chicago building.",
    example: "Try \"1200 N Lake Shore Dr\" or \"60614\"",
  },
  {
    key: "miami",
    tagline: "Search violations, complaints, and reviews for any Miami building.",
    example: "Try \"1000 Brickell Ave\" or \"33131\"",
  },
];

export default function HomePage() {
  return (
    <div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Lucid Rents",
          url: "https://lucidrents.com",
          description:
            "Discover the truth about apartment buildings. Search building violations, tenant reviews, crime data, and more across New York City, Los Angeles, Chicago, and Miami.",
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate:
                "https://lucidrents.com/nyc/search?q={search_term_string}",
            },
            "query-input": "required name=search_term_string",
          },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Lucid Rents",
          url: "https://lucidrents.com",
          logo: "https://lucidrents.com/lucid-rents-logo.png",
          description:
            "A rental intelligence platform helping renters make informed decisions with building violations, tenant reviews, and public data.",
          sameAs: [],
        }}
      />

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
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-8 sm:pb-12 text-center">
          <Image
            src="/lucid-rents-logo.png"
            alt="Lucid Rents"
            width={300}
            height={200}
            className="mx-auto mb-1 h-[100px] sm:h-[120px] w-auto drop-shadow-lg"
            priority
          />
          <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-white/70 font-medium mb-2">
            A Rental Intelligence Platform
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-2">
            Check Your Apartment Building
          </h1>
          <p className="text-sm sm:text-base text-white/80 mb-6 max-w-2xl mx-auto">
            See the truth about any building before you sign. Violations,
            complaints, tenant reviews, and crime data — all in one place.
          </p>

          {/* City Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {cities.map((c) => {
              const meta = CITY_META[c.key];
              return (
                <Link
                  key={c.key}
                  href={cityPath("/", c.key)}
                  className="group relative rounded-2xl overflow-hidden border border-white/10 hover:border-white/30 transition-all hover:scale-[1.02]"
                >
                  <Image
                    src={meta.heroImage}
                    alt={`${meta.fullName} skyline`}
                    width={600}
                    height={340}
                    className="w-full h-[200px] sm:h-[220px] object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5 text-left">
                    <h2 className="text-2xl font-bold mb-1">
                      {meta.fullName}
                    </h2>
                    <p className="text-sm text-white/70 mb-3">{c.tagline}</p>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-[#3B82F6] group-hover:text-white transition-colors">
                      Explore {meta.name}
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
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

      {/* Recent Activity */}
      <section className="py-16 bg-[#EFF6FF]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-[#0F1D2E] mb-2">
              Recent Activity
            </h2>
            <p className="text-[#64748b]">
              The latest violations, complaints, and tenant reviews across all
              cities
            </p>
          </div>
          <ActivityFeed />
        </div>
      </section>

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

      {/* How It Works */}
      <section className="py-16 bg-white border-t border-[#e2e8f0]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E] mb-12 text-center">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 relative">
            {/* Connecting line (desktop only) */}
            <div className="hidden md:block absolute top-8 left-[20%] right-[20%] h-px bg-[#e2e8f0]" />
            {[
              {
                icon: Search,
                num: "1",
                title: "Search any address",
                desc: "Enter a building address, zip code, or neighborhood to pull its complete record.",
              },
              {
                icon: ClipboardList,
                num: "2",
                title: "See the full history",
                desc: "Every violation, complaint, litigation, and tenant review — organized and scored.",
              },
              {
                icon: CheckCircle2,
                num: "3",
                title: "Decide with confidence",
                desc: "Compare buildings, read reviews, and sign your lease knowing what to expect.",
              },
            ].map((step) => (
              <div key={step.num} className="text-center relative z-10">
                <div className="w-16 h-16 bg-[#f8fafc] border-2 border-[#e2e8f0] rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <step.icon className="w-7 h-7 text-[#3B82F6]" />
                </div>
                <h3 className="text-lg font-semibold text-[#0F1D2E] mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-[#64748b] leading-relaxed max-w-xs mx-auto">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0F1D2E] text-white py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Lived in an Apartment?
          </h2>
          <p className="text-gray-300 mb-8">
            Help fellow renters by sharing your experience. Rate your building on
            noise, pests, management, and more.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={cityPath("/review/new", "nyc")}
              className="inline-flex items-center justify-center px-6 py-3 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold rounded-lg transition-colors"
            >
              Review an NYC Building
            </a>
            <a
              href={cityPath("/review/new", "los-angeles")}
              className="inline-flex items-center justify-center px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors border border-white/20"
            >
              Review an LA Building
            </a>
            <a
              href={cityPath("/review/new", "chicago")}
              className="inline-flex items-center justify-center px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors border border-white/20"
            >
              Review a Chicago Building
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
