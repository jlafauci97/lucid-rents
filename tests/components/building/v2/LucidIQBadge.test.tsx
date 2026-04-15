import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { LucidIQBadge } from "@/components/building/v2/LucidIQBadge";

describe("LucidIQBadge", () => {
  it("shows the grade letter", () => {
    render(<LucidIQBadge grade="B+" rating={3.9} />);
    expect(screen.getByText("B+")).toBeInTheDocument();
  });
  it("shows the rating numerically", () => {
    render(<LucidIQBadge grade="A" rating={4.6} />);
    expect(screen.getByText(/4\.6/)).toBeInTheDocument();
  });
});
