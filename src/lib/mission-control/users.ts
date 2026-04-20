import { createClient } from "@supabase/supabase-js";

export type UserRole = "user" | "moderator" | "admin";

export interface MCUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned: boolean;
  role: UserRole;
  deleted_at: string | null;
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/**
 * Lists one page of users joined with their profile row.
 * KNOWN LIMITATION: `search` only filters users already on the current page.
 * Supabase auth.admin has no server-side email search.
 */
export async function listUsers({
  page = 1,
  pageSize = 20,
  search,
}: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<{ users: MCUser[]; hasMore: boolean }> {
  const sb = admin();
  const { data: authData, error } = await sb.auth.admin.listUsers({ page, perPage: pageSize });
  if (error) throw error;

  const rawUsers = authData.users;
  const hasMore = rawUsers.length === pageSize;

  let users = rawUsers;
  if (search) {
    const q = search.toLowerCase();
    users = users.filter((u) => u.email?.toLowerCase().includes(q) || u.id.includes(q));
  }

  const ids = users.map((u) => u.id);
  const { data: profiles } = await sb
    .from("user_profiles")
    .select("user_id, role, deleted_at")
    .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

  const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);

  return {
    users: users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
      role: (profileMap.get(u.id)?.role as UserRole) ?? "user",
      deleted_at: profileMap.get(u.id)?.deleted_at ?? null,
    })),
    hasMore,
  };
}

export async function getUserDetail(userId: string): Promise<MCUser & { reviewsCount: number }> {
  const sb = admin();
  const [userRes, profileRes, reviewsRes] = await Promise.all([
    sb.auth.admin.getUserById(userId),
    sb.from("user_profiles").select("role, deleted_at").eq("user_id", userId).maybeSingle(),
    sb.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  if (userRes.error || !userRes.data.user) throw userRes.error ?? new Error("User not found");
  const u = userRes.data.user;
  return {
    id: u.id,
    email: u.email ?? "",
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
    role: (profileRes.data?.role as UserRole) ?? "user",
    deleted_at: profileRes.data?.deleted_at ?? null,
    reviewsCount: reviewsRes.count ?? 0,
  };
}

export async function banUser(userId: string): Promise<void> {
  const sb = admin();
  const hours = 876000; // ~100 years
  const { error } = await sb.auth.admin.updateUserById(userId, { ban_duration: `${hours}h` });
  if (error) throw error;
}

export async function unbanUser(userId: string): Promise<void> {
  const sb = admin();
  const { error } = await sb.auth.admin.updateUserById(userId, { ban_duration: "none" });
  if (error) throw error;
}

export async function deleteUser(userId: string): Promise<void> {
  const sb = admin();
  await sb.from("user_profiles").update({ deleted_at: new Date().toISOString() }).eq("user_id", userId);
  const { error } = await sb.auth.admin.deleteUser(userId);
  if (error) throw error;
}

export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  const sb = admin();
  const { error } = await sb.from("user_profiles").upsert({ user_id: userId, role });
  if (error) throw error;
}

export async function createImpersonationLink(userId: string): Promise<string> {
  const sb = admin();
  const { data: user } = await sb.auth.admin.getUserById(userId);
  if (!user.user?.email) throw new Error("User has no email");
  const { data, error } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email: user.user.email,
  });
  if (error) throw error;
  return data.properties?.action_link ?? "";
}
