import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

const ALLOWED_PATH_PATTERNS = [/^\/\[city\]($|\/)/, /^\/$/];
const ALLOWED_TAG_PATTERNS = [/^landlords:[a-z-]+$/, /^landlord-data$/];
const MAX_ITEMS = 10;

export async function POST(req: NextRequest) {
  const { paths, tags, secret } = await req.json();

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let revalidatedPaths = 0;
  let revalidatedTags = 0;

  if (Array.isArray(paths)) {
    if (paths.length > MAX_ITEMS) {
      return NextResponse.json({ error: "Too many paths" }, { status: 400 });
    }
    const valid = paths.filter(
      (p: unknown) =>
        typeof p === "string" &&
        ALLOWED_PATH_PATTERNS.some((re) => re.test(p))
    );
    for (const path of valid) revalidatePath(path, "page");
    revalidatedPaths = valid.length;
  }

  if (Array.isArray(tags)) {
    if (tags.length > MAX_ITEMS) {
      return NextResponse.json({ error: "Too many tags" }, { status: 400 });
    }
    const valid = tags.filter(
      (t: unknown) =>
        typeof t === "string" &&
        ALLOWED_TAG_PATTERNS.some((re) => re.test(t))
    );
    for (const tag of valid) revalidateTag(tag);
    revalidatedTags = valid.length;
  }

  return NextResponse.json({ revalidatedPaths, revalidatedTags });
}
