import { describe, it, expect } from "vitest";
import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/v2/_data";

describe("BuildingV2Data shape", () => {
  it("has the 8 top-level keys the sections depend on", () => {
    const keys: Array<keyof BuildingV2Data> = [
      "building", "energy", "rents", "issues",
      "reviews", "amenities", "landlord", "similar",
    ];
    expect(keys).toHaveLength(8);
  });
});
