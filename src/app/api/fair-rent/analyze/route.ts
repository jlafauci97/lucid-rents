import { NextResponse } from "next/server";
import { z } from "zod";
import { STREETEASY_URL_REGEX } from "@/lib/fair-rent/constants";
import { scrapeListing, scrapeComps } from "@/lib/fair-rent/streeteasy-scraper";
import { lookupZori } from "@/lib/fair-rent/zori-lookup";
import { calculateFairPrice } from "@/lib/fair-rent/pricing-model";
import {
  fetchViolations,
  fetchComplaints,
  fetchLitigations,
  fetchCrime,
} from "@/lib/fair-rent/nyc-open-data";
import { fetchStabilization } from "@/lib/fair-rent/rent-stabilization";
import { fetchComparables } from "@/lib/fair-rent/comparables";
import type { AnalyzeResponse, ListingData } from "@/components/fair-rent/types";

const requestSchema = z.object({
  url: z.string().regex(STREETEASY_URL_REGEX, "Invalid StreetEasy URL"),
  amenities: z.array(z.string()).optional().default([]),
  manual: z
    .object({
      asking_price: z.number(),
      beds: z.number(),
      sqft: z.number().nullable(),
      zip_code: z.string(),
      address: z.string(),
    })
    .optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please paste a valid StreetEasy listing URL (e.g. streeteasy.com/rental/...)" },
        { status: 400 }
      );
    }

    const { url, amenities, manual } = parsed.data;

    let listing: ListingData | null = null;

    if (manual) {
      listing = {
        asking_price: manual.asking_price,
        beds: manual.beds,
        baths: null,
        sqft: manual.sqft,
        floor: null,
        zip_code: manual.zip_code,
        address: manual.address,
        days_on_market: null,
        price_cut: null,
        listed_amenities: [],
      };
    } else {
      listing = await scrapeListing(url);
    }

    if (!listing) {
      return NextResponse.json(
        {
          error: "scrape_failed",
          message: "We couldn't read that listing automatically. Enter the key details manually to continue.",
        },
        { status: 422 }
      );
    }

    const [compPrices, zori, violations, complaints, stabilization, litigations, crime, comparables] =
      await Promise.all([
        scrapeComps(listing.zip_code, listing.beds, listing.sqft),
        lookupZori(listing.zip_code),
        fetchViolations(listing.address, listing.zip_code),
        fetchComplaints(listing.address, listing.zip_code),
        fetchStabilization(listing.address, listing.zip_code),
        fetchLitigations(listing.address, listing.zip_code),
        fetchCrime(listing.zip_code),
        fetchComparables(listing.address, listing.zip_code, listing.beds),
      ]);

    const pricing = calculateFairPrice(listing, compPrices, zori, amenities);

    const response: AnalyzeResponse = {
      listing,
      pricing,
      violations,
      complaints,
      stabilization,
      litigations,
      crime,
      comparables,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Fair rent analysis error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
