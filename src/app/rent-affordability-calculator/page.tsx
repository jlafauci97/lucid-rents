import { Metadata } from "next";
import { Suspense } from "react";
import { canonicalUrl } from "@/lib/seo";
import { AffordabilityDisclaimer } from "@/components/rent-calculator/AffordabilityDisclaimer";
import { AffordabilityWizardLoader } from "@/components/rent-calculator/AffordabilityWizardLoader";

export const metadata: Metadata = {
  title: "Rent Affordability Calculator — Can I Afford to Live Here? | Lucid Rents",
  description:
    "Find out how much rent you can actually afford. Enter your income and expenses, then discover which neighborhoods in NYC, LA, Chicago, Miami, or Houston fit your budget — backed by real rent data.",
  alternates: { canonical: canonicalUrl("/rent-affordability-calculator") },
  openGraph: {
    title: "Rent Affordability Calculator — Can I Afford to Live Here?",
    description:
      "Enter your income and expenses and discover which neighborhoods fit your budget. Powered by real rent data across 5 major U.S. cities.",
    url: canonicalUrl("/rent-affordability-calculator"),
    siteName: "Lucid Rents",
    type: "website",
    locale: "en_US",
  },
};

export default function RentCalculatorPage() {
  // JSON-LD: FAQPage schema for featured snippet opportunities
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How much rent can I afford?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Financial experts recommend spending no more than 30% of your gross monthly income on rent. For example, if you earn $60,000/year ($5,000/month), your max rent should be around $1,500/month. However, factors like debt, utilities, and savings goals may lower this amount.",
        },
      },
      {
        "@type": "Question",
        name: "What is the 30% rule for rent?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The 30% rule states that you should spend no more than 30% of your gross (pre-tax) monthly income on rent. This guideline helps ensure you have enough left over for other expenses, savings, and discretionary spending.",
        },
      },
      {
        "@type": "Question",
        name: "What is the 50/30/20 budget rule?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The 50/30/20 rule divides your after-tax income into three categories: 50% for needs (rent, utilities, groceries, insurance), 30% for wants (dining out, entertainment), and 20% for savings and debt repayment. Rent should fit within the 50% needs category alongside other essentials.",
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
            Rent Affordability Calculator
          </h1>
          <p className="text-sm sm:text-base text-gray-300 max-w-xl mx-auto">
            Discover how much rent you can comfortably afford and which
            neighborhoods match your budget.
          </p>
        </div>
      </div>

      {/* Wizard */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <AffordabilityWizardLoader />
        </Suspense>

        {/* Disclaimer */}
        <AffordabilityDisclaimer />
      </div>
    </div>
  );
}
