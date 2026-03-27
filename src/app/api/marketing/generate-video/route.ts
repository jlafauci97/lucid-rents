import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  submitTextToVideo,
  submitImageToVideo,
  checkTaskStatus,
  downloadVideo,
  LUCID_REFERENCE_IMAGE_URL,
} from "@/lib/marketing/kling";
import {
  LUCID_LIZARD_PROMPT,
  LUCID_EMOTIONS,
} from "@/lib/marketing/brand-voice";
import { put } from "@vercel/blob";
import type { MarketingVideoType } from "@/types/marketing";

export const maxDuration = 300; // 5 min — video gen takes time

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { draftId, videoType } = body as {
      draftId: string;
      videoType?: MarketingVideoType;
    };

    if (!draftId) {
      return NextResponse.json({ ok: false, error: "draftId is required" }, { status: 400 });
    }

    // Get the draft
    const supabase = createAdminClient();
    const { data: draft, error: fetchErr } = await supabase
      .from("marketing_drafts")
      .select("*")
      .eq("id", draftId)
      .single();

    if (fetchErr || !draft) {
      return NextResponse.json({ ok: false, error: "Draft not found" }, { status: 404 });
    }

    const vType = videoType ?? (draft.video_type as MarketingVideoType) ?? "viral_character";

    // Build the video prompt
    let videoPrompt: string;
    const caption = draft.caption ?? "";

    if (vType === "viral_character") {
      // Lucid the Lizard — pick emotion based on content
      // IMPORTANT: Prompt must be purely VISUAL — no text, no captions, no data
      // Kling hallucinates on-screen text if the prompt mentions any words/data
      const emotion =
        caption.toLowerCase().includes("horror") || caption.toLowerCase().includes("violation")
          ? "shocked"
          : caption.toLowerCase().includes("outrage") || caption.toLowerCase().includes("worst")
          ? "outraged"
          : caption.toLowerCase().includes("confused") || caption.toLowerCase().includes("why")
          ? "confused"
          : "excited";

      const emotionDesc = LUCID_EMOTIONS[emotion] ?? LUCID_EMOTIONS.shocked;

      // Short, visual-only prompt — describes ACTIONS not text
      videoPrompt = `The cute mint-green gecko lizard character ${emotionDesc}. The lizard looks directly at camera, reacts dramatically, then slowly turns back to stare at the laptop screen in disbelief. Pixar-style 3D animation, dark background, soft studio lighting. No text, no words, no letters on screen.`;
    } else if (vType === "avatar") {
      videoPrompt = `A confident young professional speaks directly to camera in a modern studio. They gesture naturally while talking, making eye contact. Clean white background, warm lighting, shallow depth of field. No text on screen.`;
    } else {
      return NextResponse.json({ ok: false, error: `Video type "${vType}" not supported for on-demand generation` }, { status: 400 });
    }

    // Update draft status
    await supabase
      .from("marketing_drafts")
      .update({ status: "generating", video_type: vType })
      .eq("id", draftId);

    // Submit to Kling AI
    let taskId: string;
    try {
      if (vType === "viral_character") {
        // Use image-to-video with reference image for character consistency
        taskId = await submitImageToVideo({
          imageUrl: LUCID_REFERENCE_IMAGE_URL,
          prompt: videoPrompt,
          negativePrompt: "text, words, letters, subtitles, captions, watermark, blurry, low quality, deformed",
          duration: 10, // Kling max is 10s (only supports 5 or 10)
        });
      } else {
        taskId = await submitTextToVideo({
          prompt: videoPrompt,
          duration: 10,
          aspectRatio: "16:9",
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Revert status
      await supabase
        .from("marketing_drafts")
        .update({ status: "draft", error_message: `Video submit failed: ${msg}` })
        .eq("id", draftId);
      return NextResponse.json({ ok: false, error: `Kling API error: ${msg}` }, { status: 500 });
    }

    // Poll for completion (max 4 minutes)
    const MAX_POLLS = 24;
    let videoUrl: string | undefined;

    for (let i = 1; i <= MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, 10_000)); // 10s between polls

      try {
        const pollType = vType === "viral_character" ? "image2video" : "text2video";
        const status = await checkTaskStatus(taskId, pollType);

        if (status.status === "completed" && status.videoUrl) {
          videoUrl = status.videoUrl;
          break;
        }

        if (status.status === "failed") {
          await supabase
            .from("marketing_drafts")
            .update({ status: "draft", error_message: `Video failed: ${status.error}` })
            .eq("id", draftId);
          return NextResponse.json({ ok: false, error: `Video generation failed: ${status.error}` }, { status: 500 });
        }
      } catch {
        // Transient poll error, continue
      }
    }

    if (!videoUrl) {
      await supabase
        .from("marketing_drafts")
        .update({ status: "draft", error_message: "Video generation timed out" })
        .eq("id", draftId);
      return NextResponse.json({ ok: false, error: "Video generation timed out (4 min)" }, { status: 504 });
    }

    // Download and upload to Blob
    const videoBuffer = await downloadVideo(videoUrl);
    const blobResult = await put(
      `marketing/videos/${draftId}-${Date.now()}.mp4`,
      videoBuffer,
      { access: "public" }
    );

    // Update draft with video URL
    const existingUrls = (draft.media_urls as string[]) ?? [];
    await supabase
      .from("marketing_drafts")
      .update({
        status: "draft",
        media_urls: [...existingUrls, blobResult.url],
        error_message: null,
      })
      .eq("id", draftId);

    return NextResponse.json({ ok: true, videoUrl: blobResult.url });
  } catch (err) {
    console.error("Generate video error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
