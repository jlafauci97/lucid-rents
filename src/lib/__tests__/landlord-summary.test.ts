import { describe, it, expect } from "vitest";
import { buildLandlordNLSummary, type LandlordSummaryInput } from "../landlord-summary";

/** A clean single-building landlord: only a building + score + its one neighborhood. */
function base(overrides: Partial<LandlordSummaryInput> = {}): LandlordSummaryInput {
  return {
    name: "Acme Realty LLC",
    city: "nyc",
    buildingCount: 1,
    totalViolations: 0,
    totalComplaints: 0,
    avgScore: 5,
    worstBuildingAddress: null,
    worstBuildingViolations: null,
    totalReviews: 0,
    avgRating: 0,
    neighborhoods: [{ name: "Carroll Gardens", buildingCount: 1 }],
    ...overrides,
  };
}

describe("buildLandlordNLSummary", () => {
  it("suppresses a clean single-building landlord (a lone neighborhood is not a distinct signal)", () => {
    // buildingCount + lucidIq = 2 data points; the single neighborhood does not
    // count, so the gate (≥3) fails and no boilerplate is emitted.
    expect(buildLandlordNLSummary(base())).toBeNull();
  });

  it("returns null when there is nothing to say (no score, no issues, no reviews)", () => {
    expect(
      buildLandlordNLSummary(base({ avgScore: null, neighborhoods: [] }))
    ).toBeNull();
  });

  it("renders a rich, data-grounded paragraph for a multi-building violator", () => {
    const out = buildLandlordNLSummary(
      base({
        name: "Flatbush Gardens Housing",
        buildingCount: 6,
        avgScore: 2.8,
        totalViolations: 12419,
        totalComplaints: 6606,
        worstBuildingAddress: "1368 New York Avenue, Brooklyn, NY 11210",
        worstBuildingViolations: 3696,
        totalReviews: 18,
        avgRating: 2.1,
        neighborhoods: [
          { name: "Flatbush", buildingCount: 4 },
          { name: "East Flatbush", buildingCount: 2 },
        ],
      })
    );
    expect(out).not.toBeNull();
    expect(out).toContain("owns a portfolio of 6 buildings");
    expect(out).toContain("across 2 neighborhoods in NYC");
    expect(out).toContain("average LucidIQ score of 2.8 out of 5");
    expect(out).toContain("12,419 open violations and 6,606 complaints on file");
    expect(out).toContain("most-cited building, 1368 New York Avenue, accounts for 3,696 violations");
    expect(out).toContain("18 verified tenant reviews across this portfolio, averaging 2.1 out of 5");
  });

  it("uses singular phrasing and omits the most-cited line for a single-building landlord with real signal", () => {
    const out = buildLandlordNLSummary(
      base({
        buildingCount: 1,
        avgScore: 3,
        totalViolations: 12,
        worstBuildingAddress: "123 Main St, Brooklyn, NY 11201",
        worstBuildingViolations: 12,
        totalReviews: 4,
        avgRating: 3.5,
      })
    );
    expect(out).not.toBeNull();
    expect(out).toContain("owns a single building in Carroll Gardens, NYC");
    expect(out).toContain("The building holds a LucidIQ score of 3.0 out of 5");
    expect(out).toContain("12 open violations on file");
    expect(out).toContain("4 verified tenant reviews on this building, averaging 3.5 out of 5");
    // A single-building owner has no "most-cited" building distinct from the whole.
    expect(out).not.toContain("most-cited");
  });

  it("renders a multi-building portfolio with a clean record (size + spread + score)", () => {
    const out = buildLandlordNLSummary(
      base({
        buildingCount: 5,
        avgScore: 4.2,
        neighborhoods: [
          { name: "Astoria", buildingCount: 2 },
          { name: "Long Island City", buildingCount: 2 },
          { name: "Sunnyside", buildingCount: 1 },
        ],
      })
    );
    expect(out).not.toBeNull();
    expect(out).toContain("owns a portfolio of 5 buildings across 3 neighborhoods in NYC");
    expect(out).toContain("average LucidIQ score of 4.2 out of 5");
  });

  it("drops the average-rating clause when reviews exist but no rating is available", () => {
    const out = buildLandlordNLSummary(
      base({
        buildingCount: 3,
        avgScore: 3,
        totalViolations: 40,
        totalReviews: 2,
        avgRating: 0,
        neighborhoods: [
          { name: "Bushwick", buildingCount: 2 },
          { name: "Ridgewood", buildingCount: 1 },
        ],
      })
    );
    expect(out).not.toBeNull();
    expect(out).toContain("2 verified tenant reviews across this portfolio.");
    expect(out).not.toContain("averaging");
  });
});
