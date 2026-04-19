import { NextRequest, NextResponse } from "next/server";
import { checkPassword, makeCookieValue, MC_COOKIE, MC_COOKIE_OPTIONS } from "@/lib/mission-control/auth";

export const runtime = "nodejs";

function safeRedirect(pathname: string | null | undefined): string {
  if (!pathname || !pathname.startsWith("/mission-control")) {
    return "/mission-control/news-drafts";
  }
  return pathname;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const next = safeRedirect(form.get("next")?.toString());

  if (!checkPassword(password)) {
    const url = req.nextUrl.clone();
    url.pathname = "/mission-control/login";
    url.searchParams.set("error", "1");
    url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  }

  const url = req.nextUrl.clone();
  url.pathname = next;
  url.search = "";
  const res = NextResponse.redirect(url, 303);
  res.cookies.set(MC_COOKIE, makeCookieValue(), MC_COOKIE_OPTIONS);
  return res;
}
