import { createClient } from "@supabase/supabase-js";

// DB accepts: draft | published | approved | flagged | removed
// 'approved' is a legacy value (119 rows) — treat as display-equivalent to 'published'.
export type ReviewStatus = "draft" | "published" | "approved" | "flagged" | "removed";

export interface MCReview {
  id: string;
  user_id: string | null;
  reviewer_name: string | null;
  reviewer_email: string | null;
  building_id: string;
  building_address: string | null;
  building_city: string | null;
  title: string | null;
  overall_rating: number | null;
  status: ReviewStatus;
  created_at: string;
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function listRecentReviews({
  status,
  limit = 50,
}: {
  status?: ReviewStatus | "published-like" | "all";
  limit?: number;
} = {}): Promise<MCReview[]> {
  const sb = admin();
  let query = sb
    .from("reviews")
    .select(`
      id, user_id, reviewer_name, building_id, title, overall_rating, status, created_at,
      buildings(full_address, metro)
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && status !== "all") {
    if (status === "published-like") {
      query = query.in("status", ["published", "approved"]);
    } else {
      query = query.eq("status", status);
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  // supabase-js generated types model the foreign-key join as an array; at
  // runtime a to-one join yields either a single object, null, or (rarely) an
  // array wrapper depending on the relationship cardinality. Normalise both.
  type JoinedBuilding = { full_address: string | null; metro: string | null };
  type ReviewRow = {
    id: string;
    user_id: string | null;
    reviewer_name: string | null;
    building_id: string;
    title: string | null;
    overall_rating: number | null;
    status: ReviewStatus;
    created_at: string;
    buildings: JoinedBuilding | JoinedBuilding[] | null;
  };

  const rows = (data ?? []) as unknown as ReviewRow[];

  // Batch reviewer email lookup (N+1 acceptable at 50-limit; future upgrade: auth.users view).
  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter((id): id is string => !!id)));
  const emailMap = new Map<string, string>();
  await Promise.all(
    userIds.map(async (uid) => {
      const { data: u } = await sb.auth.admin.getUserById(uid);
      if (u?.user?.email) emailMap.set(uid, u.user.email);
    }),
  );

  return rows.map((r) => {
    const building = Array.isArray(r.buildings) ? (r.buildings[0] ?? null) : r.buildings;
    return {
      id: r.id,
      user_id: r.user_id,
      reviewer_name: r.reviewer_name,
      reviewer_email: r.user_id ? (emailMap.get(r.user_id) ?? null) : null,
      building_id: r.building_id,
      building_address: building?.full_address ?? null,
      building_city: building?.metro ?? null,
      title: r.title,
      overall_rating: r.overall_rating,
      status: r.status,
      created_at: r.created_at,
    };
  });
}

export async function moderateReview(id: string, status: ReviewStatus): Promise<void> {
  const sb = admin();
  const { error } = await sb
    .from("reviews")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
