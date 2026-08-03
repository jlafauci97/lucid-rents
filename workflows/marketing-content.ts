import {
  getWritable,
  sleep,
  FatalError,
  RetryableError,
  getWorkflowMetadata,
} from "workflow";

// Types
import { VALID_CITIES } from "@/lib/cities";

import type {
  MarketingContentType,
  MarketingVideoType,
  MarketingWorkflowEvent,
  PlatformVariants,
  PublishResult,
} from "@/types/marketing";

// DB queries
import {
  createDraft,
  updateDraft,
  getDraft,
  getRecentContentTypes,
  getPinterestCountToday,
  getTrends,
} from "@/lib/marketing/supabase-queries";

// External API clients
import { publishDraft, DraftNotFoundError } from "@/lib/marketing/publish-draft";
import {
  submitTextToVideo,
  checkTaskStatus,
  downloadVideo as downloadKlingVideo,
} from "@/lib/marketing/kling";
import { searchTrends } from "@/lib/marketing/xpoz";

// Brand voice
import {
  CONTENT_SYSTEM_PROMPT,
  getContentTypePrompt,
  PLATFORM_CONFIGS,
  PINTEREST_BOARDS,
  PINTEREST_KEYWORDS,
} from "@/lib/marketing/brand-voice";

// Email alerts
import {
  buildMarketingAlertHtml,
  buildMarketingAlertSubject,
} from "@/lib/email/marketing-alert";

