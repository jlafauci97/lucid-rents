import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { buildingId } = await req.json();
  if (!buildingId) {
    return NextResponse.json({ error: "buildingId is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("saved_buildings")
    .insert({ user_id: user.id, building_id: buildingId })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already saved this building" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ saved: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { buildingId } = await req.json();
  if (!buildingId) {
    return NextResponse.json({ error: "buildingId is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("saved_buildings")
    .delete()
    .eq("user_id", user.id)
    .eq("building_id", buildingId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
