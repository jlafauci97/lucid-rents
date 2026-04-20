import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/mission-control/reviews",
}));

import { MCSidebar } from "../MCSidebar";

describe("MCSidebar", () => {
  it("renders links to all 5 features + hub home", () => {
    render(<MCSidebar />);
    expect(screen.getByRole("link", { name: /hub/i })).toHaveAttribute("href", "/mission-control");
    expect(screen.getByRole("link", { name: /news drafts/i })).toHaveAttribute("href", "/mission-control/news-drafts");
    expect(screen.getByRole("link", { name: /syncs/i })).toHaveAttribute("href", "/mission-control/syncs");
    expect(screen.getByRole("link", { name: /users/i })).toHaveAttribute("href", "/mission-control/users");
    expect(screen.getByRole("link", { name: /reviews/i })).toHaveAttribute("href", "/mission-control/reviews");
    expect(screen.getByRole("link", { name: /marketing/i })).toHaveAttribute("href", "/mission-control/marketing");
  });

  it("marks current path as aria-current=page", () => {
    render(<MCSidebar />);
    const active = screen.getByRole("link", { name: /reviews/i });
    expect(active).toHaveAttribute("aria-current", "page");
  });
});
