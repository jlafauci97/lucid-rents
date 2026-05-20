import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NeighborhoodRisksSection } from "@/components/neighborhood-risks/NeighborhoodRisksSection";
import type { NeighborhoodRisksResult } from "@/lib/neighborhood-risks/types";

const baseResult: NeighborhoodRisksResult = {
  building: {
    id: "b1", name: "Test", address: "123 Main", borough: "Manhattan",
    neighborhood: "Midtown", lat: 40.76, lng: -73.98, slug: "test",
  },
  groups: [
    {
      sub_category: "homeless_shelter_adult",
      category: "public_safety",
      total_count: 2,
      items: [
        { id: 1, category: "public_safety", sub_category: "homeless_shelter_adult", name: "Shelter A", address: null, source: "s", source_url: null, distance_mi: 0.31 },
        { id: 2, category: "public_safety", sub_category: "homeless_shelter_adult", name: "Shelter B", address: null, source: "s", source_url: null, distance_mi: 0.62 },
      ],
    },
  ],
  sex_offender_count: 3,
  block_level: { rat_failures: 4, noise_311: 50, noise_311_on_block: 12, bedbug_history: 0 },
  calm_score: 6.4,
  calm_score_breakdown: [],
  total_concerns: 5,
  within_block_count: 0,
};

describe("NeighborhoodRisksSection", () => {
  it("renders public_safety section with shelter block + sensitive block + empty blocks for others", () => {
    render(<NeighborhoodRisksSection category="public_safety" result={baseResult} />);
    expect(screen.getByText("Public-safety facilities")).toBeDefined();
    expect(screen.getByText("Homeless shelters")).toBeDefined();
    expect(screen.getByText("Shelter A")).toBeDefined();
    // Sex offender sensitive block renders for public_safety
    expect(screen.getByText("Sex offender registry")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    // Empty blocks for sub-categories with no data
    expect(screen.getByText("Methadone / OASAS")).toBeDefined();
  });

  it("renders block_level section synthesized from result.block_level", () => {
    render(<NeighborhoodRisksSection category="block_level" result={baseResult} />);
    expect(screen.getByText("Block-level reputation")).toBeDefined();
    expect(screen.getByText("Rat sightings (12mo)")).toBeDefined();
    expect(screen.getByText("311 noise complaints (90d)")).toBeDefined();
    expect(screen.getByText("Bedbug history (3yr)")).toBeDefined();
    // noise_311_on_block triggers custom pill label
    expect(screen.getByText(/12 on block/i)).toBeDefined();
  });

  it("attaches the right scroll-id to the section element", () => {
    const { container } = render(<NeighborhoodRisksSection category="environmental" result={baseResult} />);
    expect(container.querySelector("#section-environmental")).not.toBeNull();
  });
});
