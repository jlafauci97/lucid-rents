import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NeighborhoodRisksHero } from "@/components/neighborhood-risks/NeighborhoodRisksHero";
import type { NeighborhoodRisksResult } from "@/lib/neighborhood-risks/types";

const result: NeighborhoodRisksResult = {
  building: {
    id: "b1",
    name: "220 Central Park South",
    address: "220 Central Park S",
    borough: "Manhattan",
    neighborhood: "Midtown",
    lat: 40.7679,
    lng: -73.9819,
    slug: "220-central-park-south",
  },
  groups: [],
  sex_offender_count: 0,
  block_level: { rat_failures: 0, noise_311: 0, noise_311_on_block: 0, bedbug_history: 0 },
  total_concerns: 21,
  within_block_count: 2,
};

describe("NeighborhoodRisksHero", () => {
  it("renders the building name, breadcrumbs, eyebrow, and stats", () => {
    render(<NeighborhoodRisksHero result={result} />);
    expect(screen.getByText("220 Central Park South")).toBeDefined();
    expect(screen.getByText(/Neighborhood Risks Report/i)).toBeDefined();
    expect(screen.getByText("Midtown")).toBeDefined();
    expect(screen.getByText("Manhattan, NY")).toBeDefined();
    expect(screen.getByText(/0\.75 mi radius/)).toBeDefined();
    expect(screen.getByText("21")).toBeDefined(); // total_concerns
    expect(screen.getByText("2")).toBeDefined(); // within_block_count
  });

  it("falls back gracefully when neighborhood is empty", () => {
    const r = { ...result, building: { ...result.building, neighborhood: "" } };
    render(<NeighborhoodRisksHero result={r} />);
    expect(screen.getByText("Neighborhood")).toBeDefined();
  });
});
