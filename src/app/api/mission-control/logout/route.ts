import { NextRequest, NextResponse } from "next/server";
import { MC_COOKIE } from "@/lib/mission-control/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/mission-control/login";
  url.search = "";
  const res = NextResponse.redirect(url, 303);
  res.cookies.delete(MC_COOKIE);
  return res;
}
