import { describe, it, expect } from "vitest";
import {
  computeNeighborhoodRiskGrade,
  rateToScore,
} from "@/lib/neighborhood-risks/composite";

const crimeFree = { total: 0, violent: 0, property: 0, quality_of_life: 0 };

describe("rateToScore", () => {
  it("returns 100 for a zero rate", () => {
    expect(rateToScore(0, 12)).toBe(100);
  });

  it("returns 0 at or beyond the ceiling", () => {
    expect(rateToScore(12, 12)).toBe(0);
    expect(rateToScore(50, 12)).toBe(0);
  });

  it("is monotonically decreasing", () => {
    expect(rateToScore(1, 12)).toBeGreaterThan(rateToScore(3, 12));
    expect(rateToScore(3, 12)).toBeGreaterThan(rateToScore(8, 12));
  });
});

describe("computeNeighborhoodRiskGrade", () => {
  it("returns null for empty/zero-building input", () => {
    expect(computeNeighborhoodRiskGrade({ buildingCount: 0 })).toBeNull();
    expect(computeNeighborhoodRiskGrade({ buildingCount: -5 })).toBeNull();
    expect(computeNeighborhoodRiskGrade({ buildingCount: NaN })).toBeNull();
  });

  it("returns null when every signal is missing", () => {
    expect(
      computeNeighborhoodRiskGrade({
        buildingCount: 100,
        totalViolations: null,
        totalComplaints: null,
        crime: null,
      }),
    ).toBeNull();
  });

  it("grades an all-good neighborhood in the A range", () => {
    const result = computeNeighborhoodRiskGrade({
      buildingCount: 500,
      totalViolations: 50, // 0.1 per building
      totalComplaints: 25, // 0.05 per building
      crime: { total: 20, violent: 5, property: 10, quality_of_life: 5 },
    });
    expect(result).not.toBeNull();
    expect(result!.grade).toBe("A");
    expect(result!.score).toBeGreaterThan(80);
    expect(result!.components).toHaveLength(4);
  });

  it("grades a crime-heavy neighborhood low even with decent buildings", () => {
    const result = computeNeighborhoodRiskGrade({
      buildingCount: 100,
      totalViolations: 100, // 1 per building — fine
      totalComplaints: 50, // 0.5 per building — fine
      crime: {
        total: 4000,
        violent: 1100, // 11 per building — near ceiling
        property: 1000,
        quality_of_life: 2500, // 25 per building — near ceiling
      },
    });
    expect(result).not.toBeNull();
    expect(result!.score).toBeLessThan(50);
    expect(["D", "F", "C"]).toContain(result!.grade);
    const crimeComp = result!.components.find((c) => c.key === "crime")!;
    expect(crimeComp.score).toBeLessThan(10);
  });

  it("renormalizes weights when crime data is missing", () => {
    const result = computeNeighborhoodRiskGrade({
      buildingCount: 200,
      totalViolations: 0,
      totalComplaints: 0,
      crime: null,
    });
    expect(result).not.toBeNull();
    // Only violations + complaints present; concerns has no proxy without crime.
    expect(result!.components.map((c) => c.key).sort()).toEqual([
      "complaints",
      "violations",
    ]);
    const weightSum = result!.components.reduce((s, c) => s + c.weight, 0);
    expect(weightSum).toBeCloseTo(1, 2);
    // Missing crime data must not auto-fail: perfect buildings → A.
    expect(result!.grade).toBe("A");
    expect(result!.score).toBe(100);
  });

  it("redistributes weight proportionally among present components", () => {
    // violations base 0.30, complaints base 0.15 → renormalized 2/3 and 1/3.
    const result = computeNeighborhoodRiskGrade({
      buildingCount: 100,
      totalViolations: 0, // score 100
      totalComplaints: 100000, // way past ceiling → score 0
      crime: null,
    });
    expect(result).not.toBeNull();
    const violations = result!.components.find((c) => c.key === "violations")!;
    const complaints = result!.components.find((c) => c.key === "complaints")!;
    expect(violations.weight).toBeCloseTo(2 / 3, 2);
    expect(complaints.weight).toBeCloseTo(1 / 3, 2);
    expect(result!.score).toBeCloseTo(100 * (2 / 3), 0);
  });

  it("uses explicit concernCount over the quality-of-life proxy", () => {
    const withConcerns = computeNeighborhoodRiskGrade({
      buildingCount: 100,
      crime: { ...crimeFree, quality_of_life: 2900 },
      concernCount: 0,
    });
    const withProxy = computeNeighborhoodRiskGrade({
      buildingCount: 100,
      crime: { ...crimeFree, quality_of_life: 2900 },
    });
    const concernsA = withConcerns!.components.find((c) => c.key === "concerns")!;
    const concernsB = withProxy!.components.find((c) => c.key === "concerns")!;
    expect(concernsA.score).toBe(100);
    expect(concernsB.score).toBeLessThan(10);
  });

  it("emits weights summing to ~1 with all components present", () => {
    const result = computeNeighborhoodRiskGrade({
      buildingCount: 100,
      totalViolations: 300,
      totalComplaints: 200,
      crime: { total: 500, violent: 100, property: 200, quality_of_life: 200 },
    });
    const sum = result!.components.reduce((s, c) => s + c.weight, 0);
    expect(sum).toBeCloseTo(1, 2);
    // Base weights apply unmodified when nothing is missing.
    expect(result!.components.find((c) => c.key === "crime")!.weight).toBeCloseTo(0.4, 3);
    expect(result!.components.find((c) => c.key === "violations")!.weight).toBeCloseTo(0.3, 3);
  });
});
