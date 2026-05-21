import { describe, expect, it } from "vitest";
import { computeCalmScore } from "@/lib/neighborhood-risks/calm-score";

const noPOI = { close: 0, far: 0 };
const emptyPenalties = { public_safety: { ...noPOI }, noise: { ...noPOI }, environmental: { ...noPOI } };
const standardBaselines = { noise_311: 30, rats: 5, bedbugs: 2 };

describe("computeCalmScore", () => {
  it("returns 10.0 for a building with zero concerns", () => {
    const r = computeCalmScore({
      poiPenalties: emptyPenalties,
      blockLevel: { noise_311: 0, rats: 0, bedbugs: 0 },
      baselines: standardBaselines,
    });
    expect(r.score).toBe(10.0);
    expect(r.breakdown).toEqual([]);
  });

  it("applies public-safety close penalty", () => {
    const r = computeCalmScore({
      poiPenalties: { ...emptyPenalties, public_safety: { close: 2, far: 0 } },
      blockLevel: { noise_311: 0, rats: 0, bedbugs: 0 },
      baselines: standardBaselines,
    });
    expect(r.score).toBe(9.0); // 10 - (2 * 0.5)
    expect(r.breakdown).toContainEqual({ reason: "2 public-safety POIs within 0.25 mi", penalty: -1.0 });
  });

  it("applies noise far penalty", () => {
    const r = computeCalmScore({
      poiPenalties: { ...emptyPenalties, noise: { close: 0, far: 4 } },
      blockLevel: { noise_311: 0, rats: 0, bedbugs: 0 },
      baselines: standardBaselines,
    });
    expect(r.score).toBeCloseTo(9.4, 1); // 10 - (4 * 0.15)
  });

  it("applies block-level penalties at thresholds", () => {
    const r = computeCalmScore({
      poiPenalties: emptyPenalties,
      blockLevel: { noise_311: 45, rats: 0, bedbugs: 0 }, // 1.5x of 30
      baselines: standardBaselines,
    });
    expect(r.breakdown).toContainEqual({ reason: "311 noise complaints ≥ 1.5× NYC median", penalty: -0.5 });
  });

  it("applies block-level severe penalty at 3x", () => {
    const r = computeCalmScore({
      poiPenalties: emptyPenalties,
      blockLevel: { noise_311: 100, rats: 0, bedbugs: 0 }, // > 3x of 30
      baselines: standardBaselines,
    });
    expect(r.score).toBe(9.0); // 10 - 1.0 (only the ≥3× penalty applies, NOT both)
  });

  it("clamps to 0", () => {
    const r = computeCalmScore({
      poiPenalties: { ...emptyPenalties, public_safety: { close: 100, far: 0 } },
      blockLevel: { noise_311: 999, rats: 999, bedbugs: 999 },
      baselines: standardBaselines,
    });
    expect(r.score).toBe(0.0);
  });

  it("rounds to 1 decimal", () => {
    const r = computeCalmScore({
      poiPenalties: { ...emptyPenalties, noise: { close: 1, far: 0 } },
      blockLevel: { noise_311: 0, rats: 0, bedbugs: 0 },
      baselines: standardBaselines,
    });
    expect(r.score).toBe(9.6); // 10 - 0.4
  });
});
