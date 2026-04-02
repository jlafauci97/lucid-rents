import { Metadata } from "next";
import { Suspense } from "react";
import { canonicalUrl } from "@/lib/seo";
import { SeasonalCalculator } from "@/components/rent-calculator/SeasonalCalculator";

export const metadata: Metadata = {
  title: "Best Time to Rent — Seasonal Rent Calculator | Lucid Rents",
  description:
    "Find the cheapest month to sign your lease. Based on 12 years of rental data across NYC, LA, Chicago, Miami, and Houston.",
  alternates: { canonical: canonicalUrl("/rent-timing-calculator") },
  openGraph: {
    title: "Best Time to Rent — Seasonal Rent Calculator",
    description:
      "Find the cheapest month to sign your lease. Based on 12 years of rental data across NYC, LA, Chicago, Miami, and Houston.",
    url: canonicalUrl("/rent-timing-calculator"),
    siteName: "Lucid Rents",
    type: "website",
    locale: "en_US",
  },
};

export default function RentTimingCalculatorPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is the cheapest month to rent an apartment?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "In most major U.S. cities, January and February are the cheapest months to sign a lease. Rental demand is lowest during winter, giving renters more negotiating power and lower prices. Our data across NYC, LA, Chicago, Miami, and Houston confirms that winter months consistently have rent indices 3-8% below the annual average.",
        },
      },
      {
        "@type": "Question",
        name: "What is the most expensive month to rent?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Summer months — particularly June, July, and August — are the most expensive time to sign a lease. This is when demand peaks due to college graduates, family moves timed with school schedules, and generally favorable moving weather. Rents during peak summer can be 3-7% above the annual average.",
        },
      },
      {
        "@type": "Question",
        name: "How much can I save by timing my lease?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Depending on the city and neighborhood, timing your lease to start in the cheapest month instead of the most expensive month can save $500-$2,000+ per year. The savings are largest in high-cost cities like New York and Los Angeles, where even a small percentage difference translates to significant dollar amounts.",
        },
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Hero header */}
      <div className="bg-[#0F1D2E] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 text-center">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">
            When Should You Sign Your Lease?
          </h1>
          <p className="text-sm sm:text-base text-gray-300 max-w-2xl mx-auto">
            Based on 12 years of rental data, we&apos;ve identified when rents
            are cheapest in every neighborhood.
          </p>
        </div>
      </div>

      {/* Calculator */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <SeasonalCalculator />
        </Suspense>

        {/* Disclaimer */}
        <div className="mt-8 border-t border-[#e2e8f0] pt-6">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <svg
              className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86l-8.5 14.14A1.99 1.99 0 003.5 21h17a1.99 1.99 0 001.71-2.99l-8.5-14.15a2 2 0 00-3.42 0z"
              />
            </svg>
            <div className="text-xs text-amber-800 space-y-1">
              <p className="font-semibold">* For Informational Purposes Only</p>
              <p>
                Seasonal rent indices are computed from historical listing data
                and represent average trends. Actual rents vary by building,
                unit, and market conditions. Past seasonal patterns may not
                repeat. This tool is not financial or real-estate advice.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
