import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("monitored_buildings")
    .select("*, building:buildings(id, full_address, borough, overall_score)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ monitored: data });
}

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
    .from("monitored_buildings")
    .insert({ user_id: user.id, building_id: buildingId })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already monitoring this building" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ monitored: data }, { status: 201 });
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
    .from("monitored_buildings")
    .delete()
    .eq("user_id", user.id)
    .eq("building_id", buildingId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
