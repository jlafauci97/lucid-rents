import { describe, expect, it } from "vitest";
import { groupBySubCategory } from "@/lib/neighborhood-risks/queries";
import type { ConcernRow } from "@/lib/neighborhood-risks/types";

const row = (overrides: Partial<ConcernRow>): ConcernRow => ({
  id: 1,
  category: "public_safety",
  sub_category: "homeless_shelter_adult",
  name: "X",
  address: null,
  source: "s",
  source_url: null,
  distance_mi: 0.2,
  ...overrides,
});

describe("groupBySubCategory", () => {
  it("groups rows by sub_category and counts each", () => {
    const groups = groupBySubCategory([
      row({ sub_category: "homeless_shelter_adult", name: "Shelter A" }),
      row({ sub_category: "homeless_shelter_adult", name: "Shelter B" }),
      row({ sub_category: "methadone_clinic", name: "Clinic A" }),
    ]);
    expect(groups).toHaveLength(2);
    const shelterGroup = groups.find((g) => g.sub_category === "homeless_shelter_adult")!;
    expect(shelterGroup.total_count).toBe(2);
    expect(shelterGroup.items.map((i) => i.name)).toEqual(["Shelter A", "Shelter B"]);
    const methadoneGroup = groups.find((g) => g.sub_category === "methadone_clinic")!;
    expect(methadoneGroup.total_count).toBe(1);
  });

  it("returns empty array for empty input", () => {
    expect(groupBySubCategory([])).toEqual([]);
  });

  it("preserves input order within each group", () => {
    const groups = groupBySubCategory([
      row({ distance_mi: 0.1, name: "Close" }),
      row({ distance_mi: 0.5, name: "Far" }),
      row({ distance_mi: 0.3, name: "Middle" }),
    ]);
    expect(groups[0].items.map((i) => i.name)).toEqual(["Close", "Far", "Middle"]);
  });
});
