import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NeighborhoodRisksJumpNav } from "@/components/neighborhood-risks/NeighborhoodRisksJumpNav";
import type { NeighborhoodRisksResult } from "@/lib/neighborhood-risks/types";

const result: NeighborhoodRisksResult = {
  building: { id: "b1", name: "T", address: "x", borough: "Manhattan", neighborhood: "M", lat: 0, lng: 0, slug: "t" },
  groups: [
    { sub_category: "homeless_shelter_adult", category: "public_safety", total_count: 4, items: [] },
    { sub_category: "sirens", category: "noise", total_count: 5, items: [] },
    { sub_category: "dsny_garage", category: "environmental", total_count: 1, items: [] },
  ],
  sex_offender_count: 3,
  block_level: { rat_failures: 8, noise_311: 187, noise_311_on_block: 42, bedbug_history: 4 },
  calm_score: 6.4,
  calm_score_breakdown: [],
  total_concerns: 0,
  within_block_count: 0,
};

describe("NeighborhoodRisksJumpNav", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders 4 pills with counts derived from result", () => {
    render(<NeighborhoodRisksJumpNav result={result} />);
    expect(screen.getByText("Jump to:")).toBeDefined();
    // public_safety: 4 (shelter) + 3 (sex offender) = 7
    expect(screen.getByText("7")).toBeDefined();
    // noise: 5
    expect(screen.getByText("5")).toBeDefined();
    // environmental: 1
    expect(screen.getByText("1")).toBeDefined();
    // block_level: 8 + 187 + 4 = 199
    expect(screen.getByText("199")).toBeDefined();
  });

  it("calls scrollIntoView on the matching section when a pill is clicked", () => {
    const section = document.createElement("section");
    section.id = "section-noise";
    const scrollSpy = vi.fn();
    section.scrollIntoView = scrollSpy;
    document.body.appendChild(section);

    render(<NeighborhoodRisksJumpNav result={result} />);
    const noisePill = screen.getByRole("button", { name: /24\/7/i });
    fireEvent.click(noisePill);
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });
});
