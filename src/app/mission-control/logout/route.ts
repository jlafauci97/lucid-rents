import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { MC_COOKIE } from "@/lib/mission-control/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const store = await cookies();
  store.delete(MC_COOKIE);
  const url = new URL("/mission-control/login", req.url);
  return NextResponse.redirect(url, 303);
}
