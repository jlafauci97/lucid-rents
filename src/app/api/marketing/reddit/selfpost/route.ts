// Generates original Reddit posts from LucidRents data for publishing to our
// own profile. GET lists drafts; POST generates. Auth via CRON_SECRET so the
// Mac mini scanner host and Vercel cron can both drive it.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { VALID_CITIES, type City } from "@/lib/cities";
import { buildSelfPost, type SelfPostKind } from "@/lib/marketing/reddit-selfpost";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const KINDS: SelfPostKind[] = ["worst_buildings", "worst_landlords", "worst_neighborhoods"];

function authorized(req: NextRequest): boolean {
  return req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
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
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("marketing_reddit_posts")
    .select("id, kind, city, title, body, links, status, created_at")
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, posts: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const cityParam = url.searchParams.get("city") as City | null;
  const kindParam = url.searchParams.get("kind") as SelfPostKind | null;
  const dryRun = url.searchParams.get("dryRun") === "true";

  const cities = cityParam ? [cityParam] : VALID_CITIES;
  const kinds = kindParam ? [kindParam] : KINDS;

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

  for (const city of cities) {
    for (const kind of kinds) {
      try {
        const post = await buildSelfPost(kind, city);
        if (!post) {
          errors.push({ kind, city, error: "not enough ranked rows to publish" });
          continue;
        }

        if (dryRun) {
          generated.push(post);
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
            continue;
          }
          throw error;
        }
        generated.push(data);
      } catch (err) {
        errors.push({ kind, city, error: describeError(err) });
      }
    }
  }

  console.log(
    `[reddit/selfpost] generated=${generated.length} errors=${errors.length} dryRun=${dryRun}`
  );

  return NextResponse.json({ ok: true, generated, errors });
}
