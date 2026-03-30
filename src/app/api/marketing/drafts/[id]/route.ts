import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDraft, updateDraft } from "@/lib/marketing/supabase-queries";
import type { PlatformVariants } from "@/types/marketing";

type RouteContext = { params: Promise<{ id: string }> };

async function checkAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const adminIds = (process.env.MARKETING_ADMIN_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return adminIds.includes(user.id) ? user.id : null;
}

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
) {
  const { id } = await params;

  try {
    const draft = await getDraft(id);
    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }
    return NextResponse.json({ draft });
  } catch (err) {
    console.error("Get draft error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: RouteContext
) {
  const adminId = await checkAdmin();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: { caption?: string; platform_variants?: PlatformVariants };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { caption, platform_variants } = body;
  if (caption === undefined && platform_variants === undefined) {
    return NextResponse.json(
      { error: "Provide at least one field to update: caption, platform_variants" },
      { status: 400 }
    );
  }

  try {
    const draft = await getDraft(id);
    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    await updateDraft(id, {
      ...(caption !== undefined && { caption }),
      ...(platform_variants !== undefined && { platformVariants: platform_variants }),
    });

    const updated = await getDraft(id);
    return NextResponse.json({ draft: updated });
  } catch (err) {
    console.error("Update draft error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
