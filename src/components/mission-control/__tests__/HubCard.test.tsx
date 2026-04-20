import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HubCard } from "../HubCard";

describe("HubCard", () => {
  it("renders title, description, stat, and link to href", () => {
    render(
      <HubCard
        title="News Drafts"
        description="Approve AI-generated articles"
        href="/mission-control/news-drafts"
        stat={{ value: 7, label: "pending" }}
        tone="primary"
      />,
    );
    expect(screen.getByText("News Drafts")).toBeInTheDocument();
    expect(screen.getByText("Approve AI-generated articles")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /open/i });
    expect(link).toHaveAttribute("href", "/mission-control/news-drafts");
  });

  it("renders warning tone when tone=warning", () => {
    const { container } = render(
      <HubCard
        title="Reviews"
        description=""
        href="/mission-control/reviews"
        stat={{ value: 3, label: "flagged" }}
        tone="warning"
      />,
    );
    expect(container.firstChild).toHaveClass(/amber/);
  });
});
