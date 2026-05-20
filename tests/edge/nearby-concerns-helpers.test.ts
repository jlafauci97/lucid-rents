import { describe, expect, it } from "vitest";
import { buildConcernRow, normalizeSubCategory } from "../../supabase/functions/_shared/nearby-concerns-helpers";

describe("buildConcernRow", () => {
  it("builds a valid row with computed geom", () => {
    const row = buildConcernRow({
      metro: "nyc",
      category: "public_safety",
      sub_category: "homeless_shelter_adult",
      name: "Test Shelter",
      lat: 40.7679,
      lng: -73.9819,
      source: "nyc_open_data_dhs_dropin",
      source_record_id: "dropin-001",
    });
    expect(row.geom).toBe("SRID=4326;POINT(-73.9819 40.7679)");
    expect(row.active).toBe(true);
    expect(row.metro).toBe("nyc");
  });

  it("throws on invalid category", () => {
    expect(() =>
      buildConcernRow({
        metro: "nyc",
        // @ts-expect-error testing invalid input
        category: "invalid",
        sub_category: "x",
        name: "x",
        lat: 0,
        lng: 0,
        source: "x",
        source_record_id: "x",
      }),
    ).toThrow(/category/);
  });

  it("throws on missing source_record_id", () => {
    expect(() =>
      buildConcernRow({
        metro: "nyc",
        category: "public_safety",
        sub_category: "x",
        name: "x",
        lat: 0,
        lng: 0,
        source: "x",
        source_record_id: "",
      }),
    ).toThrow(/source_record_id/);
  });

  it("throws on missing name", () => {
    expect(() =>
      buildConcernRow({
        metro: "nyc",
        category: "public_safety",
        sub_category: "x",
        name: "  ",
        lat: 0,
        lng: 0,
        source: "x",
        source_record_id: "y",
      }),
    ).toThrow(/name/);
  });

  it("throws on non-number lat/lng", () => {
    expect(() =>
      buildConcernRow({
        metro: "nyc",
        category: "public_safety",
        sub_category: "x",
        name: "x",
        // @ts-expect-error testing
        lat: "40",
        lng: -73,
        source: "x",
        source_record_id: "y",
      }),
    ).toThrow(/lat\/lng/);
  });

  it("preserves metadata and optional fields", () => {
    const row = buildConcernRow({
      metro: "nyc",
      category: "noise",
      sub_category: "sirens",
      name: "FDNY Engine 23",
      address: "215 W 58th St",
      borough: "Manhattan",
      neighborhood: "Midtown",
      lat: 40.7670,
      lng: -73.9820,
      source: "fdny",
      source_record_id: "E23",
      source_url: "https://www.fdny.gov/",
      metadata: { facility_type: "firehouse" },
    });
    expect(row.address).toBe("215 W 58th St");
    expect(row.borough).toBe("Manhattan");
    expect(row.metadata).toEqual({ facility_type: "firehouse" });
    expect(row.source_url).toBe("https://www.fdny.gov/");
  });
});

describe("normalizeSubCategory", () => {
  it("snake_cases mixed input", () => {
    expect(normalizeSubCategory("Homeless Shelter Adult")).toBe("homeless_shelter_adult");
    expect(normalizeSubCategory("dropin-center")).toBe("dropin_center");
    expect(normalizeSubCategory("  Mixed  Spaces  ")).toBe("mixed_spaces");
  });
});
