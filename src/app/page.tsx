import { SearchBar } from "@/components/search/SearchBar";
import { ActivityFeed } from "@/components/ActivityFeed";
import { LiveStats } from "@/components/home/LiveStats";
import { NearbyBuildings } from "@/components/home/NearbyBuildings";
import { ViolationTicker } from "@/components/home/ViolationTicker";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { FileSearch, Users, Shield } from "lucide-react";

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
      {/* Hero */}
      <section className="bg-[#0F1D2E] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
            Check Your Address
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            See the truth about any NYC building before you sign.
            Violations, complaints, tenant reviews, and crime data — all in one place.
          </p>
          <div className="max-w-2xl mx-auto">
            <SearchBar size="hero" placeholder="Enter any NYC address, zip code, or neighborhood..." />
          </div>
          <p className="text-sm text-gray-400 mt-4">
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

      {/* Ad */}
      <AdBlock adSlot="HOME_MID_1" adFormat="horizontal" />

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
            href="/review/new"
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
