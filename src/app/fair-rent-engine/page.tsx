import { Metadata } from "next";
import { canonicalUrl } from "@/lib/seo";
import { FairRentApp } from "@/components/fair-rent/FairRentApp";

export const metadata: Metadata = {
  title: "Fair Rent Engine — Know Your Rent Before You Sign | NYC",
  description:
    "Free tool for NYC renters. Paste a StreetEasy listing and get fair market pricing, building quality scores, rent stabilization status, and neighborhood safety data — all from public records.",
  alternates: { canonical: canonicalUrl("/fair-rent-engine") },
  openGraph: {
    title: "Fair Rent Engine — Know Your Rent Before You Sign",
    description:
      "Fair market pricing, hidden red flags, and negotiation leverage for any NYC rental listing. 100% free, 100% public data.",
    url: canonicalUrl("/fair-rent-engine"),
    siteName: "Lucid Rents",
    type: "website",
  },
};

export default function FairRentEnginePage() {
  return <FairRentApp />;
}
