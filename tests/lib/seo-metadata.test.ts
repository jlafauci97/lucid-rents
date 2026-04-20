import { describe, it, expect } from "vitest";
import {
  buildBuildingTitle,
  buildBuildingDescription,
  buildBuildingH1,
  buildBuildingLeadParagraph,
  buildLandlordTitle,
  buildLandlordDescription,
} from "@/lib/seo-metadata";

describe("buildBuildingTitle", () => {
  const base = {
    shortAddress: "240 1st Ave",
    neighborhood: "Stuyvesant Town",
    city: "nyc" as const,
  };

  it("formats the standard template", () => {
    expect(buildBuildingTitle(base)).toBe(
      "240 1st Ave: Reviews, Violations & Score | Stuyvesant Town, NYC"
    );
  });

  it("uses 'LA' short name for los-angeles", () => {
    expect(
      buildBuildingTitle({ shortAddress: "1600 Vine St", neighborhood: "Hollywood", city: "los-angeles" })
    ).toBe("1600 Vine St: Reviews, Violations & Score | Hollywood, LA");
  });

  it("drops ' Violations &' clause when title exceeds 70 chars", () => {
    const long = buildBuildingTitle({
      shortAddress: "1234 Very Long Example Street Name",
      neighborhood: "A Somewhat Long Neighborhood Name",
      city: "nyc",
    });
    expect(long.length).toBeLessThanOrEqual(70);
    expect(long).not.toMatch(/Violations &/);
    expect(long).toContain("Reviews");
    expect(long).toContain("Score");
  });

  it("drops city suffix as a last resort", () => {
    const veryLong = buildBuildingTitle({
      shortAddress: "12345 Extremely Long Address Name Goes Here",
      neighborhood: "An Even Longer Neighborhood Descriptor Name",
      city: "chicago",
    });
    expect(veryLong.length).toBeLessThanOrEqual(70);
  });
});

describe("buildBuildingDescription", () => {
  const base = {
    shortAddress: "240 1st Ave",
    neighborhood: "Stuyvesant Town",
    issues: 70,
    reviewCount: 12,
    overallScore: 4.2,
  };

  it("renders all clauses when they fit", () => {
    expect(buildBuildingDescription(base)).toBe(
      "240 1st Ave in Stuyvesant Town: 70 issues filed, 12 tenant reviews, LucidIQ 4.2/5. Free rent intelligence."
    );
  });

  it("shows '0 reviews yet' when reviewCount is 0", () => {
    expect(buildBuildingDescription({ ...base, reviewCount: 0 })).toMatch(/0 reviews yet/);
  });

  it("omits LucidIQ clause when overallScore is null", () => {
    const d = buildBuildingDescription({ ...base, overallScore: null });
    expect(d).not.toMatch(/LucidIQ/);
    expect(d).toContain("70 issues filed");
    expect(d).toContain("12 tenant reviews");
  });

  it("stays under 160 chars even with long inputs", () => {
    const d = buildBuildingDescription({
      shortAddress: "12345 Some Moderately Long Street Name",
      neighborhood: "A Long Neighborhood Name With Extra Words",
      issues: 999_999,
      reviewCount: 9999,
      overallScore: 4.7,
    });
    expect(d.length).toBeLessThanOrEqual(160);
  });

  it("drops closer first, then LucidIQ, then reviews to fit under 155", () => {
    const d = buildBuildingDescription({
      shortAddress: "12345 Extremely Long Street Name That Goes On",
      neighborhood: "Unusually Long Neighborhood Name Example",
      issues: 1234,
      reviewCount: 567,
      overallScore: 4.9,
    });
    expect(d.length).toBeLessThanOrEqual(155);
    expect(d).toContain("issues filed");
  });
});

describe("buildBuildingH1", () => {
  it("includes neighborhood and cityShort", () => {
    expect(
      buildBuildingH1({ shortAddress: "240 1st Ave", neighborhood: "Stuyvesant Town", city: "nyc" })
    ).toBe("240 1st Ave — Rent Intelligence for Stuyvesant Town, NYC");
  });
});

describe("buildBuildingLeadParagraph", () => {
  it("includes unit count when present", () => {
    const p = buildBuildingLeadParagraph({
      fullAddress: "240 1st Ave, New York, NY 10009",
      neighborhood: "Stuyvesant Town",
      city: "nyc",
      totalUnits: 412,
    });
    expect(p).toContain("412-unit rental building");
    expect(p).toContain("Stuyvesant Town, NYC");
  });

  it("omits unit count when total_units is null", () => {
    const p = buildBuildingLeadParagraph({
      fullAddress: "240 1st Ave, New York, NY 10009",
      neighborhood: "Stuyvesant Town",
      city: "nyc",
      totalUnits: null,
    });
    expect(p).not.toMatch(/\d+-unit/);
    expect(p).toContain("rental building");
  });
});

describe("buildLandlordTitle", () => {
  it("formats with counts", () => {
    expect(
      buildLandlordTitle({
        name: "Stellar Management",
        buildingCount: 412,
        totalIssues: 8947,
        city: "nyc",
      })
    ).toBe("Stellar Management: 412 Buildings, 8,947 Issues Filed & Tenant Reviews | NYC");
  });
});

describe("buildLandlordDescription", () => {
  it("includes name, counts, and city long name", () => {
    const d = buildLandlordDescription({
      name: "Stellar Management",
      buildingCount: 412,
      totalIssues: 8947,
      city: "nyc",
    });
    expect(d).toContain("Stellar Management's 412");
    expect(d).toContain("8,947 violations + 311 complaints");
    expect(d).toContain("New York City");
  });
});
