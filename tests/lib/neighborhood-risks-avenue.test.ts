import { describe, expect, it } from "vitest";
import { detectAvenueTraffic, extractStreetName } from "@/lib/neighborhood-risks/queries";

describe("detectAvenueTraffic", () => {
  it("flags real NYC avenues (full and abbreviated)", () => {
    expect(detectAvenueTraffic("8112 21 AVENUE, Brooklyn, NY, 11214")).toBe(true);
    expect(detectAvenueTraffic("41 NICHOLS AVENUE, Brooklyn, NY, 11208")).toBe(true);
    expect(detectAvenueTraffic("6-07 GRANDVIEW AVE, Ridgewood, NY 11385")).toBe(true);
    expect(detectAvenueTraffic("1200 Palisade Ave, Union City, NJ, 7087")).toBe(true);
    expect(detectAvenueTraffic("450 5th Ave., New York, NY")).toBe(true);
  });

  it("does not flag side streets / boulevards / places", () => {
    expect(detectAvenueTraffic("128 CENTRAL PARK SOUTH, Manhattan, NY, 10019")).toBe(false);
    expect(detectAvenueTraffic("319 WEST 21 STREET, Manhattan, NY, 10011")).toBe(false);
    expect(detectAvenueTraffic("220 W 58th St, Manhattan, NY")).toBe(false);
    expect(detectAvenueTraffic("47 Hall Street, Brooklyn, NY")).toBe(false);
  });

  it("handles null / undefined / empty inputs", () => {
    expect(detectAvenueTraffic(null)).toBe(false);
    expect(detectAvenueTraffic(undefined)).toBe(false);
    expect(detectAvenueTraffic("")).toBe(false);
  });
});

describe("extractStreetName", () => {
  it("returns the first comma-separated segment", () => {
    expect(extractStreetName("8112 21 AVENUE, Brooklyn, NY, 11214")).toBe("8112 21 AVENUE");
    expect(extractStreetName("128 CENTRAL PARK SOUTH, Manhattan, NY, 10019")).toBe("128 CENTRAL PARK SOUTH");
  });

  it("falls back to the original when no comma", () => {
    expect(extractStreetName("123 Main St")).toBe("123 Main St");
  });
});
