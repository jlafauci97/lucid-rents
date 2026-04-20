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

  it("drops closer first when full string exceeds 155", () => {
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

  it("drops LucidIQ when even noCloser exceeds 155", () => {
    // noCloser=161 > 155, noScore=146 <= 155 — forces Step 2 (drop LucidIQ)
    const d = buildBuildingDescription({
      shortAddress: "12345 An Unusually Long Street Name Going On Forever",
      neighborhood: "A Long And Descriptive Neighborhood Name Example",
      issues: 12345,
      reviewCount: 678,
      overallScore: 4.9,
    });
    expect(d.length).toBeLessThanOrEqual(155);
    expect(d).not.toMatch(/LucidIQ/);
    expect(d).not.toMatch(/Free rent intelligence/);
    expect(d).toContain("tenant reviews");
  });

  it("drops reviews when even noScore exceeds 155, and truncates with ellipsis when only firstClause remains > 155", () => {
    // firstOnly=196 > 155 — forces Step 4 (ellipsis truncation)
    const d = buildBuildingDescription({
      shortAddress: "12345 An Absurdly Long Street Name That Will Not Fit In Any Reasonable Meta Description Tag At All",
      neighborhood: "An Equally Long Neighborhood Descriptor Name Designed To Blow The Cap",
      issues: 9999999,
      reviewCount: 99999,
      overallScore: 4.5,
    });
    expect(d.length).toBeLessThanOrEqual(155);
    expect(d.endsWith("…")).toBe(true);
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

  it("stays under 160 chars for the example fixture", () => {
    const d = buildLandlordDescription({
      name: "Stellar Management",
      buildingCount: 412,
      totalIssues: 8947,
      city: "nyc",
    });
    expect(d.length).toBeLessThanOrEqual(160);
  });

  it("stays under 160 chars even for large portfolios with long names", () => {
    const d = buildLandlordDescription({
      name: "Highbridge House Ogden LLC Property Management Division",
      buildingCount: 1247,
      totalIssues: 25431,
      city: "nyc",
    });
    expect(d.length).toBeLessThanOrEqual(160);
  });
});

describe("metro matrix — char caps hold across 5 metros", () => {
  const cases = [
    { shortAddress: "240 1st Ave", neighborhood: "Stuyvesant Town", city: "nyc" as const },
    { shortAddress: "1600 Vine St", neighborhood: "Hollywood", city: "los-angeles" as const },
    { shortAddress: "875 N Michigan Ave", neighborhood: "Gold Coast", city: "chicago" as const },
    { shortAddress: "1100 Brickell Bay Dr", neighborhood: "Brickell", city: "miami" as const },
    { shortAddress: "1600 Smith St", neighborhood: "Downtown", city: "houston" as const },
  ] as const;

  it.each(cases)("title ≤70 for %o", (input) => {
    expect(buildBuildingTitle(input).length).toBeLessThanOrEqual(70);
  });

  it.each(cases)("description ≤160 for %o", (input) => {
    const d = buildBuildingDescription({
      shortAddress: input.shortAddress,
      neighborhood: input.neighborhood,
      issues: 1234,
      reviewCount: 56,
      overallScore: 4.1,
    });
    expect(d.length).toBeLessThanOrEqual(160);
  });
});
