import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { CITY_NEWS_CONFIG } from "@/lib/news/cities-news";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { TEMPLATES } from "@/lib/news/templates";
import type { SignalCandidate } from "@/lib/news/templates/types";
import { draftArticle } from "@/lib/news/drafter";

export const runtime = "nodejs";
export const maxDuration = 60;

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

function imageUrlForQuery(q: string): string {
  const slug = q.trim().replace(/\s+/g, ",");
  return `https://loremflickr.com/1200/800/${encodeURIComponent(slug)}/all`;
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

  // 2. Pick the strongest signal.
  const winner = candidates.sort((a, b) => b.score - a.score)[0];

  // 3. Dedupe — don't draft the same signal twice in 48h for the same city.
  const { data: existing } = await supabase
    .from("news_articles")
    .select("id")
    .eq("metro", city)
    .eq("signal_type", winner.type)
    .gte(
      "created_at",
      new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    )
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      {
        city,
        today,
        drafted: false,
        reason: "recent_duplicate",
        signal_type: winner.type,
      },
      { status: 200 }
    );
  }

  // 4. Draft with Claude.
  let drafted;
  try {
    drafted = await draftArticle({ city, cfg, signal: winner });
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
      image_url: imageUrlForQuery(drafted.image_query),
      author: "Lucid Rents Newsroom",
      published_at: publishedAt,
      metro: city,
      status: "draft",
      signal_type: winner.type,
      signal_metadata: { ...winner.metadata, score: winner.score },
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
