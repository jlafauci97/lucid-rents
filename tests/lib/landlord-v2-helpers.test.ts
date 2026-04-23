import { describe, it, expect } from "vitest";
import {
  computeGradeDistribution,
  pickPeerLandlords,
  aggregateRegions,
} from "@/lib/landlord-v2-helpers";
import type { PeerCandidate } from "@/lib/landlord-v2-helpers";

describe("computeGradeDistribution", () => {
  it("buckets scores into A/B/C/D/F", () => {
    const d = computeGradeDistribution([
      { overall_score: 4.7 },    // A
      { overall_score: 4.0 },    // A
      { overall_score: 3.5 },    // B
      { overall_score: 3.0 },    // B
      { overall_score: 2.5 },    // C
      { overall_score: 1.5 },    // D
      { overall_score: 0.5 },    // F
      { overall_score: null },   // F
    ]);
    expect(d).toEqual({ A: 2, B: 2, C: 1, D: 1, F: 2 });
  });

  it("handles legacy 0-100 scores via normalizeScore", () => {
    const d = computeGradeDistribution([{ overall_score: 95 }, { overall_score: 30 }]);
    // 95/20 = 4.75 → A; 30/20 = 1.5 → D
    expect(d.A).toBe(1);
    expect(d.D).toBe(1);
  });

  it("returns all zeros for empty input", () => {
    expect(computeGradeDistribution([])).toEqual({ A: 0, B: 0, C: 0, D: 0, F: 0 });
  });

  it("threshold boundary: 3.65 is A", () => {
    const d = computeGradeDistribution([{ overall_score: 3.65 }]);
    expect(d.A).toBe(1);
  });

  it("threshold boundary: 3.64 is B", () => {
    const d = computeGradeDistribution([{ overall_score: 3.64 }]);
    expect(d.B).toBe(1);
  });

  it("threshold boundary: 1.0 is D", () => {
    const d = computeGradeDistribution([{ overall_score: 1.0 }]);
    expect(d.D).toBe(1);
  });

  it("threshold boundary: 0.9 is F", () => {
    const d = computeGradeDistribution([{ overall_score: 0.9 }]);
    expect(d.F).toBe(1);
  });
});

describe("pickPeerLandlords", () => {
  const base = (o: Partial<PeerCandidate>): PeerCandidate => ({
    name: "X", slug: "x", metro: "nyc", buildingCount: 100, unitCount: 1000, avgScore: 3.0,
    ...o,
  });

  it("returns top 4 by closest avgScore from same metro within ±40% building count", () => {
    const current = base({ name: "Current", slug: "current", buildingCount: 100, avgScore: 3.0 });
    const peers = [
      base({ name: "Same size same score", slug: "a", buildingCount: 100, avgScore: 3.0 }),  // 0 diff
      base({ name: "Same size close score", slug: "b", buildingCount: 100, avgScore: 3.2 }), // 0.2
      base({ name: "Similar size", slug: "c", buildingCount: 110, avgScore: 3.5 }),          // 0.5
      base({ name: "At band edge", slug: "d", buildingCount: 140, avgScore: 3.1 }),          // 0.1
      base({ name: "Too big", slug: "e", buildingCount: 200, avgScore: 3.0 }),               // excluded
      base({ name: "Too small", slug: "f", buildingCount: 50, avgScore: 3.0 }),              // excluded
      base({ name: "Wrong metro", slug: "g", metro: "chicago", buildingCount: 100, avgScore: 3.0 }), // excluded
    ];
    const result = pickPeerLandlords(current, peers);
    expect(result).toHaveLength(4);
    expect(result.map((r) => r.slug)).toEqual(["a", "d", "b", "c"]);
  });

  it("excludes self by slug", () => {
    const current = base({ slug: "me", buildingCount: 100, avgScore: 3.0 });
    const peers = [
      base({ slug: "me", buildingCount: 100, avgScore: 3.0 }),
      base({ slug: "other", buildingCount: 100, avgScore: 3.0 }),
    ];
    const result = pickPeerLandlords(current, peers);
    expect(result.map((r) => r.slug)).toEqual(["other"]);
  });

  it("ranks null avgScore last", () => {
    const current = base({ buildingCount: 100, avgScore: 3.0 });
    const peers = [
      base({ slug: "nullscore", buildingCount: 100, avgScore: null }),
      base({ slug: "faraway",   buildingCount: 100, avgScore: 4.5 }), // 1.5 diff
      base({ slug: "close",     buildingCount: 100, avgScore: 3.1 }), // 0.1 diff
    ];
    expect(pickPeerLandlords(current, peers).map((r) => r.slug))
      .toEqual(["close", "faraway", "nullscore"]);
  });

  it("uses ±40% band: 100-building current accepts 60-140", () => {
    const current = base({ buildingCount: 100, avgScore: 3.0 });
    const candidates = [
      base({ slug: "60-ok", buildingCount: 60, avgScore: 3.0 }),
      base({ slug: "59-out", buildingCount: 59, avgScore: 3.0 }),
      base({ slug: "140-ok", buildingCount: 140, avgScore: 3.0 }),
      base({ slug: "141-out", buildingCount: 141, avgScore: 3.0 }),
    ];
    const slugs = pickPeerLandlords(current, candidates).map((r) => r.slug);
    expect(slugs).toContain("60-ok");
    expect(slugs).toContain("140-ok");
    expect(slugs).not.toContain("59-out");
    expect(slugs).not.toContain("141-out");
  });

  it("returns fewer than 4 when fewer eligible candidates exist", () => {
    const current = base({ buildingCount: 100, avgScore: 3.0 });
    const peers = [
      base({ slug: "only-one", buildingCount: 100, avgScore: 3.0 }),
    ];
    expect(pickPeerLandlords(current, peers)).toHaveLength(1);
  });

  it("returns empty array when no eligible candidates", () => {
    const current = base({ buildingCount: 100, avgScore: 3.0 });
    const peers = [
      base({ slug: "too-big", buildingCount: 200, avgScore: 3.0 }),
      base({ slug: "wrong-metro", metro: "chicago", buildingCount: 100, avgScore: 3.0 }),
    ];
    expect(pickPeerLandlords(current, peers)).toHaveLength(0);
  });
});

