import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NeighborhoodRisksBlock } from "@/components/neighborhood-risks/NeighborhoodRisksBlock";
import { NeighborhoodRisksEmptyBlock } from "@/components/neighborhood-risks/NeighborhoodRisksEmptyBlock";
import { NeighborhoodRisksSensitiveBlock } from "@/components/neighborhood-risks/NeighborhoodRisksSensitiveBlock";

describe("NeighborhoodRisksBlock", () => {
  it("renders title, count, source, and items", () => {
    render(
      <NeighborhoodRisksBlock
        sub_category="homeless_shelter_adult"
        category="public_safety"
        title="Homeless shelters"
        source="NYC DHS"
        count={2}
        unit="sites"
        items={[
          { name: "Catherine St Family", distance_mi: 0.31 },
          { name: "W 58th Adult", distance_mi: 0.62 },
        ]}
      />,
    );
    expect(screen.getByText("Homeless shelters")).toBeDefined();
    expect(screen.getByText("NYC DHS")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("sites")).toBeDefined();
    expect(screen.getByText("Catherine St Family")).toBeDefined();
    // distanceLabel(0.31) === "0.31 mi · 6 min walk"
    expect(screen.getByText(/0\.31 mi/)).toBeDefined();
  });

  it("renders custom pillLabel when provided", () => {
    render(
      <NeighborhoodRisksBlock
        sub_category="sirens"
        category="noise"
        title="Sirens"
        source="FDNY · NYPD · DOHMH"
        count={5}
        pillLabel="High"
      />,
    );
    expect(screen.getByText("High")).toBeDefined();
  });

  it("truncates items beyond MAX_VISIBLE_ITEMS and shows '+ N more'", () => {
    render(
      <NeighborhoodRisksBlock
        sub_category="sirens"
        category="noise"
        title="Sirens"
        source="src"
        count={5}
        items={[
          { name: "A", distance_mi: 0.1 },
          { name: "B", distance_mi: 0.2 },
          { name: "C", distance_mi: 0.3 },
          { name: "D", distance_mi: 0.4 },
          { name: "E", distance_mi: 0.5 },
        ]}
      />,
    );
    expect(screen.getByText("A")).toBeDefined();
    expect(screen.getByText("C")).toBeDefined();
    expect(screen.queryByText("D")).toBeNull();
    expect(screen.getByText("+ 2 more")).toBeDefined();
  });
});

describe("NeighborhoodRisksEmptyBlock", () => {
  it("shows 'All clear' badge and a count of 0", () => {
    render(
      <NeighborhoodRisksEmptyBlock
        sub_category="halfway_house"
        category="public_safety"
        title="Halfway houses"
        source="Federal BOP"
      />,
    );
    expect(screen.getByText("Halfway houses")).toBeDefined();
    expect(screen.getByText("All clear")).toBeDefined();
    expect(screen.getByText("0")).toBeDefined();
  });
});

describe("NeighborhoodRisksSensitiveBlock", () => {
  it("renders count, privacy note, and registry link", () => {
    render(<NeighborhoodRisksSensitiveBlock count={3} />);
    expect(screen.getByText("Sex offender registry")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText(/Privacy first/)).toBeDefined();
    const link = screen.getByRole("link", { name: /view official registry/i });
    expect(link.getAttribute("href")).toContain("criminaljustice.ny.gov");
  });
});