// Vercel Blob
import { put } from "@vercel/blob";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emitEvent(event: MarketingWorkflowEvent): void {
  const writer = getWritable<MarketingWorkflowEvent>().getWriter();
  try {
    writer.write(event);
  } finally {
    writer.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Step 0 - Initialize draft row
// ---------------------------------------------------------------------------

async function initDraft(): Promise<{ draftId: string }> {
  "use step";
  const t0 = Date.now();
  console.log(JSON.stringify({ step: "initDraft", event: "start" }));

  const meta = getWorkflowMetadata();
  const draft = await createDraft({
    workflowRunId: meta.workflowRunId,
    contentType: "landlord_expose", // placeholder, updated in saveDraft
  });

  emitEvent({ type: "draft_saved", draftId: draft.id });

  console.log(
    JSON.stringify({ step: "initDraft", event: "done", draftId: draft.id, ms: Date.now() - t0 })
  );
  return { draftId: draft.id };
}

// ---------------------------------------------------------------------------
// Step 1 - Select content type
// ---------------------------------------------------------------------------

async function selectContentType(): Promise<{
  contentType: MarketingContentType;
  videoType: MarketingVideoType;
  reasoning: string;
}> {
  "use step";
  const t0 = Date.now();
  console.log(JSON.stringify({ step: "selectContentType", event: "start" }));

  const recentTypes = await getRecentContentTypes(7);
  const trends = await getTrends();

  const hour = new Date().getUTCHours();
  const isMorning = hour >= 10 && hour < 16; // ~6am-12pm ET
  const isEvening = hour >= 22 || hour < 4; // ~6pm-12am ET

  const allTypes: MarketingContentType[] = [
    "landlord_expose",
    "building_horror",
    "neighborhood_trend",
    "tenant_rights",
    "news_reaction",
    "viral_humor",
  ];

  const mostRecent = recentTypes[0] ?? null;
  const todayTypes = recentTypes.filter((t) => {
    // rough approximation -- recentContentTypes gives last 7 days
    return true; // we use the full set for rotation
  });

  const hasViralToday = todayTypes.includes("viral_humor");
  const hasNewsTrend = trends.some(
    (t) => t.trend_data && Object.keys(t.trend_data).length > 0
  );

  let contentType: MarketingContentType;
  let reasoning: string;

  // Priority: news reaction if fresh trends exist
  if (hasNewsTrend && mostRecent !== "news_reaction") {
    contentType = "news_reaction";
    reasoning = "Fresh trend data available, prioritizing news reaction";
  }
  // Ensure at least 1 viral_humor per day (schedule for evening slot)
  else if (!hasViralToday && isEvening) {
    contentType = "viral_humor";
    reasoning = "No viral humor today yet, scheduling for evening slot";
  }
  // Education-heavy in the morning
  else if (isMorning && mostRecent !== "tenant_rights") {
    contentType = "tenant_rights";
    reasoning = "Morning slot favors educational content";
  }
  // Rotate through remaining types, avoiding most-recent repeat
  else {
    const candidates = allTypes.filter((t) => t !== mostRecent);
    contentType = candidates[Math.floor(Math.random() * candidates.length)];
    reasoning = `Rotation pick (avoiding repeat of ${mostRecent})`;
  }

  // Map content type to video type
  const videoTypeMap: Record<MarketingContentType, MarketingVideoType> = {
    landlord_expose: "avatar",
    building_horror: "avatar",
    tenant_rights: "avatar",
    neighborhood_trend: "data_viz",
    viral_humor: "viral_character",
    news_reaction: "none",
  };
  const videoType = videoTypeMap[contentType];

  emitEvent({ type: "content_type_selected", contentType, reasoning });

  console.log(
    JSON.stringify({
      step: "selectContentType",
      event: "done",
      contentType,
      videoType,
      reasoning,
      ms: Date.now() - t0,
    })
  );
  return { contentType, videoType, reasoning };
}

// ---------------------------------------------------------------------------
// Step 2 - Gather source data
// ---------------------------------------------------------------------------

async function gatherSourceData(
  contentType: MarketingContentType
): Promise<Record<string, unknown>> {
  "use step";
  const t0 = Date.now();
  console.log(JSON.stringify({ step: "gatherSourceData", event: "start", contentType }));

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  let sourceData: Record<string, unknown> = {};

  switch (contentType) {
    case "landlord_expose": {
      // Find owners with highest violation counts
      const { data: buildings } = await supabase
        .from("buildings")
        .select("owner_name, violation_count, full_address, metro")
        .in("metro", VALID_CITIES)
        .not("owner_name", "is", null)
        .order("violation_count", { ascending: false })
        .limit(100);

      // Aggregate by owner
      const ownerMap = new Map<
        string,
        { totalViolations: number; buildings: Array<{ address: string; violations: number }> }
      >();
      for (const b of buildings ?? []) {
        const name = b.owner_name as string;
        if (!ownerMap.has(name)) {
          ownerMap.set(name, { totalViolations: 0, buildings: [] });
        }
        const entry = ownerMap.get(name)!;
        entry.totalViolations += (b.violation_count as number) || 0;
        entry.buildings.push({
          address: b.full_address as string,
          violations: (b.violation_count as number) || 0,
        });
      }

      // Pick the worst owner
      let worstOwner = { name: "", totalViolations: 0, buildings: [] as Array<{ address: string; violations: number }> };
      for (const [name, data] of ownerMap) {
        if (data.totalViolations > worstOwner.totalViolations) {
          worstOwner = { name, ...data };
        }
      }

      sourceData = {
        owner: worstOwner.name,
        totalViolations: worstOwner.totalViolations,
        buildingCount: worstOwner.buildings.length,
        buildings: worstOwner.buildings.slice(0, 5),
        worstBuilding: worstOwner.buildings[0] ?? null,
      };
      break;
    }

    case "building_horror": {
      // Find buildings with the most violations — no date filter, just highest counts
      const { data: buildings, error: buildingsError } = await supabase
        .from("buildings")
        .select("id, full_address, borough, violation_count, owner_name, zip_code, metro")
        .in("metro", VALID_CITIES)
        .gt("violation_count", 10)
        .order("violation_count", { ascending: false })
        .limit(20);

      // There are always buildings over 10 violations, so an empty result means
      // the query failed (usually a statement timeout), not that the data is
      // gone. Treating that as fatal killed 17 runs — retry instead.
      if (buildingsError) {
        throw new RetryableError(`buildings query failed: ${buildingsError.message}`);
      }
      if (!buildings || buildings.length === 0) {
        throw new RetryableError("buildings query returned no rows (likely a timeout)");
      }

      // Pick a random one from top 20 to avoid repeating the same building
      const building = buildings[Math.floor(Math.random() * buildings.length)];

      // Get recent violations for this building
      const { data: violations } = await supabase
        .from("hpd_violations")
        .select("nov_description, class, inspection_date, status")
        .eq("building_id", building.id)
        .order("inspection_date", { ascending: false })
        .limit(10);

      sourceData = {
        building,
        recentViolations: violations ?? [],
        violationCount: building.violation_count,
      };
      break;
    }

    case "neighborhood_trend": {
      // Get violation data from buildings
      const { data: buildingData } = await supabase
        .from("buildings")
        .select("id, zip_code, violation_count, metro")
        .in("metro", VALID_CITIES)
        .not("zip_code", "is", null)
        .gt("violation_count", 0)
        .limit(500);

      // Get rent data from building_rents table
      const { data: rentRows } = await supabase
        .from("building_rents")
        .select("building_id, median_rent")
        .not("median_rent", "is", null)
        .limit(500);

      // Build rent lookup by building_id
      const rentByBuilding = new Map<string, number>();
      for (const r of rentRows ?? []) {
        rentByBuilding.set(r.building_id as string, r.median_rent as number);
      }

      // Aggregate by zip
      const zipMap = new Map<
        string,
        { totalRent: number; rentCount: number; totalViolations: number; count: number; city: string }
      >();
      for (const b of buildingData ?? []) {
        const zip = b.zip_code as string;
        if (!zipMap.has(zip)) {
          zipMap.set(zip, { totalRent: 0, rentCount: 0, totalViolations: 0, count: 0, city: b.metro as string });
        }
        const entry = zipMap.get(zip)!;
        entry.totalViolations += (b.violation_count as number) || 0;
        entry.count += 1;
        // The rent lookup was built but never read, so every neighborhood post
        // shipped with "avgRent: 0".
        const rent = rentByBuilding.get(b.id as string);
        if (rent !== undefined) {
          entry.totalRent += rent;
          entry.rentCount += 1;
        }
      }

      // Pick an interesting zip (high violations per building)
      let picked = { zip: "", avgRent: 0, totalViolations: 0, buildingCount: 0, city: "" };
      let maxScore = 0;
      for (const [zip, data] of zipMap) {
        if (data.count < 3) continue;
        const score = data.totalViolations / data.count;
        if (score > maxScore) {
          maxScore = score;
          picked = {
            zip,
            avgRent: data.rentCount > 0 ? Math.round(data.totalRent / data.rentCount) : 0,
            totalViolations: data.totalViolations,
            buildingCount: data.count,
            city: data.city,
          };
        }
      }

      // An all-empty pick means no zip cleared the bar. Emitting it anyway is
      // what produced posts about a neighborhood with no name, no rent and no
      // violations — fail instead so nothing unsourced reaches generation.
      if (!picked.zip) {
        throw new RetryableError("no neighborhood met the aggregation threshold");
      }

      sourceData = { neighborhood: picked };
      break;
    }

    case "tenant_rights": {
      const topics = [
        { topic: "Right to heat", law: "NYC Admin Code 27-2029", details: "Landlords must provide heat Oct 1 - May 31. Day: 68F when outside < 55F. Night: 62F." },
        { topic: "Rent stabilization", law: "NYC Rent Stabilization Law", details: "Buildings built before 1974 with 6+ units. Rent increases capped by RGB." },
        { topic: "Security deposit limits", law: "Housing Stability & Tenant Protection Act 2019", details: "Max 1 month rent. Must be returned within 14 days." },
        { topic: "Right to repairs", law: "Warranty of Habitability", details: "Landlords must maintain livable conditions. Tenants can withhold rent for major violations." },
        { topic: "Anti-retaliation protections", law: "Real Property Law 223-b", details: "Landlords cannot retaliate against tenants who file complaints." },
        { topic: "Lead paint disclosure", law: "NYC Local Law 1", details: "Landlords must test for lead paint in apartments with children under 6." },
        { topic: "Right to organize", law: "Real Property Law 230", details: "Tenants have the right to form tenant associations." },
        { topic: "Lease renewal rights", law: "Rent Stabilization Code 2524.3", details: "Stabilized tenants have right to a renewal lease. Landlord must offer 90-150 days before expiry." },
      ];
      const pick = topics[Math.floor(Math.random() * topics.length)];
      sourceData = { tenantRight: pick };
      break;
    }

    case "news_reaction": {
      const { data: articles } = await supabase
        .from("news_articles")
        .select("*")
        .in("metro", VALID_CITIES)
        .order("published_at", { ascending: false })
        .limit(3);

      if (!articles || articles.length === 0) {
        // Fallback to trends
        const trends = await searchTrends({
          platform: "twitter",
          keywords: ["rent", "landlord", "housing", "tenant"],
          limit: 5,
        });
        sourceData = { trendFallback: true, trends: trends.trends.slice(0, 3) };
      } else {
        sourceData = { article: articles[0] };
      }
      break;
    }

    case "viral_humor": {
      // Pick a random interesting building
      const { data: buildings } = await supabase
        .from("buildings")
        .select("full_address, metro, violation_count, owner_name")
        .in("metro", VALID_CITIES)
        .gte("violation_count", 20)
        .order("violation_count", { ascending: false })
        .limit(20);

      const building =
        buildings?.[Math.floor(Math.random() * (buildings?.length ?? 1))] ?? null;

      // Lucid the Lizard is primary (50%+), with occasional guest characters
      const lucidChance = Math.random();
      const character =
        lucidChance < 0.6
          ? "Lucid the Lizard (the LucidRents mascot — a cute, wide-eyed mint-green gecko)"
          : [
              "a sentient strawberry",
              "an AI-powered avocado",
              "a concerned potato",
              "a dramatic lemon",
            ][Math.floor(Math.random() * 4)];

      sourceData = { building, character };
      break;
    }
  }

  const summary = `Gathered ${contentType} data: ${Object.keys(sourceData).join(", ")}`;
  emitEvent({ type: "source_data_gathered", summary });

  console.log(
    JSON.stringify({ step: "gatherSourceData", event: "done", keys: Object.keys(sourceData), ms: Date.now() - t0 })
  );
  return sourceData;
}

// ---------------------------------------------------------------------------
// Step 3 - Generate content via Claude
// ---------------------------------------------------------------------------

async function generateContent(
  contentType: MarketingContentType,
  sourceData: Record<string, unknown>
): Promise<{
  caption: string;
  platformVariants: PlatformVariants;
  videoScript: string;
}> {
  "use step";
  const t0 = Date.now();
  console.log(JSON.stringify({ step: "generateContent", event: "start", contentType }));

  const { generateText } = await import("ai");

  const systemPrompt = CONTENT_SYSTEM_PROMPT + "\n\n" + getContentTypePrompt(contentType);
  const platformConfigStr = JSON.stringify(PLATFORM_CONFIGS, null, 2);

  const userPrompt = `SOURCE DATA:
${JSON.stringify(sourceData, null, 2)}

PLATFORM CONFIGS (respect length limits):
${platformConfigStr}

Generate social media content based on the source data above. Return ONLY valid JSON with this structure:
{
  "caption": "The primary caption (used as base for all platforms)",
  "platform_variants": {
    "instagram": { "caption": "...", "hashtags": ["..."] },
    "tiktok": { "caption": "...", "hashtags": ["..."] },
    "youtube": { "caption": "...", "title": "...", "hashtags": ["..."], "tags": ["..."] },
    "x": { "caption": "...", "hashtags": ["..."] },
    "linkedin": { "caption": "...", "hashtags": ["..."] },
    "facebook": { "caption": "...", "hashtags": ["..."] },
    "pinterest": { "title": "...", "description": "...", "board": "..." },
    "threads": { "caption": "...", "hashtags": ["..."] },
    "bluesky": { "caption": "..." }
  },
  "video_script": "A 30-45 second script for the video. Include visual cues in [brackets]."
}

IMPORTANT:
- Every caption must end with the CTA: "Check your building free at lucidrents.com"
- Use ONLY real data from SOURCE DATA. Never fabricate statistics.
- Pinterest board must be one of: ${JSON.stringify(Object.values(PINTEREST_BOARDS).flat())}
- X caption must be under 280 chars total including hashtags.
- Bluesky has 0 hashtags allowed.`;

  const result = await generateText({
    model: "anthropic/claude-sonnet-4.6" as never,
    system: systemPrompt,
    prompt: userPrompt,
    maxOutputTokens: 4000,
  });

  // Parse the JSON response
  let parsed: { caption: string; platform_variants: PlatformVariants; video_script: string };
  try {
    // Strip markdown code fences if present
    let text = result.text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    parsed = JSON.parse(text);
  } catch (e) {
    throw new RetryableError(
      `Failed to parse Claude response as JSON: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  if (!parsed.caption || !parsed.platform_variants) {
    throw new FatalError("Claude response missing required fields (caption, platform_variants)");
  }

  emitEvent({
    type: "content_generated",
    captionPreview: parsed.caption.slice(0, 120),
    platformCount: Object.keys(parsed.platform_variants).length,
  });

  console.log(
    JSON.stringify({
      step: "generateContent",
      event: "done",
      platformCount: Object.keys(parsed.platform_variants).length,
      ms: Date.now() - t0,
    })
  );

  return {
    caption: parsed.caption,
    platformVariants: parsed.platform_variants,
    videoScript: parsed.video_script ?? "",
  };
}

// ---------------------------------------------------------------------------
// Step 3b - Generate Pinterest image (if under daily limit)
// ---------------------------------------------------------------------------

async function generatePinterestImage(
  contentType: MarketingContentType,
  sourceData: Record<string, unknown>,
  variants: PlatformVariants
): Promise<string | null> {
  "use step";
  const t0 = Date.now();
  console.log(JSON.stringify({ step: "generatePinterestImage", event: "start" }));

  const pinterestCount = await getPinterestCountToday();
  if (pinterestCount >= 2) {
    console.log(
      JSON.stringify({ step: "generatePinterestImage", event: "skipped", reason: "daily limit reached", count: pinterestCount })
    );
    return null;
  }

  const pinterestVariant = variants.pinterest;
  if (!pinterestVariant) {
    console.log(
      JSON.stringify({ step: "generatePinterestImage", event: "skipped", reason: "no pinterest variant" })
    );
    return null;
  }

  // Generate an infographic-style image via AI Gateway using Gemini
  const { generateText } = await import("ai");

  const imagePrompt = `Generate an image: A clean, modern infographic-style Pinterest pin about: "${pinterestVariant.title}".
Style: Professional data visualization, dark navy (#0F1D2E) background, blue (#3B82F6) accent color, white text.
Include the LucidRents logo watermark. Aspect ratio 2:3 (Pinterest optimal).
Content type: ${contentType}.
Key data point: ${JSON.stringify(sourceData).slice(0, 200)}`;

  try {
    const imageResult = await generateText({
      model: "google/gemini-3.1-flash-image-preview" as never,
      prompt: imagePrompt,
      providerOptions: {
        google: { responseModalities: ["TEXT", "IMAGE"] },
      },
    });

    const imageFile = imageResult.files?.[0];
    if (!imageFile || !imageFile.base64) {
      console.log(
        JSON.stringify({ step: "generatePinterestImage", event: "skipped", reason: "no image generated" })
      );
      return null;
    }

    // Upload to Vercel Blob
    const timestamp = Date.now();
    const blobResult = await put(
      `marketing/pinterest/${contentType}-${timestamp}.png`,
      Buffer.from(imageFile.base64, "base64"),
      { access: "public" }
    );

    emitEvent({ type: "pinterest_image_generated", imageUrl: blobResult.url });

    console.log(
      JSON.stringify({ step: "generatePinterestImage", event: "done", url: blobResult.url, ms: Date.now() - t0 })
    );
    return blobResult.url;
  } catch (err) {
    // Pinterest image is non-critical; log and continue
    console.log(
      JSON.stringify({
        step: "generatePinterestImage",
        event: "error",
        error: err instanceof Error ? err.message : String(err),
        ms: Date.now() - t0,
      })
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 4 - Generate video
// ---------------------------------------------------------------------------

async function generateVideo(
  videoType: MarketingVideoType,
  script: string,
  sourceData: Record<string, unknown>,
  draftId: string
): Promise<string[]> {
  "use step";
  const t0 = Date.now();
  console.log(JSON.stringify({ step: "generateVideo", event: "start", videoType }));

  if (videoType === "none") {
    console.log(JSON.stringify({ step: "generateVideo", event: "skipped", reason: "videoType=none" }));
    return [];
  }

  if (videoType === "data_viz") {
    // Remotion templates are Phase 7 -- skip for now
    console.log(
      JSON.stringify({ step: "generateVideo", event: "skipped", reason: "data_viz not yet implemented (Phase 7)" })
    );
    return [];
  }

  const tool = "kling";

  emitEvent({ type: "video_generating", videoType, tool });

  try {
    // Kling only accepts a duration of 5 or 10 — anything else is a hard
    // HTTP 400 (code 1201). Sending 12 killed every avatar run for weeks.
    const videoId = await submitTextToVideo({
      prompt: script,
      duration: videoType === "avatar" ? 10 : 5,
      aspectRatio: videoType === "avatar" ? "16:9" : "9:16",
    });

    console.log(JSON.stringify({ step: "generateVideo", event: "submitted", tool, videoId }));

    // Poll for completion
    const MAX_POLLS = 20;
    let videoUrl: string | undefined;

    for (let attempt = 1; attempt <= MAX_POLLS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 30_000));

      const status = await checkTaskStatus(videoId);

      console.log(
        JSON.stringify({ step: "generateVideo", event: "poll", attempt, status: status.status })
      );

      if (status.status === "completed" && status.videoUrl) {
        videoUrl = status.videoUrl;
        break;
      }

      if (status.status === "failed") {
        console.log(JSON.stringify({ step: "generateVideo", event: "generation_failed", error: status.error }));
        return []; // Don't retry — video failed, proceed without video
      }
    }

    if (!videoUrl) {
      console.log(JSON.stringify({ step: "generateVideo", event: "timeout", polls: MAX_POLLS }));
      return []; // Timed out — proceed without video
    }

    // Download and upload to Blob
    const videoBuffer = await downloadKlingVideo(videoUrl);

    const timestamp = Date.now();
    const blobResult = await put(
      `marketing/videos/${draftId}-${timestamp}.mp4`,
      videoBuffer,
      { access: "public" }
    );

    const durationMs = Date.now() - t0;
    emitEvent({ type: "video_complete", mediaUrl: blobResult.url, durationMs });

    console.log(
      JSON.stringify({ step: "generateVideo", event: "done", url: blobResult.url, ms: durationMs })
    );

    return [blobResult.url];
  } catch (err) {
    // Video is a nice-to-have, never a blocker. A caption + Pinterest card is
    // still a publishable post, so degrade to text-only rather than failing the
    // run. Retrying here is what turned a bad `duration` param into 28 dead
    // runs — the step exhausted its retries and took the whole workflow down.
    const msg = err instanceof Error ? err.message : String(err);
    console.log(
      JSON.stringify({ step: "generateVideo", event: "error", degraded: "text-only", error: msg })
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Step 5 - Save draft and prepare for approval
// ---------------------------------------------------------------------------

async function saveDraft(
  draftId: string,
  data: {
    contentType: MarketingContentType;
    caption: string;
    platformVariants: PlatformVariants;
    mediaUrls: string[];
    videoType: MarketingVideoType;
    sourceData: Record<string, unknown>;
    pinterestImageUrl: string | null;
  }
): Promise<string> {
  "use step";
  const t0 = Date.now();
  console.log(JSON.stringify({ step: "saveDraft", event: "start", draftId }));

  // Merge Pinterest image URL into variants if present
  const variants = { ...data.platformVariants };
  if (data.pinterestImageUrl && variants.pinterest) {
    variants.pinterest = { ...variants.pinterest, image_url: data.pinterestImageUrl };
  }

  const hookToken = `approval:${draftId}`;

  // content_type has to be written back here — initDraft only ever set a
  // placeholder, so without this every row reads "landlord_expose" and
  // getRecentContentTypes (which drives rotation) sees nothing but that.
  await updateDraft(draftId, {
    status: "draft",
    contentType: data.contentType,
    caption: data.caption,
    platformVariants: variants,
    mediaUrls: data.mediaUrls,
    videoType: data.videoType,
    sourceData: data.sourceData,
    hookToken,
  });

  emitEvent({ type: "awaiting_approval", hookToken, draftId });

  console.log(
    JSON.stringify({ step: "saveDraft", event: "done", hookToken, ms: Date.now() - t0 })
  );
  return hookToken;
}

// ---------------------------------------------------------------------------
// Step 5b - Pre-publish sanity gate
// ---------------------------------------------------------------------------

/**
 * Last line of defence before content goes out unattended. Publishing is
 * automatic, so this is the only thing standing between a bad data pull and a
 * public post. It checks the copy is real and that the numbers in it came from
 * somewhere — it deliberately does NOT judge tone or quality.
 */
async function validateDraft(draftId: string): Promise<{ ok: boolean; reasons: string[] }> {
  "use step";
  const t0 = Date.now();
  console.log(JSON.stringify({ step: "validateDraft", event: "start", draftId }));

  const draft = await getDraft(draftId);
  if (!draft) {
    return { ok: false, reasons: [`draft ${draftId} not found`] };
  }

  const reasons: string[] = [];
  const caption = (draft.caption ?? "").trim();
  const variants = draft.platform_variants ?? {};
  const source = draft.source_data ?? {};

  if (caption.length < 20) {
    reasons.push(`caption too short (${caption.length} chars)`);
  }

  // Unrendered template slots and stringified nullish values are the classic
  // tells that a data lookup came back empty but generation carried on anyway.
  const artifacts = [
    /\{\{[^}]*\}\}/, // {{placeholder}}
    /\[(?:INSERT|TODO|NAME|ADDRESS|NUMBER|X+)\]/i, // [INSERT NAME]
    /\b(?:undefined|NaN)\b/,
    /\bnull\b/i,
  ];
  const captionAndVariants = caption + " " + JSON.stringify(variants);
  for (const rx of artifacts) {
    const hit = captionAndVariants.match(rx);
    if (hit) reasons.push(`template artifact in copy: ${hit[0]}`);
  }

  if (Object.keys(variants).length === 0) {
    reasons.push("no platform variants generated");
  }

  // Every claim we publish has to trace back to a real row. An empty
  // source_data means the post is unsourced, which is the one failure mode
  // that actually damages credibility.
  if (Object.keys(source).length === 0) {
    reasons.push("source_data is empty — post would be unsourced");
  }

  // Type-specific: the headline number must be non-zero, otherwise we publish
  // things like "this landlord has 0 violations". Paths are dotted because
  // some source shapes nest (neighborhood_trend puts everything under one key).
  const numericClaims: Record<string, string[]> = {
    landlord_expose: ["totalViolations"],
    building_horror: ["violationCount"],
    neighborhood_trend: ["neighborhood.totalViolations", "neighborhood.buildingCount"],
  };

  const readPath = (obj: Record<string, unknown>, path: string): unknown =>
    path.split(".").reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined,
      obj
    );

  for (const path of numericClaims[draft.content_type] ?? []) {
    const raw = readPath(source, path);
    const value = Number(raw ?? 0);
    if (!Number.isFinite(value) || value <= 0) {
      reasons.push(`${draft.content_type}.${path} is ${String(raw)} — no story here`);
    }
  }

  const ok = reasons.length === 0;
  console.log(
    JSON.stringify({ step: "validateDraft", event: "done", draftId, ok, reasons, ms: Date.now() - t0 })
  );
  return { ok, reasons };
}

/** Park a draft that failed validation so a human can look, without publishing. */
async function holdForReview(draftId: string, reasons: string[]): Promise<void> {
  "use step";
  console.log(JSON.stringify({ step: "holdForReview", event: "start", draftId, reasons }));
  await updateDraft(draftId, {
    status: "draft",
    errorMessage: `Held from auto-publish: ${reasons.join("; ")}`,
  });
  console.log(JSON.stringify({ step: "holdForReview", event: "done", draftId }));
}

// ---------------------------------------------------------------------------
// Step 6 - Publish to all platforms
// ---------------------------------------------------------------------------

async function publish(
  draftId: string,
  editedContent?: { caption?: string; platform_variants?: PlatformVariants }
): Promise<void> {
  "use step";
  const t0 = Date.now();
  console.log(JSON.stringify({ step: "publish", event: "start", draftId }));

  let results: PublishResult[];
  try {
    results = await publishDraft(draftId, editedContent);
  } catch (err) {
    if (err instanceof DraftNotFoundError) {
      throw new FatalError(err.message);
    }
    throw err;
  }

  emitEvent({ type: "published", results });

  console.log(
    JSON.stringify({
      step: "publish",
      event: "done",
      resultCount: results.length,
      errors: results.filter((r) => r.error).length,
      ms: Date.now() - t0,
    })
  );
}

// ---------------------------------------------------------------------------
// Helper step - Handle failure (update draft + send alert email)
// ---------------------------------------------------------------------------

async function handleFailure(
  draftId: string,
  stepName: string,
  error: string,
  contentType: MarketingContentType
): Promise<void> {
  "use step";
  console.log(JSON.stringify({ step: "handleFailure", event: "start", draftId, stepName, error }));

  await updateDraft(draftId, {
    status: "failed",
    contentType,
    errorMessage: `[${stepName}] ${error}`,
  });

  // Send alert email
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const meta = getWorkflowMetadata();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://lucidrents.com";

    await resend.emails.send({
      from: "LucidRents Alerts <alerts@lucidrents.com>",
      to: process.env.ALERT_EMAIL || "team@lucidrents.com",
      subject: buildMarketingAlertSubject(stepName),
      html: buildMarketingAlertHtml({
        stepName,
        error,
        draftId,
        workflowRunId: meta.workflowRunId,
        contentType,
        baseUrl,
      }),
    });
  } catch (emailErr) {
    console.log(
      JSON.stringify({
        step: "handleFailure",
        event: "email_error",
        error: emailErr instanceof Error ? emailErr.message : String(emailErr),
      })
    );
  }

  console.log(JSON.stringify({ step: "handleFailure", event: "done", draftId }));
}

// ---------------------------------------------------------------------------
// Main workflow
// ---------------------------------------------------------------------------

export async function contentWorkflow(): Promise<void> {
  "use workflow";

  console.log("[contentWorkflow] START");

  // Step 0: Initialize draft row
  const { draftId } = await initDraft();
  console.log(`[contentWorkflow] initDraft done, draftId=${draftId}`);

  let contentType: MarketingContentType = "landlord_expose";

  try {
    // Step 1: Select content type
    const selection = await selectContentType();
    contentType = selection.contentType;
    const videoType = selection.videoType;
    console.log(`[contentWorkflow] selectContentType done, type=${contentType}`);

    // Step 2: Gather source data
    const sourceData = await gatherSourceData(contentType);
    console.log("[contentWorkflow] gatherSourceData done");

    // Step 3: Generate content
    const { caption, platformVariants, videoScript } = await generateContent(
      contentType,
      sourceData
    );
    console.log("[contentWorkflow] generateContent done");

    // Step 3b: Generate Pinterest image (if under daily limit)
    const pinterestImageUrl = await generatePinterestImage(contentType, sourceData, platformVariants);
    console.log("[contentWorkflow] generatePinterestImage done");

    // Step 4: Generate video
    const mediaUrls = await generateVideo(videoType, videoScript, sourceData, draftId);
    console.log("[contentWorkflow] generateVideo done");

    // Step 5: Save draft
    const hookToken = await saveDraft(draftId, {
      contentType,
      caption,
      platformVariants,
      mediaUrls,
      videoType,
      sourceData,
      pinterestImageUrl,
    });
    console.log(`[contentWorkflow] saveDraft done, hookToken=${hookToken}`);

    // Step 5b: Sanity gate. Publishing is unattended, so a draft that fails
    // validation is parked for review rather than sent. This replaced a
    // blocking approval hook that stranded 56 drafts and published none.
    const validation = await validateDraft(draftId);

    if (!validation.ok) {
      console.log(
        `[contentWorkflow] HELD, failed validation: ${validation.reasons.join("; ")}`
      );
      await holdForReview(draftId, validation.reasons);
      return;
    }

    console.log("[contentWorkflow] validation passed, publishing");

    // Step 6: Publish
    await publish(draftId);
    console.log("[contentWorkflow] DONE, published");
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const stepName = errorMessage.includes("selectContentType")
      ? "selectContentType"
      : errorMessage.includes("gatherSourceData")
      ? "gatherSourceData"
      : errorMessage.includes("generateContent")
      ? "generateContent"
      : errorMessage.includes("generateVideo")
      ? "generateVideo"
      : "unknown";

    console.log(
      `[contentWorkflow] FAILED at step=${stepName}: ${errorMessage}`
    );

    await handleFailure(draftId, stepName, errorMessage, contentType);
  }
}
