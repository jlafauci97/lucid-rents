import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Syncs now run locally via launchd on the Mac Mini.
  // This route is disabled to prevent Vercel crons from interfering.
  const source = req.nextUrl.searchParams.get("source");
  const mode = req.nextUrl.searchParams.get("mode") || "sync";
  return NextResponse.json(
    { disabled: true, reason: "Syncs moved to local infrastructure", source, mode },
    { status: 200 }
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
