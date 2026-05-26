import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createCacheClient } from "@/lib/supabase/cache-client";
import { isValidCity, type City } from "@/lib/cities";
import { CHIPS, type ChipId } from "@/lib/building-list/chips";
import { getBuildingsForChip } from "@/lib/building-list/query";

// Edge runtime — pure I/O Supabase read.
export const runtime = "edge";

interface RouteContext {
  params: Promise<{ chip: string }>;
}

const PER_PAGE = 30;

export async function GET(req: NextRequest, context: RouteContext) {
  const { chip: chipParam } = await context.params;
  const sp = req.nextUrl.searchParams;
  const cityParam = sp.get("city");
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const sort = sp.get("sort") || undefined;

  if (!cityParam || !isValidCity(cityParam)) {
    return NextResponse.json({ error: "Invalid city" }, { status: 400 });
  }
  if (!(chipParam in CHIPS)) {
    return NextResponse.json({ error: "Invalid chip" }, { status: 400 });
  }

  const city = cityParam as City;
  const chip = CHIPS[chipParam as ChipId];
  const offset = (page - 1) * PER_PAGE;

  const supabase = createCacheClient();
  const { buildings, count } = await getBuildingsForChip(supabase, city, chip, {
    offset,
    limit: PER_PAGE,
    sort: sort ?? undefined,
  });

  return NextResponse.json({
    buildings,
    page,
    perPage: PER_PAGE,
    count,
    totalPages: Math.max(1, Math.ceil(count / PER_PAGE)),
  });
}
