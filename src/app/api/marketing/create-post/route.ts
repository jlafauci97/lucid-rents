import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MarketingContentType, MarketingVideoType } from "@/types/marketing";
import {
  CONTENT_SYSTEM_PROMPT,
  getContentTypePrompt,
  PLATFORM_CONFIGS,
} from "@/lib/marketing/brand-voice";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, contentType, videoType } = body as {
      prompt: string;
      contentType: MarketingContentType;
      videoType: MarketingVideoType;
    };

    if (!prompt?.trim()) {
      return NextResponse.json({ ok: false, error: "Prompt is required" }, { status: 400 });
    }

    // Generate content via AI Gateway
    const { generateText } = await import("ai");

    const systemPrompt = `${CONTENT_SYSTEM_PROMPT}\n\n${getContentTypePrompt(contentType)}\n\nThe user has provided this creative brief:\n"${prompt}"\n\nGenerate:\n1. A primary caption (the core message)\n2. Platform-specific variants for: Instagram, TikTok, X, LinkedIn, Pinterest, YouTube, Facebook, Threads, Bluesky\n3. Hashtags per platform (following the hashtag rules in the system prompt)\n4. For Pinterest: a search-optimized title, description, and suggested board\n5. For YouTube: a title and tags\n\nRespond in JSON format with this structure:\n{\n  "caption": "primary caption here",\n  "platform_variants": {\n    "instagram": { "caption": "...", "hashtags": ["..."] },\n    "tiktok": { "caption": "...", "hashtags": ["..."] },\n    "x": { "caption": "...", "hashtags": ["..."] },\n    "linkedin": { "caption": "...", "hashtags": ["..."] },\n    "pinterest": { "title": "...", "description": "...", "board": "..." },\n    "youtube": { "title": "...", "caption": "...", "hashtags": ["..."], "tags": ["..."] },\n    "facebook": { "caption": "...", "hashtags": ["..."] },\n    "threads": { "caption": "...", "hashtags": ["..."] },\n    "bluesky": { "caption": "..." }\n  }\n}\n\nOnly respond with valid JSON, no markdown fences.`;

    const result = await generateText({
      model: "anthropic/claude-sonnet-4.6" as never,
      prompt: systemPrompt,
      maxTokens: 4000,
    });

    // Parse the AI response
    let content: { caption: string; platform_variants: Record<string, unknown> };
    try {
      const text = result.text.trim();
      // Strip markdown fences if present
      const jsonStr = text.startsWith("```")
        ? text.replace(/^```json?\n?/, "").replace(/\n?```$/, "")
        : text;
      content = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({ ok: false, error: "AI generated invalid JSON — try again" }, { status: 500 });
    }

    // Save as draft
    const supabase = createAdminClient();
    const { data: draft, error } = await supabase
      .from("marketing_drafts")
      .insert({
        content_type: contentType,
        video_type: videoType,
        status: "draft",
        caption: content.caption,
        platform_variants: content.platform_variants,
        source_data: { manual_prompt: prompt },
        media_urls: [],
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, draftId: draft.id });
  } catch (err) {
    console.error("Create post error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
