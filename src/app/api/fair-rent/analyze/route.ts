import { NextResponse } from "next/server";
import { z } from "zod";
import { scrapeComps } from "@/lib/fair-rent/streeteasy-scraper";
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
import { createClient } from "@/lib/supabase/server";
import type { AnalyzeResponse, ListingData, ViolationsSignal, ComplaintsSignal, StabilizationSignal } from "@/components/fair-rent/types";

const requestSchema = z.object({
  url: z.string(),
  amenities: z.array(z.string()).optional().default([]),
  building_id: z.string().optional(),
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

/**
 * When a building_id is provided, pull violations/complaints/stabilization
 * directly from our DB instead of hitting NYC Open Data APIs.
 */
async function fetchBuildingSignalsFromDB(buildingId: string): Promise<{
  violations: ViolationsSignal | null;
  complaints: ComplaintsSignal | null;
  stabilization: StabilizationSignal | null;
  dbViolationCount: number;
  dbComplaintCount: number;
}> {
  try {
    const supabase = await createClient();

    const { data: building } = await supabase
      .from("buildings")
      .select("violation_count, complaint_count, is_rent_stabilized, stabilized_units, total_units, zip_code")
      .eq("id", buildingId)
      .single();

    if (!building) return { violations: null, complaints: null, stabilization: null, dbViolationCount: 0, dbComplaintCount: 0 };

    // Estimate ZIP medians by sampling a few buildings in the same ZIP
    const { data: zipSample } = await supabase
      .from("buildings")
      .select("violation_count, complaint_count")
      .eq("metro", "nyc")
      .eq("zip_code", building.zip_code)
      .gt("total_units", 0)
      .order("violation_count", { ascending: true })
      .limit(50);

    const vCounts = (zipSample ?? []).map((b) => b.violation_count ?? 0).sort((a, b) => a - b);
    const cCounts = (zipSample ?? []).map((b) => b.complaint_count ?? 0).sort((a, b) => a - b);
    const zipViolMedian = vCounts.length > 0 ? vCounts[Math.floor(vCounts.length / 2)] : 20;
    const zipComplaintMedian = cCounts.length > 0 ? cCounts[Math.floor(cCounts.length / 2)] : 10;

    // Build violation signal from DB data
    const vCount = building.violation_count ?? 0;
    const vClassification = vCount > zipViolMedian * 1.5 ? "above_average" as const
      : vCount < zipViolMedian * 0.5 ? "below_average" as const : "average" as const;

    const violations: ViolationsSignal = {
      open_a: 0,
      open_b: 0,
      open_c: Math.round(vCount * 0.15), // estimate ~15% are Class C
      closed_12mo: 0,
      zip_median: zipViolMedian,
      classification: vClassification,
      summary: `This building has ${vCount} total HPD violations. ZIP median is ${zipViolMedian}. This building is ${vClassification.replace("_", " ")}.`,
    };
    // Set open counts to total (our DB stores total, not open/closed breakdown)
    violations.open_a = Math.round(vCount * 0.25);
    violations.open_b = Math.round(vCount * 0.60);

    // Build complaint signal from DB data
    const cCount = building.complaint_count ?? 0;
    const cClassification = cCount > zipComplaintMedian * 1.5 ? "above_average" as const
      : cCount < zipComplaintMedian * 0.5 ? "below_average" as const : "average" as const;

    const complaints: ComplaintsSignal = {
      total_complaints: cCount,
      top_categories: [],
      zip_median: zipComplaintMedian,
      classification: cClassification,
      summary: `This building had ${cCount} complaints. ZIP median is ${zipComplaintMedian}. This building is ${cClassification.replace("_", " ")}.`,
    };

    // Build stabilization signal from DB
    const stabilization: StabilizationSignal = {
      is_stabilized: building.is_rent_stabilized === true,
      stabilized_units: building.stabilized_units,
      total_units: building.total_units,
      yoy_unit_change_pct: null,
      summary: building.is_rent_stabilized
        ? `This building is rent stabilized. ${building.stabilized_units ?? "Some"} of ~${building.total_units ?? "?"} units are covered.`
        : "This building is not rent stabilized. Market rate rules apply.",
    };

    return { violations, complaints, stabilization, dbViolationCount: vCount, dbComplaintCount: cCount };
  } catch {
    return { violations: null, complaints: null, stabilization: null, dbViolationCount: 0, dbComplaintCount: 0 };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request. Please search for a building and enter your rent." },
        { status: 400 }
      );
    }

    const { amenities, building_id, manual } = parsed.data;

    if (!manual) {
      return NextResponse.json(
        { error: "Please enter the listing details." },
        { status: 400 }
      );
    }

    const listing: ListingData = {
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

    // If we have a building_id, pull signals from our own DB (fast + reliable)
    // Otherwise fall back to NYC Open Data APIs
    let violations, complaints, stabilization;

    if (building_id) {
      const dbSignals = await fetchBuildingSignalsFromDB(building_id);
      violations = dbSignals.violations;
      complaints = dbSignals.complaints;
      stabilization = dbSignals.stabilization;
    }

    // Fetch remaining data in parallel
    const [compPrices, zori, apiViolations, apiComplaints, apiStabilization, litigations, crime, comparables] =
      await Promise.all([
        scrapeComps(listing.zip_code, listing.beds, listing.sqft),
        lookupZori(listing.zip_code),
        !building_id ? fetchViolations(listing.address, listing.zip_code) : Promise.resolve(null),
        !building_id ? fetchComplaints(listing.address, listing.zip_code) : Promise.resolve(null),
        !building_id ? fetchStabilization(listing.address, listing.zip_code) : Promise.resolve(null),
        fetchLitigations(listing.address, listing.zip_code),
        fetchCrime(listing.zip_code),
        fetchComparables(listing.address, listing.zip_code, listing.beds),
      ]);

    // Use DB signals if available, fall back to API
    violations = violations ?? apiViolations;
    complaints = complaints ?? apiComplaints;
    stabilization = stabilization ?? apiStabilization;

    const pricing = calculateFairPrice(listing, compPrices, zori, amenities, {
      violations,
      complaints,
      crime,
      litigations,
      stabilization,
    });

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
