import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks — vitest hoists vi.mock above imports.
const authAdmin = {
  getUserById: vi.fn(),
};
const from = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: { admin: authAdmin }, from })),
}));

import { listRecentReviews, moderateReview } from "../reviews";

/**
 * Builds a chainable thenable that mimics the supabase-js query builder.
 * Every method returns the same object; awaiting it resolves with `result`.
 * Spy calls to `in`/`eq`/`update` are captured on the returned chain.
 */
function chainable(result: { data?: unknown; count?: number | null; error?: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "is", "in", "order", "limit", "head", "maybeSingle", "update", "upsert"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: typeof result) => unknown) => resolve(result);
  return chain;
}

describe("listRecentReviews", () => {
  beforeEach(() => {
    from.mockReset();
    authAdmin.getUserById.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  });

  it("returns rows joined with building + reviewer email", async () => {
    from.mockImplementation(() =>
      chainable({
        data: [
          {
            id: "r1",
            user_id: "u1",
            reviewer_name: null,
            building_id: "b1",
            title: "Great place",
            overall_rating: 5,
            status: "published",
            created_at: "2026-04-18T00:00:00Z",
            buildings: { full_address: "123 Main St", metro: "nyc" },
          },
          {
            id: "r2",
            user_id: null,
            reviewer_name: "Jane (scraped)",
            building_id: "b2",
            title: "Noisy neighbors",
            overall_rating: 2,
            status: "flagged",
            created_at: "2026-04-17T00:00:00Z",
            buildings: { full_address: "456 Elm St", metro: "la" },
          },
        ],
        error: null,
      }),
    );

    authAdmin.getUserById.mockImplementation(async (id: string) => {
      if (id === "u1") return { data: { user: { email: "alice@example.com" } }, error: null };
      return { data: { user: null }, error: null };
    });

    const results = await listRecentReviews({ limit: 50 });

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      id: "r1",
      user_id: "u1",
      reviewer_name: null,
      reviewer_email: "alice@example.com",
      building_id: "b1",
      building_address: "123 Main St",
      building_city: "nyc",
      title: "Great place",
      overall_rating: 5,
      status: "published",
      created_at: "2026-04-18T00:00:00Z",
    });
    expect(results[1]).toEqual({
      id: "r2",
      user_id: null,
      reviewer_name: "Jane (scraped)",
      reviewer_email: null,
      building_id: "b2",
      building_address: "456 Elm St",
      building_city: "la",
      title: "Noisy neighbors",
      overall_rating: 2,
      status: "flagged",
      created_at: "2026-04-17T00:00:00Z",
    });

    // getUserById called only for distinct non-null user_ids
    expect(authAdmin.getUserById).toHaveBeenCalledTimes(1);
    expect(authAdmin.getUserById).toHaveBeenCalledWith("u1");
  });

  it("applies 'published-like' filter using .in(['published','approved'])", async () => {
    const chain = chainable({ data: [], error: null });
    from.mockImplementation(() => chain);

    await listRecentReviews({ status: "published-like" });

    expect(chain.in).toHaveBeenCalledWith("status", ["published", "approved"]);
  });

  it("applies exact status filter for a specific status", async () => {
    const chain = chainable({ data: [], error: null });
    from.mockImplementation(() => chain);

    await listRecentReviews({ status: "flagged" });

    expect(chain.eq).toHaveBeenCalledWith("status", "flagged");
  });

  it("does not apply a status filter when status is 'all'", async () => {
    const chain = chainable({ data: [], error: null });
    from.mockImplementation(() => chain);

    await listRecentReviews({ status: "all" });

    expect(chain.eq).not.toHaveBeenCalledWith("status", expect.anything());
    expect(chain.in).not.toHaveBeenCalledWith("status", expect.anything());
  });

  it("returns empty array when data is null", async () => {
    from.mockImplementation(() => chainable({ data: null, error: null }));
    const results = await listRecentReviews();
    expect(results).toEqual([]);
  });

  it("throws when supabase returns an error", async () => {
    from.mockImplementation(() => chainable({ data: null, error: new Error("boom") }));
    await expect(listRecentReviews()).rejects.toThrow("boom");
  });
});

describe("moderateReview", () => {
  beforeEach(() => {
    from.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  });

  it("calls update with the given status", async () => {
    const chain = chainable({ error: null });
    from.mockImplementation((table: string) => {
      expect(table).toBe("reviews");
      return chain;
    });

    await moderateReview("r1", "flagged");

    expect(chain.update).toHaveBeenCalledTimes(1);
    const updateArg = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(updateArg.status).toBe("flagged");
    expect(typeof updateArg.updated_at).toBe("string");
    expect(chain.eq).toHaveBeenCalledWith("id", "r1");
  });

  it("throws when update errors", async () => {
    from.mockImplementation(() => chainable({ error: new Error("db fail") }));
    await expect(moderateReview("r1", "removed")).rejects.toThrow("db fail");
  });
});
