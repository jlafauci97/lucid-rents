import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mock — vitest hoists vi.mock above imports.
const from = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from })),
}));

import { getHubStats } from "../stats";

describe("getHubStats", () => {
  beforeEach(() => {
    from.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  });

  it("returns aggregated counts from each table", async () => {
    // Map from table name → count value the mocked chain should resolve with.
    const tableCounts: Record<string, number> = {
      news_articles: 4,
      reviews: 17,
      user_profiles: 1523,
      marketing_drafts: 2,
    };

    from.mockImplementation((table: string) => {
      const count = tableCounts[table] ?? 0;
      const result = { data: [], count, error: null };
      // A chainable thenable: every chainable method returns the same object,
      // and awaiting the object resolves to the Supabase-style result.
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "gte", "is", "in", "order", "limit", "head"]) {
        chain[method] = vi.fn(() => chain);
      }
      chain.then = (resolve: (value: typeof result) => unknown) => resolve(result);
      return chain;
    });

    const stats = await getHubStats();

    expect(stats).toMatchObject({
      newsDraftsPending: expect.any(Number),
      reviewsLast24h: expect.any(Number),
      reviewsFlagged: expect.any(Number),
      usersTotal: expect.any(Number),
      usersNewLast7d: expect.any(Number),
      marketingDraftsPending: expect.any(Number),
    });

    // news_articles returns 4 → newsDraftsPending
    expect(stats.newsDraftsPending).toBe(4);
    // marketing_drafts returns 2 → marketingDraftsPending
    expect(stats.marketingDraftsPending).toBe(2);
    // user_profiles returns 1523 → usersTotal and usersNewLast7d (both query same table)
    expect(stats.usersTotal).toBe(1523);
    expect(stats.usersNewLast7d).toBe(1523);
    // reviews returns 17 → reviewsLast24h and reviewsFlagged
    expect(stats.reviewsLast24h).toBe(17);
    expect(stats.reviewsFlagged).toBe(17);
  });

  it("coerces missing counts to 0", async () => {
    from.mockImplementation(() => {
      const result = { data: [], count: null, error: null };
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "gte", "is", "in", "order", "limit", "head"]) {
        chain[method] = vi.fn(() => chain);
      }
      chain.then = (resolve: (value: typeof result) => unknown) => resolve(result);
      return chain;
    });

    const stats = await getHubStats();

    expect(stats).toEqual({
      newsDraftsPending: 0,
      reviewsLast24h: 0,
      reviewsFlagged: 0,
      usersTotal: 0,
      usersNewLast7d: 0,
      marketingDraftsPending: 0,
    });
  });
});
