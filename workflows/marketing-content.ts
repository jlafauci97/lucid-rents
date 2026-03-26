import {
  getWritable,
  defineHook,
  sleep,
  FatalError,
  RetryableError,
  getWorkflowMetadata,
} from "workflow";

// Types
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
import { publishToAllPlatforms } from "@/lib/marketing/post-bridge";
import {
  submitTextToVideo,
  checkVideoStatus,
  downloadVideo as downloadNanoBananaVideo,
} from "@/lib/marketing/nano-banana";
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
// Hook: human approval
// ---------------------------------------------------------------------------

export const contentApprovalHook = defineHook<{
  approved: boolean;
  editedContent?: { caption?: string; platform_variants?: PlatformVariants };
}>();

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
        .select("owner_name, violation_count, address, city")
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
          address: b.address as string,
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
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: buildings } = await supabase
        .from("buildings")
        .select("address, city, borough, violation_count, owner_name, zip_code")
        .gte("updated_at", sevenDaysAgo)
        .order("violation_count", { ascending: false })
        .limit(5);

      const building = buildings?.[0] ?? null;
      if (!building) {
        throw new FatalError("No buildings with recent violations found");
      }

      // Get recent violations for this building
      const { data: violations } = await supabase
        .from("violations")
        .select("description, violation_type, inspection_date, status")
        .eq("building_address", building.address)
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
      const { data: rentData } = await supabase
        .from("buildings")
        .select("zip_code, median_rent, violation_count, city")
        .not("zip_code", "is", null)
        .not("median_rent", "is", null)
        .limit(500);

      // Aggregate by zip
      const zipMap = new Map<
        string,
        { totalRent: number; totalViolations: number; count: number; city: string }
      >();
      for (const b of rentData ?? []) {
        const zip = b.zip_code as string;
        if (!zipMap.has(zip)) {
          zipMap.set(zip, { totalRent: 0, totalViolations: 0, count: 0, city: b.city as string });
        }
        const entry = zipMap.get(zip)!;
        entry.totalRent += (b.median_rent as number) || 0;
        entry.totalViolations += (b.violation_count as number) || 0;
        entry.count += 1;
      }

      // Pick an interesting zip (high violations relative to rent)
      let picked = { zip: "", avgRent: 0, totalViolations: 0, buildingCount: 0, city: "" };
      let maxScore = 0;
      for (const [zip, data] of zipMap) {
        if (data.count < 3) continue;
        const score = data.totalViolations / data.count;
        if (score > maxScore) {
          maxScore = score;
          picked = {
            zip,
            avgRent: Math.round(data.totalRent / data.count),
            totalViolations: data.totalViolations,
            buildingCount: data.count,
            city: data.city,
          };
        }
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
        .eq("processed", false)
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
        .select("address, city, violation_count, owner_name")
        .gte("violation_count", 20)
        .order("violation_count", { ascending: false })
        .limit(20);

      const building =
        buildings?.[Math.floor(Math.random() * (buildings?.length ?? 1))] ?? null;

      const characters = [
        "a sentient strawberry",
        "an AI-powered avocado",
        "a concerned potato",
        "a dramatic lemon",
        "a horrified blueberry",
        "an investigative banana",
        "a shocked pineapple",
        "a sarcastic mushroom",
      ];
      const character = characters[Math.floor(Math.random() * characters.length)];

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

  const tool = "nano_banana";

  emitEvent({ type: "video_generating", videoType, tool });

  const videoId = await submitTextToVideo({
    prompt: script,
    duration: videoType === "avatar" ? 12 : 5,
    resolution: "1080p",
    aspectRatio: videoType === "avatar" ? "16:9" : "9:16",
  });

  console.log(JSON.stringify({ step: "generateVideo", event: "submitted", tool, videoId }));

  // Poll for completion
  const MAX_POLLS = 20;
  let videoUrl: string | undefined;

  for (let attempt = 1; attempt <= MAX_POLLS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 30_000));

    const status = await checkVideoStatus(videoId);

    console.log(
      JSON.stringify({ step: "generateVideo", event: "poll", attempt, status: status.status })
    );

    if (status.status === "completed" && status.videoUrl) {
      videoUrl = status.videoUrl;
      break;
    }

    if (status.status === "failed") {
      throw new RetryableError(`Video generation failed (${tool}): ${status.error ?? "unknown"}`);
    }
  }

  if (!videoUrl) {
    throw new RetryableError(`Video generation timed out after ${MAX_POLLS} polls (${tool})`);
  }

  // Download and upload to Blob
  const videoBuffer = await downloadNanoBananaVideo(videoUrl);

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

  await updateDraft(draftId, {
    status: "draft",
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
// Step 6 - Publish to all platforms
// ---------------------------------------------------------------------------

async function publish(
  draftId: string,
  editedContent?: { caption?: string; platform_variants?: PlatformVariants }
): Promise<void> {
  "use step";
  const t0 = Date.now();
  console.log(JSON.stringify({ step: "publish", event: "start", draftId }));

  const draft = await getDraft(draftId);
  if (!draft) {
    throw new FatalError(`Draft ${draftId} not found`);
  }

  // Apply edits if present
  let variants = draft.platform_variants ?? {};
  let caption = draft.caption ?? "";

  if (editedContent?.caption) {
    caption = editedContent.caption;
  }
  if (editedContent?.platform_variants) {
    variants = { ...variants, ...editedContent.platform_variants };
  }

  const mediaUrls = draft.media_urls ?? [];

  const results: PublishResult[] = await publishToAllPlatforms(variants, mediaUrls);

  await updateDraft(draftId, {
    status: "published",
    caption,
    platformVariants: variants,
    publishedAt: new Date().toISOString(),
    publishResults: results,
  });

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
// Helper step - Mark rejected
// ---------------------------------------------------------------------------

async function markRejected(draftId: string): Promise<void> {
  "use step";
  console.log(JSON.stringify({ step: "markRejected", event: "start", draftId }));
  await updateDraft(draftId, { status: "rejected" });
  console.log(JSON.stringify({ step: "markRejected", event: "done", draftId }));
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
    console.log("[contentWorkflow] saveDraft done, waiting for approval");

    // Hook: Wait for human approval
    const hook = contentApprovalHook.create({ token: hookToken });
    const approval = await hook;

    if (!approval.approved) {
      console.log("[contentWorkflow] REJECTED");
      await markRejected(draftId);
      return;
    }

    console.log("[contentWorkflow] APPROVED, publishing");

    // Step 6: Publish
    await publish(draftId, approval.editedContent);
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
