import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { CITY_NEWS_CONFIG, SIGNAL_FAMILY, type SignalFamily } from "@/lib/news/cities-news";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { TEMPLATES } from "@/lib/news/templates";
import type { SignalCandidate } from "@/lib/news/templates/types";
import { draftArticle } from "@/lib/news/drafter";
import { imageUrlForQuery } from "@/lib/news/image-search";
import { entityLinksForSignal, primaryEntityLink } from "@/lib/news/entity-links";

export const runtime = "nodejs";
export const maxDuration = 300;

// Created lazily so `next build` doesn't require Supabase env vars.
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** How many articles to publish per city per run. */
const ARTICLES_PER_RUN = 2;

/** Per-entity-type cooldown: how long before an entity can be featured again. */
const COOLDOWN_DAYS: Record<string, number> = {
  building: 90,
  landlord: 45,
  neighborhood: 30,
  topic: 10, // city reports / seasonal / guides rotate on a short cooldown
};

/** Don't re-run the exact same signal_type within this many days (template variety). */
const TYPE_COOLDOWN_DAYS = 3;

/**
 * Base appetite per story family. The selector picks families (not raw scores)
 * so high-magnitude watchdog signals (huge violation counts) don't crowd out
 * neighborhood, market, and guide coverage. Neighborhood/city are nudged up so
 * the feed reads like rental intelligence, not just a violations blotter.
 * Guides sit low — evergreen filler that only surfaces when data is thin.
 */
const FAMILY_BASE_PRIORITY: Record<SignalFamily, number> = {
  neighborhood: 1.2,
  city: 1.1,
  building: 1.0,
  landlord: 1.0,
  seasonal: 0.9,
  guide: 0.45,
};

/** Window over which a family counts as "recently covered" for balancing. */
const FAMILY_RECENCY_DAYS = 10;

/** Weighted-random pick of one key from a [key, weight] list. */
function weightedPick<T>(entries: [T, number][]): T | null {
  const total = entries.reduce((a, [, w]) => a + w, 0);
  if (total <= 0) return entries[0]?.[0] ?? null;
  let r = Math.random() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1]?.[0] ?? null;
}

interface EntityIdentity {
  entityType: "building" | "landlord" | "neighborhood" | "topic";
  entityKey: string;
}

/**
 * The dedup/cooldown identity for a candidate. Entity families key off the
 * specific building/landlord/neighborhood; everything else is a rotating
 * "topic" keyed by signal type.
 */
