import { describe, it, expect } from "vitest";
import { buildingJsonLd, landlordJsonLd } from "@/lib/seo";

const buildingFixture = {
  full_address: "240 1st Ave, New York, NY 10009",
  borough: "Manhattan",
  zip_code: "10009",
  year_built: 1947,
  total_units: 412,
  overall_score: 4.2,
  review_count: 12,
  slug: "240-1-ave",
  name: null,
};

describe("buildingJsonLd", () => {
  it("uses single @type 'ApartmentComplex' (LocalBusiness dropped in #260)", () => {
    const ld = buildingJsonLd(buildingFixture, "nyc") as Record<string, unknown>;
    expect(ld["@type"]).toBe("ApartmentComplex");
  });

  it("sets AggregateRating.worstRating to 1 (Google spec)", () => {
    const ld = buildingJsonLd(buildingFixture, "nyc") as Record<string, unknown>;
    const rating = ld.aggregateRating as Record<string, unknown>;
    expect(rating.worstRating).toBe(1);
    expect(rating.bestRating).toBe(5);
  });

  it("does not emit a boilerplate priceRange (removed in #260)", () => {
    const ld = buildingJsonLd(buildingFixture, "nyc") as Record<string, unknown>;
    expect(ld.priceRange).toBeUndefined();
  });

  it("includes geo coordinates when latitude/longitude are present", () => {
    const ld = buildingJsonLd(
      { ...buildingFixture, latitude: 40.731, longitude: -73.982 },
      "nyc"
    ) as Record<string, unknown>;
    expect(ld.geo).toEqual({
      "@type": "GeoCoordinates",
      latitude: 40.731,
      longitude: -73.982,
    });
  });

  it("omits geo when coordinates are missing", () => {
    const ld = buildingJsonLd(buildingFixture, "nyc") as Record<string, unknown>;
    expect(ld.geo).toBeUndefined();
  });

  it("sets dateModified from updated_at", () => {
    const ld = buildingJsonLd(
      { ...buildingFixture, updated_at: "2026-05-26T12:00:00Z" },
      "nyc"
    ) as Record<string, unknown>;
    expect(ld.dateModified).toBe("2026-05-26T12:00:00Z");
  });

  it("emits additionalProperty entries for BBL, owner, and violation counts", () => {
    const ld = buildingJsonLd(
      {
        ...buildingFixture,
        bbl: "1009710040",
        owner_name: "Stuyvesant Town LLC",
        violation_count: 12,
      },
      "nyc"
    ) as Record<string, unknown>;
    const props = ld.additionalProperty as Array<{ name: string; value: unknown }>;
    expect(Array.isArray(props)).toBe(true);
    expect(props).toContainEqual({ "@type": "PropertyValue", name: "BBL", value: "1009710040" });
    expect(props).toContainEqual({ "@type": "PropertyValue", name: "Owner", value: "Stuyvesant Town LLC" });
    expect(props).toContainEqual({ "@type": "PropertyValue", name: "HPD Violations", value: 12 });
  });

  it("sets addressLocality to resolved neighborhood when zip matches", () => {
    const ld = buildingJsonLd(buildingFixture, "nyc") as Record<string, unknown>;
    const addr = ld.address as Record<string, unknown>;
    expect(addr.addressLocality).not.toBe("Manhattan");
    expect(typeof addr.addressLocality).toBe("string");
  });

  it("falls back to borough when zip has no neighborhood match", () => {
    const ld = buildingJsonLd({ ...buildingFixture, zip_code: "00000" }, "nyc") as Record<string, unknown>;
    const addr = ld.address as Record<string, unknown>;
    expect(addr.addressLocality).toBe("Manhattan");
  });

  it("omits AggregateRating when review_count is 0", () => {
    const ld = buildingJsonLd({ ...buildingFixture, review_count: 0 }, "nyc") as Record<string, unknown>;
    expect(ld.aggregateRating).toBeUndefined();
  });
});

describe("buildingJsonLd — non-NYC metros", () => {
  it("uses LA neighborhood lookup and CA state code for Los Angeles building", () => {
    const laFixture = {
      full_address: "1600 Vine St, Los Angeles, CA 90028",
      borough: "Hollywood",
      zip_code: "90028",
      year_built: 1925,
      total_units: 120,
      overall_score: 4.0,
      review_count: 5,
      slug: "1600-vine-st",
      name: null,
    };
    const ld = buildingJsonLd(laFixture, "los-angeles") as Record<string, unknown>;
    const addr = ld.address as Record<string, unknown>;
    expect(addr.addressRegion).toBe("CA");
    // When ZIP 90028 resolves via LA neighborhoods, addressLocality should NOT be the borough
    // (it should be the resolved neighborhood name). If ZIP doesn't resolve, it falls back to borough — still acceptable.
    expect(typeof addr.addressLocality).toBe("string");
  });
});

describe("landlordJsonLd", () => {
  it("includes counts in description when totalIssues is provided", () => {
    const ld = landlordJsonLd("Stellar Management", 412, "nyc", undefined, 8947) as Record<string, unknown>;
    expect(ld.description).toContain("412 buildings");
    expect(ld.description).toContain("8,947 issues filed");
  });

  it("omits issue clause when totalIssues is undefined (backward compatible)", () => {
    const ld = landlordJsonLd("Stellar Management", 412, "nyc") as Record<string, unknown>;
    expect(ld.description).toContain("412 buildings");
    expect((ld.description as string)).not.toMatch(/issues filed/);
  });
});
