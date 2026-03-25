"use client";

import Link from "next/link";
import { type City, CITY_META } from "@/lib/cities";
import { cityPath } from "@/lib/seo";
import { useCityFromPath } from "@/lib/city-context";

const DATA_SOURCES: Record<City, string[]> = {
  nyc: [
    "NYC Open Data - HPD Violations",
    "NYC Open Data - DOB Violations",
    "NYC Open Data - 311 Complaints",
    "NYC PLUTO Building Data",
  ],
  "los-angeles": [
    "LA Open Data - LAHD Violations",
    "LA Open Data - LADBS Permits",
    "LA Open Data - 311 Complaints",
    "LA County Assessor Data",
    "LAHD Soft-Story Inventory",
  ],
  chicago: [
    "Chicago Open Data - Building Violations",
    "Chicago Open Data - 311 Requests",
    "Chicago Open Data - CPD Crime",
    "Cook County Assessor Data",
    "Chicago Energy Benchmarking",
  ],
  miami: [
    "Miami-Dade Open Data - Code Violations",
    "Miami-Dade Open Data - 311 Requests",
    "Miami-Dade Open Data - MDPD Crime",
    "Miami-Dade Property Appraiser",
    "Miami-Dade 40-Year Recertification",
    "FEMA Flood Zone Data",
  ],
};

export function Footer() {
  const city = useCityFromPath();
  const cityName = CITY_META[city]?.fullName || "New York City";
  return (
    <footer className="bg-[#0F1D2E] text-gray-400 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-white font-bold text-lg mb-3">
              <span className="text-[#3B82F6]">Lucid</span> Rents
            </h3>
            <p className="text-sm">
              Know your {cityName} apartment before you sign. Real data, real reviews,
              real transparency.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-3">
              Navigation
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={cityPath("/search", city)} className="hover:text-white transition-colors">
                  Search Buildings
                </Link>
              </li>
              <li>
                <Link href={cityPath("/review/new", city)} className="hover:text-white transition-colors">
                  Submit a Review
                </Link>
              </li>
              <li>
                <Link href={cityPath("/news", city)} className="hover:text-white transition-colors">
                  {cityName} Housing News
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-3">
              Data Sources
            </h4>
            <ul className="space-y-2 text-sm">
              {(DATA_SOURCES[city] || DATA_SOURCES.nyc).map((source) => (
                <li key={source}>{source}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-3">
              Legal
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-700 mt-8 pt-8 text-sm text-center">
          <p>
            &copy; {new Date().getFullYear()} Lucid Rents. All rights reserved.
            {" · "}
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            {" · "}
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            {" · "}
            <Link href="/dashboard/mission-control" className="text-gray-600 hover:text-gray-400 transition-colors">Admin</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
