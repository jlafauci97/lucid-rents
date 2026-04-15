import { describe, it, expect, afterEach } from "vitest";
import { isBuildingV2Enabled } from "@/lib/flags";

describe("isBuildingV2Enabled", () => {
  const original = process.env.NEXT_PUBLIC_ENABLE_BUILDING_V2;
  afterEach(() => { process.env.NEXT_PUBLIC_ENABLE_BUILDING_V2 = original; });

  it("returns false when env var unset", () => {
    delete process.env.NEXT_PUBLIC_ENABLE_BUILDING_V2;
    expect(isBuildingV2Enabled()).toBe(false);
  });

  it("returns true when env var is '1'", () => {
    process.env.NEXT_PUBLIC_ENABLE_BUILDING_V2 = "1";
    expect(isBuildingV2Enabled()).toBe(true);
  });

  it("returns true when env var is 'true'", () => {
    process.env.NEXT_PUBLIC_ENABLE_BUILDING_V2 = "true";
    expect(isBuildingV2Enabled()).toBe(true);
  });

  it("returns false for other values", () => {
    process.env.NEXT_PUBLIC_ENABLE_BUILDING_V2 = "no";
    expect(isBuildingV2Enabled()).toBe(false);
  });
});