describe("aggregateRegions", () => {
  it("groups NYC buildings by borough, computes share", () => {
    const buildings = [
      { zip_code: "10025", borough: "Manhattan" },
      { zip_code: "10031", borough: "Manhattan" },
      { zip_code: "11211", borough: "Brooklyn" },
      { zip_code: "10451", borough: "Bronx" },
    ];
    const regions = aggregateRegions(buildings, "nyc");
    expect(regions[0].name).toBe("Manhattan");
    expect(regions[0].count).toBe(2);
    expect(regions[0].share).toBeCloseTo(0.5, 2);
    expect(regions).toHaveLength(3);
    expect(regions.every((r) => r.topConcern === null)).toBe(true);
  });

  it("returns empty array for no buildings", () => {
    expect(aggregateRegions([], "nyc")).toEqual([]);
  });

  it("sorts by count descending", () => {
    const buildings = [
      { zip_code: "10025", borough: "Manhattan" },
      { zip_code: "11211", borough: "Brooklyn" },
      { zip_code: "11211", borough: "Brooklyn" },
      { zip_code: "11211", borough: "Brooklyn" },
    ];
    const regions = aggregateRegions(buildings, "nyc");
    expect(regions.map((r) => r.name)).toEqual(["Brooklyn", "Manhattan"]);
  });

  it("share sums to 1.0 across all regions", () => {
    const buildings = [
      { zip_code: "10025", borough: "Manhattan" },
      { zip_code: "11211", borough: "Brooklyn" },
      { zip_code: "10451", borough: "Bronx" },
      { zip_code: "11101", borough: "Queens" },
    ];
    const regions = aggregateRegions(buildings, "nyc");
    const totalShare = regions.reduce((sum, r) => sum + r.share, 0);
    expect(totalShare).toBeCloseTo(1.0, 5);
  });

  it("falls back to borough name for unrecognized zip", () => {
    const buildings = [
      { zip_code: null, borough: "Queens" },
      { zip_code: null, borough: "Queens" },
    ];
    const regions = aggregateRegions(buildings, "nyc");
    expect(regions).toHaveLength(1);
    expect(regions[0].name).toBe("Queens");
    expect(regions[0].count).toBe(2);
  });

  it("sets topConcern to null for all regions (Phase 1)", () => {
    const buildings = [
      { zip_code: "10025", borough: "Manhattan" },
    ];
    const regions = aggregateRegions(buildings, "nyc");
    expect(regions[0].topConcern).toBeNull();
  });
});
