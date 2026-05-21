import { describe, expect, it } from "vitest";
import { formatDistance, walkMinutes, isOnBlock, distanceLabel } from "@/lib/neighborhood-risks/distance";

describe("formatDistance", () => {
  it("formats < 0.1 mi as 'on block'", () => {
    expect(formatDistance(0.05)).toBe("on block");
    expect(formatDistance(0.099)).toBe("on block");
  });
  it("formats with 2 decimals at and above 0.1 mi", () => {
    expect(formatDistance(0.1)).toBe("0.10 mi");
    expect(formatDistance(0.31)).toBe("0.31 mi");
    expect(formatDistance(0.755)).toBe("0.76 mi");
  });
});

describe("walkMinutes", () => {
  it("uses 3 mph (~20 min/mi) and rounds, minimum 1", () => {
    expect(walkMinutes(0.5)).toBe(10);
    expect(walkMinutes(0.05)).toBe(1);
    expect(walkMinutes(0)).toBe(1);
    expect(walkMinutes(0.075)).toBe(2); // 1.5 rounds to 2
  });
});

describe("isOnBlock", () => {
  it("returns true strictly under 0.1 mi", () => {
    expect(isOnBlock(0.09)).toBe(true);
    expect(isOnBlock(0.1)).toBe(false);
    expect(isOnBlock(0.11)).toBe(false);
  });
});

describe("distanceLabel", () => {
  it("returns 'on block' for short distances", () => {
    expect(distanceLabel(0.05)).toBe("on block");
  });
  it("returns 'X mi · Y min walk' otherwise", () => {
    expect(distanceLabel(0.31)).toBe("0.31 mi · 6 min walk");
    expect(distanceLabel(0.5)).toBe("0.50 mi · 10 min walk");
  });
});
