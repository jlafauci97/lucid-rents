import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks — vitest hoists vi.mock above imports.
const authAdmin = {
  listUsers: vi.fn(),
  getUserById: vi.fn(),
  updateUserById: vi.fn(),
  deleteUser: vi.fn(),
  generateLink: vi.fn(),
};
const from = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: { admin: authAdmin }, from })),
}));

import { listUsers, banUser, setUserRole, unbanUser } from "../users";

/**
 * Builds a chainable thenable that mimics the supabase-js query builder.
 * Every method returns the same object; awaiting it resolves with `result`.
 */
function chainable(result: { data?: unknown; count?: number | null; error?: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "is", "in", "order", "limit", "head", "maybeSingle", "update", "upsert"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: typeof result) => unknown) => resolve(result);
  return chain;
}

describe("listUsers", () => {
  beforeEach(() => {
    authAdmin.listUsers.mockReset();
    from.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  });

  it("joins auth users with profile role and sets banned/deleted_at flags", async () => {
    const futureBan = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    authAdmin.listUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: "u1",
            email: "alice@example.com",
            created_at: "2026-01-01T00:00:00Z",
            last_sign_in_at: "2026-04-10T00:00:00Z",
            banned_until: null,
          },
          {
            id: "u2",
            email: "bob@example.com",
            created_at: "2026-02-01T00:00:00Z",
            last_sign_in_at: null,
            banned_until: futureBan,
          },
        ],
      },
      error: null,
    });

    from.mockImplementation(() =>
      chainable({
        data: [
          { user_id: "u1", role: "admin", deleted_at: null },
          { user_id: "u2", role: "user", deleted_at: "2026-03-15T00:00:00Z" },
        ],
        error: null,
      }),
    );

    const { users, hasMore } = await listUsers({ page: 1, pageSize: 20 });

    expect(users).toHaveLength(2);
    expect(users[0]).toEqual({
      id: "u1",
      email: "alice@example.com",
      created_at: "2026-01-01T00:00:00Z",
      last_sign_in_at: "2026-04-10T00:00:00Z",
      banned: false,
      role: "admin",
      deleted_at: null,
    });
    expect(users[1]).toEqual({
      id: "u2",
      email: "bob@example.com",
      created_at: "2026-02-01T00:00:00Z",
      last_sign_in_at: null,
      banned: true,
      role: "user",
      deleted_at: "2026-03-15T00:00:00Z",
    });
    expect(hasMore).toBe(false);
    expect(authAdmin.listUsers).toHaveBeenCalledWith({ page: 1, perPage: 20 });
  });

  it("filters results when search term is supplied", async () => {
    authAdmin.listUsers.mockResolvedValue({
      data: {
        users: [
          { id: "u1", email: "alice@example.com", created_at: "2026-01-01T00:00:00Z", last_sign_in_at: null, banned_until: null },
          { id: "u2", email: "bob@example.com", created_at: "2026-01-02T00:00:00Z", last_sign_in_at: null, banned_until: null },
        ],
      },
      error: null,
    });

    from.mockImplementation(() => chainable({ data: [], error: null }));

    const { users } = await listUsers({ search: "alice" });
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe("alice@example.com");
  });

  it("reports hasMore when page is full", async () => {
    authAdmin.listUsers.mockResolvedValue({
      data: {
        users: Array.from({ length: 2 }, (_, i) => ({
          id: `u${i}`,
          email: `u${i}@x.com`,
          created_at: "2026-01-01T00:00:00Z",
          last_sign_in_at: null,
          banned_until: null,
        })),
      },
      error: null,
    });

    from.mockImplementation(() => chainable({ data: [], error: null }));

    const { hasMore } = await listUsers({ page: 1, pageSize: 2 });
    expect(hasMore).toBe(true);
  });

  it("defaults role to 'user' when no profile row exists", async () => {
    authAdmin.listUsers.mockResolvedValue({
      data: {
        users: [
          { id: "u1", email: "a@x.com", created_at: "2026-01-01T00:00:00Z", last_sign_in_at: null, banned_until: null },
        ],
      },
      error: null,
    });

    from.mockImplementation(() => chainable({ data: [], error: null }));

    const { users } = await listUsers({});
    expect(users[0].role).toBe("user");
    expect(users[0].deleted_at).toBeNull();
  });
});

describe("setUserRole", () => {
  beforeEach(() => {
    from.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  });

  it("upserts role into user_profiles", async () => {
    const upsertSpy = vi.fn(() => chainable({ error: null }));
    from.mockImplementation((table: string) => {
      expect(table).toBe("user_profiles");
      return { upsert: upsertSpy };
    });

    await setUserRole("u1", "moderator");

    expect(upsertSpy).toHaveBeenCalledWith({ user_id: "u1", role: "moderator" });
  });
});

describe("banUser", () => {
  beforeEach(() => {
    authAdmin.updateUserById.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  });

  it("calls updateUserById with a large ban_duration in hours", async () => {
    authAdmin.updateUserById.mockResolvedValue({ data: {}, error: null });

    await banUser("u1");

    expect(authAdmin.updateUserById).toHaveBeenCalledTimes(1);
    const [userId, payload] = authAdmin.updateUserById.mock.calls[0];
    expect(userId).toBe("u1");
    expect(payload).toHaveProperty("ban_duration");
    expect(typeof payload.ban_duration).toBe("string");
    expect(payload.ban_duration).toMatch(/^\d+h$/);
  });
});

describe("unbanUser", () => {
  beforeEach(() => {
    authAdmin.updateUserById.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  });

  it("calls updateUserById with ban_duration 'none'", async () => {
    authAdmin.updateUserById.mockResolvedValue({ data: {}, error: null });

    await unbanUser("u1");

    expect(authAdmin.updateUserById).toHaveBeenCalledWith("u1", { ban_duration: "none" });
  });
});