function entityIdentity(c: SignalCandidate): EntityIdentity {
  const family: SignalFamily = SIGNAL_FAMILY[c.type];
  const m = c.metadata as Record<string, unknown>;
  const str = (k: string): string | null =>
    typeof m[k] === "string" && (m[k] as string).length > 0 ? (m[k] as string) : null;

  if (family === "building") {
    const id = str("sample_building_id");
    if (id) return { entityType: "building", entityKey: id };
  }
  if (family === "landlord") {
    const name = str("landlord");
    if (name) return { entityType: "landlord", entityKey: name.toLowerCase() };
  }
  if (family === "neighborhood") {
    const name = str("neighborhood");
    if (name) return { entityType: "neighborhood", entityKey: name.toLowerCase() };
  }
  return { entityType: "topic", entityKey: c.type };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function todayInTz(tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

/** Weighted-random pick over the top 3 (weights 3,2,1) so the best story is most
 *  likely but fresh angles still rotate in. */
function weightedTop3(pool: SignalCandidate[]): SignalCandidate | null {
  if (pool.length === 0) return null;
  const top = pool.slice(0, 3);
  const weights = top.map((_, i) => top.length - i);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < top.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return top[i];
  }
  return top[0];
}

async function logFeatured(
  client: SupabaseClient,
  city: City,
  id: EntityIdentity,
  signalType: string,
  articleId: string | undefined
) {
  await client.from("featured_news_history").insert({
    metro: city,
    entity_type: id.entityType,
    entity_key: id.entityKey,
    signal_type: signalType,
    article_id: articleId ?? null,
  });
}

interface DraftResult {
  ok: boolean;
  reason?: string;
  error?: string;
  article_id?: string;
  slug?: string;
  signal_type: string;
  family: SignalFamily;
  score: number;
}

async function draftAndInsert(
  city: City,
  cfg: (typeof CITY_NEWS_CONFIG)[City],
  winner: SignalCandidate
): Promise<DraftResult> {
  const supabase = getSupabaseAdmin();
  const family = SIGNAL_FAMILY[winner.type];
  const entityLinks = entityLinksForSignal(winner, city);

  let drafted;
  try {
    drafted = await draftArticle({ city, cfg, signal: winner, entityLinks });
  } catch (e) {
    return { ok: false, reason: "drafter_error", error: (e as Error).message, signal_type: winner.type, family, score: winner.score };
  }

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
      image_url: await imageUrlForQuery(drafted.image_query, { metro: city, salt: slug }),
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
    return { ok: false, reason: "insert_error", error: insertError.message, signal_type: winner.type, family, score: winner.score };
  }

  await logFeatured(supabase, city, entityIdentity(winner), winner.type, inserted?.id);

  return { ok: true, article_id: inserted?.id, slug: inserted?.slug, signal_type: winner.type, family, score: winner.score };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cityParam = req.nextUrl.searchParams.get("city");
  if (!cityParam || !isValidCity(cityParam)) {
    return NextResponse.json({ error: "Missing or invalid ?city=" }, { status: 400 });
  }
  const city = cityParam as City;
  const cfg = CITY_NEWS_CONFIG[city];
  if (!cfg) {
    return NextResponse.json({ error: `No config for city ${city}` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const today = todayInTz(cfg.tz);

  // 1. Run every enabled detector.
  const results = await Promise.allSettled(
    cfg.templates.map((t) => TEMPLATES[t]({ city, cfg, supabase, today }))
  );

  const candidates: SignalCandidate[] = [];
  const failures: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") candidates.push(...r.value);
    else failures.push(`${cfg.templates[i]}: ${r.reason}`);
  });

  if (candidates.length === 0) {
    return NextResponse.json(
      { city, today, drafted: 0, reason: "no_candidates", template_failures: failures },
      { status: 200 }
    );
  }

  // 2. Load cooldown state.
  //    - featured_news_history: per-entity cooldowns (the durable anti-repeat).
  //    - news_articles: recent signal_types for template variety.
  const maxCooldownIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const typeSinceIso = new Date(Date.now() - TYPE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: featured }, { data: recentTypeRows }] = await Promise.all([
    supabase
      .from("featured_news_history")
      .select("entity_type, entity_key, signal_type, featured_at")
      .eq("metro", city)
      .gte("featured_at", maxCooldownIso),
    supabase
      .from("news_articles")
      .select("signal_type")
      .eq("metro", city)
      .eq("auto_generated", true)
      .gte("created_at", typeSinceIso),
  ]);

  // Most-recent featured_at per "type:key", plus a per-family count over the
  // recency window (drives family balancing so we don't keep publishing the
  // same kind of story).
  const lastFeatured = new Map<string, number>();
  const recentFamilyCount = new Map<SignalFamily, number>();
  const familyRecencyCutoff = Date.now() - FAMILY_RECENCY_DAYS * 24 * 60 * 60 * 1000;
  for (const row of (featured ?? []) as {
    entity_type: string;
    entity_key: string;
    signal_type: string;
    featured_at: string;
  }[]) {
    const k = `${row.entity_type}:${row.entity_key}`;
    const t = new Date(row.featured_at).getTime();
    const prev = lastFeatured.get(k);
    if (prev === undefined || t > prev) lastFeatured.set(k, t);
    if (t >= familyRecencyCutoff) {
      const fam = SIGNAL_FAMILY[row.signal_type as keyof typeof SIGNAL_FAMILY];
      if (fam) recentFamilyCount.set(fam, (recentFamilyCount.get(fam) ?? 0) + 1);
    }
  }

  const recentTypes = new Set((recentTypeRows ?? []).map((r) => r.signal_type as string));

  function inCooldown(c: SignalCandidate): boolean {
    const id = entityIdentity(c);
    const last = lastFeatured.get(`${id.entityType}:${id.entityKey}`);
    if (last === undefined) return false;
    const days = COOLDOWN_DAYS[id.entityType] ?? 14;
    return Date.now() - last < days * 24 * 60 * 60 * 1000;
  }

  const sorted = candidates.sort((a, b) => b.score - a.score);

  // Primary pool: not in entity cooldown AND not a signal_type used very recently.
  let pool = sorted.filter((c) => !inCooldown(c) && !recentTypes.has(c.type));
  // Graceful relaxation for sparse cities / cold starts.
  if (pool.length === 0) pool = sorted.filter((c) => !inCooldown(c));
  if (pool.length === 0) pool = sorted.filter((c) => !recentTypes.has(c.type));
  if (pool.length === 0) pool = sorted;

  // 3. Pick up to ARTICLES_PER_RUN winners. We pick by FAMILY first (weighted by
  //    appetite ÷ recent coverage) so the feed spreads across neighborhoods,
  //    market reports, buildings, landlords, and guides — instead of always the
  //    highest-magnitude watchdog story. Within the chosen family we take the
  //    strongest fresh candidate. The two daily picks use different families.
  const usedFamilies = new Set<SignalFamily>();
  const usedKeys = new Set<string>();
  const drafts: DraftResult[] = [];

  for (let i = 0; i < ARTICLES_PER_RUN; i += 1) {
    // Group still-available candidates by family.
    const byFamily = new Map<SignalFamily, SignalCandidate[]>();
    for (const c of pool) {
      const id = entityIdentity(c);
      if (usedKeys.has(`${id.entityType}:${id.entityKey}`)) continue;
      const fam = SIGNAL_FAMILY[c.type];
      if (usedFamilies.has(fam)) continue; // keep the two picks in different families
      const arr = byFamily.get(fam) ?? [];
      arr.push(c);
      byFamily.set(fam, arr);
    }
    // Relax the different-family rule only if nothing else is left.
    if (byFamily.size === 0) {
      for (const c of pool) {
        const id = entityIdentity(c);
        if (usedKeys.has(`${id.entityType}:${id.entityKey}`)) continue;
        const fam = SIGNAL_FAMILY[c.type];
        const arr = byFamily.get(fam) ?? [];
        arr.push(c);
        byFamily.set(fam, arr);
      }
    }
    if (byFamily.size === 0) break;

    // Weight families by appetite ÷ (1 + recent coverage) so under-covered
    // families rise and recently-used ones fall.
    const familyWeights: [SignalFamily, number][] = [...byFamily.keys()].map((fam) => {
      const base = FAMILY_BASE_PRIORITY[fam] ?? 0.5;
      const recent = recentFamilyCount.get(fam) ?? 0;
      return [fam, base / (1 + recent)];
    });
    const family = weightedPick(familyWeights);
    if (!family) break;

    // Within the family, weighted-random over the top 3 by score.
    const winner = weightedTop3((byFamily.get(family) ?? []).sort((a, b) => b.score - a.score));
    if (!winner) break;

    const id = entityIdentity(winner);
    usedFamilies.add(family);
    usedKeys.add(`${id.entityType}:${id.entityKey}`);
    recentFamilyCount.set(family, (recentFamilyCount.get(family) ?? 0) + 1);

    const result = await draftAndInsert(city, cfg, winner);
    drafts.push(result);
  }

  const succeeded = drafts.filter((d) => d.ok);
  return NextResponse.json(
    {
      city,
      today,
      drafted: succeeded.length,
      articles: drafts.map((d) => ({
        ok: d.ok,
        signal_type: d.signal_type,
        family: d.family,
        score: Number(d.score.toFixed(2)),
        slug: d.slug,
        reason: d.reason,
        error: d.error,
      })),
      candidate_count: candidates.length,
      template_failures: failures.length > 0 ? failures : undefined,
    },
    { status: 200 }
  );
}
