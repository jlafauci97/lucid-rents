import { describe, it, expect } from "vitest";
import { buildingNeighborhood } from "@/lib/neighborhoods";

describe("buildingNeighborhood", () => {
  it("returns resolved neighborhood for a known NYC zip", () => {
    const result = buildingNeighborhood({ zip_code: "10009", borough: "Manhattan" }, "nyc");
    expect(result.isFallback).toBe(false);
    expect(typeof result.name).toBe("string");
    expect(result.name.length).toBeGreaterThan(0);
  });

  it("falls back to borough when zip_code is null", () => {
    const result = buildingNeighborhood({ zip_code: null, borough: "Queens" }, "nyc");
    expect(result).toEqual({ name: "Queens", isFallback: true });
  });

  it("falls back to borough when zip has no mapping", () => {
    const result = buildingNeighborhood({ zip_code: "00000", borough: "Brooklyn" }, "nyc");
    expect(result).toEqual({ name: "Brooklyn", isFallback: true });
  });

  it("works for non-NYC cities", () => {
    const result = buildingNeighborhood({ zip_code: "90028", borough: "Hollywood" }, "los-angeles");
    expect(typeof result.name).toBe("string");
    expect(result.name.length).toBeGreaterThan(0);
  });
});
