import { canonicalUrl } from "@/lib/seo";
import type { Metadata } from "next";
import { Building2, Database, Shield, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "About Lucid Rents | NYC Apartment Transparency Platform",
  description:
    "We built Lucid Rents so every renter gets the same intel that landlords and brokers already have — violations, reviews, crime data, and more. Always free.",
  alternates: { canonical: canonicalUrl("/about") },
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-[#0F1D2E] mb-2">
        About Lucid Rents
      </h1>
      <p className="text-sm text-[#94a3b8] mb-8">
        Transparency for NYC renters
      </p>

      <div className="prose prose-slate max-w-none space-y-8 text-[#334155] text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            Our Mission
          </h2>
          <p>
            Lucid Rents is a free platform built to help New York City renters
            make informed decisions before signing a lease. We believe every
            tenant deserves access to the same information that landlords,
            brokers, and property managers already have. By aggregating public
            records and community reviews into one easy-to-use tool, we aim to
            level the playing field for millions of NYC renters.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            What We Do
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 not-prose">
            <div className="border border-[#e2e8f0] rounded-lg p-4">
              <Building2 className="w-5 h-5 text-[#3B82F6] mb-2" />
              <h3 className="font-semibold text-[#0F1D2E] text-sm mb-1">
                Building Profiles
              </h3>
              <p className="text-xs text-[#64748b]">
                Detailed pages for over 50,000 NYC buildings with violation
                histories, complaints, and tenant reviews.
              </p>
            </div>
            <div className="border border-[#e2e8f0] rounded-lg p-4">
              <Database className="w-5 h-5 text-[#3B82F6] mb-2" />
              <h3 className="font-semibold text-[#0F1D2E] text-sm mb-1">
                Public Data
              </h3>
              <p className="text-xs text-[#64748b]">
                HPD violations, DOB violations, 311 complaints, NYPD crime
                data, rent stabilization records, and more — updated daily.
              </p>
            </div>
            <div className="border border-[#e2e8f0] rounded-lg p-4">
              <Users className="w-5 h-5 text-[#3B82F6] mb-2" />
              <h3 className="font-semibold text-[#0F1D2E] text-sm mb-1">
                Tenant Reviews
              </h3>
              <p className="text-xs text-[#64748b]">
                Real reviews from current and former tenants covering
                management, maintenance, pests, noise, and more.
              </p>
            </div>
            <div className="border border-[#e2e8f0] rounded-lg p-4">
              <Shield className="w-5 h-5 text-[#3B82F6] mb-2" />
              <h3 className="font-semibold text-[#0F1D2E] text-sm mb-1">
                Tenant Tools
              </h3>
              <p className="text-xs text-[#64748b]">
                Rent affordability calculator, rent stabilization checker,
                building comparison, energy scores, transit search, and more
                — all free.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            Our Data Sources
          </h2>
          <p>
            Lucid Rents aggregates publicly available data from official New
            York City government sources, including:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>
              <strong>HPD Violations</strong> — NYC Department of Housing
              Preservation and Development
            </li>
            <li>
              <strong>DOB Violations</strong> — NYC Department of Buildings
            </li>
            <li>
              <strong>311 Complaints</strong> — NYC 311 Service Requests
            </li>
            <li>
              <strong>NYPD Crime Data</strong> — NYPD Complaint Data
            </li>
            <li>
              <strong>PLUTO</strong> — NYC Department of City Planning tax lot
              data
            </li>
            <li>
              <strong>Rent Stabilization</strong> — NYC Tax Commission RPIE
              filings
            </li>
            <li>
              <strong>Energy Scores</strong> — NYC Benchmarking (Local Law 84/133)
            </li>
            <li>
              <strong>Transit Data</strong> — MTA GTFS static feeds
            </li>
          </ul>
          <p className="mt-3">
            All data is sourced from NYC Open Data and other official public
            datasets. We sync our database daily to ensure information is as
            current as possible.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            Contact Us
          </h2>
          <p>
            Have questions, feedback, or data correction requests? Reach out at{" "}
            <a
              href="mailto:admin@lucidrents.com"
              className="text-[#3B82F6] hover:underline"
            >
              admin@lucidrents.com
            </a>
            . You can also visit our{" "}
            <a href="/contact" className="text-[#3B82F6] hover:underline">
              Contact page
            </a>{" "}
            for more ways to get in touch.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            Disclaimer
          </h2>
          <p>
            Lucid Rents is an informational tool. While we strive for accuracy,
            we do not guarantee the completeness or timeliness of any data
            displayed on this site. The information provided should not be
            considered legal advice. Always verify critical details independently
            before making housing decisions.
          </p>
        </section>
      </div>
    </div>
  );
}
