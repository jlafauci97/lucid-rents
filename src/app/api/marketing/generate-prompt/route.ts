import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic, city, tone, contentType, angle } = body as {
      topic: string;
      city: string;
      tone: string;
      contentType: string;
      angle: string;
    };

    if (!topic?.trim()) {
      return NextResponse.json({ ok: false, error: "Topic is required" }, { status: 400 });
    }

    const { generateText } = await import("ai");

    const result = await generateText({
      model: "anthropic/claude-sonnet-4.6" as never,
      system: `You are a social media creative director for LucidRents, a rental intelligence platform. Your job is to take rough inputs and turn them into compelling, detailed content briefs that will be used to generate social media posts.

Write the brief as a single paragraph — direct, specific, and ready to be used as a prompt for content generation. Include the data angle, emotional hook, and suggested framing. Keep it under 200 words.

Do NOT include hashtags, platform names, or formatting instructions. Just the creative brief.`,
      prompt: `Generate a content brief based on these inputs:
- Topic: ${topic}
- City focus: ${city || "any"}
- Tone: ${tone || "informative and punchy"}
- Content type: ${contentType}
- Angle/hook: ${angle || "whatever is most compelling"}

Write a single paragraph creative brief.`,
      maxOutputTokens: 500,
    });

    return NextResponse.json({ ok: true, prompt: result.text.trim() });
  } catch (err) {
    console.error("Generate prompt error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
