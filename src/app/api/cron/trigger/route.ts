import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const source = req.nextUrl.searchParams.get("source");
  const mode = req.nextUrl.searchParams.get("mode") || "sync";

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!supabaseUrl || !cronSecret) {
    return NextResponse.json(
      { error: "Missing Supabase config" },
      { status: 500 }
    );
  }

  const fnName = getFunctionName(source, mode);

  fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source, mode }),
  }).catch((err) => console.error("Edge Function invoke failed:", err));

  return NextResponse.json(
    { triggered: true, function: fnName, source, mode },
    { status: 202 }
  );
}

function getFunctionName(
  source: string | null,
  mode: string
): string {
  const standaloneFunctions = new Set([
    "sync-news",
    "sync-energy",
    "sync-transit",
    "sync-la-transit",
    "sync-schools",
    "sync-encampments",
    "sync-rent-stabilization",
    "sync-zillow-rents",
    "geocode-buildings",
  ]);

  if (source && standaloneFunctions.has(source)) {
    return source;
  }

  return "sync";
}
