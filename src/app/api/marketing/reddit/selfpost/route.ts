// Generates original Reddit posts from LucidRents data for publishing to our
// own profile. GET lists drafts; POST generates. Auth via CRON_SECRET so the
// Mac mini scanner host and Vercel cron can both drive it.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { VALID_CITIES, type City } from "@/lib/cities";
import { buildSelfPost, type SelfPostKind } from "@/lib/marketing/reddit-selfpost";
import { MC_COOKIE, verifyCookieValue } from "@/lib/mission-control/auth";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const KINDS: SelfPostKind[] = [
  "worst_buildings",
  "worst_landlords",
  "worst_neighborhoods",
  "most_311_complaints",
  "most_evictions",
  "most_litigated",
  "bedbug_hotspots",
];

function authorized(req: NextRequest): boolean {
  return req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

/**
 * Read access for the mission-control UI.
 *
 * The proxy only gates /mission-control *pages*, not /api/marketing/*, so a
 * browser-facing read has to verify the session cookie itself rather than
 * assume it was checked upstream. Generation still requires CRON_SECRET.
 */
async function canRead(req: NextRequest): Promise<boolean> {
  if (authorized(req)) return true;
  return verifyCookieValue(req.cookies.get(MC_COOKIE)?.value);
}

/**
 * Supabase throws PostgrestError, a plain object rather than an Error, so
 * `String(err)` on it yields "[object Object]" and the actual failure is lost.
 */
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const e = err as { message?: string; code?: string; details?: string; hint?: string };
    if (e.message || e.code) {
      return [e.code && `[${e.code}]`, e.message, e.details, e.hint]
        .filter(Boolean)
        .join(" ");
    }
    try {
      return JSON.stringify(err);
    } catch {
      return Object.prototype.toString.call(err);
    }
  }
  return String(err);
}

export async function GET(req: NextRequest) {
  if (!(await canRead(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "draft";
  if (!["draft", "approved", "posted", "rejected", "all"].includes(status)) {
    return NextResponse.json({ error: "invalid status filter" }, { status: 400 });
  }

  const supabase = createAdminClient();
  let query = supabase
    .from("marketing_reddit_posts")
    .select("id, kind, city, title, body, links, status, posted_url, posted_at, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Status counts drive the mission-control filter chips.
  const { data: countRows } = await supabase
    .from("marketing_reddit_posts")
    .select("status");
  const byStatus: Record<string, number> = {};
  for (const r of countRows ?? []) {
    byStatus[r.status as string] = (byStatus[r.status as string] ?? 0) + 1;
  }

  return NextResponse.json({ ok: true, posts: data ?? [], byStatus });
}

/**
 * Moves a self-post through its lifecycle: draft -> approved (mission control
 * approve button; the Mac mini poster only publishes approved posts),
 * draft/approved -> rejected, or -> posted (recorded by the poster via the
 * queue API, or by hand if something was published manually).
 */
export async function PATCH(req: NextRequest) {
  if (!(await canRead(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string; status?: string; postedUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, status, postedUrl } = body;
  if (!id || (status !== "approved" && status !== "posted" && status !== "rejected")) {
    return NextResponse.json(
      { error: "id and status ('approved' | 'posted' | 'rejected') are required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("marketing_reddit_posts")
    .update({
      status,
      posted_url: status === "posted" ? (postedUrl ?? null) : null,
      posted_at: status === "posted" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: describeError(error) }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id, status });
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const cityParam = url.searchParams.get("city") as City | null;
  const kindParam = url.searchParams.get("kind") as SelfPostKind | null;
  const dryRun = url.searchParams.get("dryRun") === "true";
  const rotate = url.searchParams.get("rotate") === "daily";

  const cities = cityParam ? [cityParam] : VALID_CITIES;
  const kinds = kindParam ? [kindParam] : KINDS;

  // Daily rotation: one kind per city per day, staggered so no two cities
  // publish the same story shape on the same day and every (kind, city)
  // pair recurs every KINDS.length days. The daily cron calls this per city;
  // generating the full 7-kind matrix every day would bury the queue in
  // near-identical drafts that the 3-per-day posting cap can never drain.
  // In rotation mode each city gets an ordered candidate list starting at its
  // kind-of-the-day: some kinds have no data outside NYC (litigation and
  // bedbug filings are NYC datasets), and a city whose kind-of-the-day comes
  // up empty should fall through to the next kind rather than sit the day out.
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const perCityKinds: { city: City; candidates: SelfPostKind[] }[] =
    rotate && !kindParam
      ? cities.map((c) => {
          const start = (dayIndex + VALID_CITIES.indexOf(c)) % KINDS.length;
          return {
            city: c,
            candidates: KINDS.map((_, i) => KINDS[(start + i) % KINDS.length]),
          };
        })
      : cities.map((c) => ({ city: c, candidates: kinds }));
  // Matrix mode generates every candidate; rotation stops after the first
  // draft that lands.
  const stopAfterFirst = rotate && !kindParam;

  for (const c of cities) {
    if (!VALID_CITIES.includes(c)) {
      return NextResponse.json({ error: `city must be one of ${VALID_CITIES.join(", ")}` }, { status: 400 });
    }
  }
  for (const k of kinds) {
    if (!KINDS.includes(k)) {
      return NextResponse.json({ error: `kind must be one of ${KINDS.join(", ")}` }, { status: 400 });
    }
  }

  const supabase = createAdminClient();
  const generated: unknown[] = [];
  const errors: { kind: string; city: string; error: string }[] = [];

  for (const { city, candidates } of perCityKinds) {
    for (const kind of candidates) {
      try {
        // An unreviewed draft of the same shape is still waiting in mission
        // control; a second copy with slightly fresher numbers just buries
        // the first. In rotation mode, fall through to the next kind so the
        // city still gets a fresh story today.
        const { count: pending } = await supabase
          .from("marketing_reddit_posts")
          .select("id", { count: "exact", head: true })
          .eq("kind", kind)
          .eq("city", city)
          .eq("status", "draft");
        if ((pending ?? 0) > 0) {
          errors.push({ kind, city, error: "draft of this kind already pending review" });
          continue;
        }

        const post = await buildSelfPost(kind, city);
        if (!post) {
          errors.push({ kind, city, error: "not enough ranked rows to publish" });
          continue; // rotation: fall through to the next candidate kind
        }

        if (dryRun) {
          generated.push(post);
          if (stopAfterFirst) break;
          continue;
        }

        const { data, error } = await supabase
          .from("marketing_reddit_posts")
          .insert({
            kind: post.kind,
            city: post.city,
            title: post.title,
            body: post.body,
            links: post.links,
            status: "draft",
          })
          .select("id, kind, city, title")
          .single();

        // The daily unique index makes a repeat run a no-op rather than a
        // second copy of the same ranking.
        if (error) {
          if (error.code === "23505") {
            errors.push({ kind, city, error: "already generated today" });
            if (stopAfterFirst) break;
            continue;
          }
          throw error;
        }
        generated.push(data);
        if (stopAfterFirst) break;
      } catch (err) {
        errors.push({ kind, city, error: describeError(err) });
        if (stopAfterFirst) break;
      }
    }
  }

  console.log(
    `[reddit/selfpost] generated=${generated.length} errors=${errors.length} dryRun=${dryRun}`
  );

  return NextResponse.json({ ok: true, generated, errors });
}
