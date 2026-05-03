import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { CITY_NEWS_CONFIG } from "@/lib/news/cities-news";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { TEMPLATES } from "@/lib/news/templates";
import type { SignalCandidate } from "@/lib/news/templates/types";
import { draftArticle } from "@/lib/news/drafter";
import { imageUrlForQuery } from "@/lib/news/image-search";
import { entityLinksForSignal, primaryEntityLink } from "@/lib/news/entity-links";

export const runtime = "nodejs";
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function todayInTz(tz: string): string {
  // Returns YYYY-MM-DD in the given IANA tz.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

export async function GET(req: NextRequest) {
  // Auth
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cityParam = req.nextUrl.searchParams.get("city");
  if (!cityParam || !isValidCity(cityParam)) {
    return NextResponse.json(
      { error: "Missing or invalid ?city=" },
      { status: 400 }
    );
  }
  const city = cityParam as City;
  const cfg = CITY_NEWS_CONFIG[city];
  if (!cfg) {
    return NextResponse.json({ error: `No config for city ${city}` }, { status: 400 });
  }

  const today = todayInTz(cfg.tz);

  // 1. Run every enabled detector.
  const results = await Promise.allSettled(
    cfg.templates.map((t) =>
      TEMPLATES[t]({ city, cfg, supabase, today })
    )
  );

  const candidates: SignalCandidate[] = [];
  const failures: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") candidates.push(...r.value);
    else failures.push(`${cfg.templates[i]}: ${r.reason}`);
  });

  if (candidates.length === 0) {
    return NextResponse.json(
      {
        city,
        today,
        drafted: false,
        reason: "no_candidates",
        template_failures: failures,
      },
      { status: 200 }
    );
  }

  // 2. Pick a winner that doesn't repeat what we just published.
  //    Two layers of recency:
  //      - signal_type within the last 7 days (avoid running the same kind
  //        of story week-after-week)
  //      - the specific entity (landlord / neighborhood / building) within
  //        the last 14 days (avoid the same person/place twice in a row)
  //    Then weighted-sample the top 3 remaining candidates instead of always
  //    taking #1 — keeps the highest-scoring story most likely while still
  //    rotating in fresh angles.
  const sorted = candidates.sort((a, b) => b.score - a.score);

  const typeSinceIso = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();
  const entitySinceIso = new Date(
    Date.now() - 14 * 24 * 60 * 60 * 1000
  ).toISOString();

  const [{ data: recentTypes }, { data: recentEntities }] = await Promise.all([
    supabase
      .from("news_articles")
      .select("signal_type")
      .eq("metro", city)
      .gte("created_at", typeSinceIso),
    supabase
      .from("news_articles")
      .select("signal_metadata")
      .eq("metro", city)
      .gte("created_at", entitySinceIso),
  ]);

  const usedTypes = new Set((recentTypes ?? []).map((r) => r.signal_type));
  const usedEntityKeys = new Set<string>();
  for (const row of recentEntities ?? []) {
    const meta = (row as { signal_metadata: Record<string, unknown> | null })
      .signal_metadata;
    if (!meta) continue;
    for (const k of ["landlord", "neighborhood", "sample_building_id"]) {
      const v = meta[k];
      if (typeof v === "string" && v.length > 0) {
        usedEntityKeys.add(`${k}:${v.toLowerCase()}`);
      }
    }
  }

  function entityKeysFor(c: SignalCandidate): string[] {
    const keys: string[] = [];
    const m = c.metadata as Record<string, unknown>;
    for (const k of ["landlord", "neighborhood", "sample_building_id"]) {
      const v = m[k];
      if (typeof v === "string" && v.length > 0) {
        keys.push(`${k}:${v.toLowerCase()}`);
      }
    }
    return keys;
  }

  const fresh = sorted.filter(
    (c) =>
      !usedTypes.has(c.type) &&
      !entityKeysFor(c).some((k) => usedEntityKeys.has(k))
  );

  // Fall back gracefully: if entity-dedup eliminates everything, relax to
  // type-only; if that's also empty, use everything (the first run for a city
  // legitimately has no history).
  const pool =
    fresh.length > 0
      ? fresh
      : sorted.filter((c) => !usedTypes.has(c.type)).length > 0
        ? sorted.filter((c) => !usedTypes.has(c.type))
        : sorted;

  if (pool.length === 0) {
    return NextResponse.json(
      {
        city,
        today,
        drafted: false,
        reason: "all_candidates_recent",
        candidate_types: sorted.map((c) => c.type),
        used_types: Array.from(usedTypes),
      },
      { status: 200 }
    );
  }

  // Weighted random over the top 3: weights 3, 2, 1 (or fewer if pool < 3).
  const top = pool.slice(0, 3);
  const weights = top.map((_, i) => top.length - i);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let winner = top[0];
  for (let i = 0; i < top.length; i += 1) {
    r -= weights[i];
    if (r <= 0) {
      winner = top[i];
      break;
    }
  }

  // 3. Build entity backlinks from the signal metadata. These are canonical
  //    URLs to other pages on lucidrents.com (landlord, neighborhood,
  //    building) so the drafter can weave them in as markdown anchors and
  //    so the cross-poster can include the primary one in the tweet.
  const entityLinks = entityLinksForSignal(winner, city);

  // 4. Draft with Claude.
  let drafted;
  try {
    drafted = await draftArticle({ city, cfg, signal: winner, entityLinks });
  } catch (e) {
    return NextResponse.json(
      {
        city,
        today,
        drafted: false,
        reason: "drafter_error",
        error: (e as Error).message,
        signal_type: winner.type,
      },
      { status: 500 }
    );
  }

  // 5. Insert as draft.
  const publishedAt = new Date().toISOString();
  const slug = `${city}-${slugify(drafted.title)}-${publishedAt.slice(0, 10)}`;
  const guid = `lucid-rents:${city}:${winner.type}:${crypto
    .createHash("sha1")
    .update(slug + JSON.stringify(winner.metadata))
    .digest("hex")
    .slice(0, 12)}`;

  const urlPrefix = CITY_META[city].urlPrefix;
  const canonicalUrl = `https://lucidrents.com/${urlPrefix}/news/${slug}`;

  const { error: insertError, data: inserted } = await supabase
    .from("news_articles")
    .insert({
      guid,
      slug,
      title: drafted.title,
      excerpt: drafted.excerpt,
      body: drafted.body,
      url: canonicalUrl,
      source_name: "Lucid Rents",
      source_slug: "lucid-rents",
      source_type: "lucid-rents",
      category: drafted.category,
      image_url: await imageUrlForQuery(drafted.image_query, {
        metro: city,
        salt: slug,
      }),
      author: "Lucid Rents Newsroom",
      published_at: publishedAt,
      metro: city,
      status: "draft",
      signal_type: winner.type,
      signal_metadata: {
        ...winner.metadata,
        score: winner.score,
        hashtags: drafted.hashtags,
        entity_links: entityLinks,
        primary_entity_link: primaryEntityLink(entityLinks),
      },
      auto_generated: true,
    })
    .select("id, slug")
    .single();

  if (insertError) {
    return NextResponse.json(
      {
        city,
        today,
        drafted: false,
        reason: "insert_error",
        error: insertError.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      city,
      today,
      drafted: true,
      article_id: inserted?.id,
      slug: inserted?.slug,
      signal_type: winner.type,
      score: winner.score,
      status: "draft",
    },
    { status: 200 }
  );
}
