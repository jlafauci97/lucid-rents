import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatTile } from "../StatTile";

describe("StatTile", () => {
  it("renders value and label", () => {
    render(<StatTile value={42} label="users online" />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("users online")).toBeInTheDocument();
  });
});
