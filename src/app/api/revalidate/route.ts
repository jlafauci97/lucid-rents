import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

const ALLOWED_PATH_PATTERNS = [/^\/\[city\]($|\/)/, /^\/$/];
const MAX_PATHS = 10;

export async function POST(req: NextRequest) {
  const { paths, secret } = await req.json();

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!Array.isArray(paths) || paths.length > MAX_PATHS) {
    return NextResponse.json({ error: "Invalid paths" }, { status: 400 });
  }

  const validPaths = paths.filter(
    (p: unknown) =>
      typeof p === "string" &&
      ALLOWED_PATH_PATTERNS.some((re) => re.test(p))
  );

  for (const path of validPaths) {
    revalidatePath(path, "page");
  }

  return NextResponse.json({ revalidated: validPaths.length });
}
