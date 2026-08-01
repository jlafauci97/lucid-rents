import type { PlatformVariants, PublishResult } from "@/types/marketing";
import { getDraft, updateDraft } from "./supabase-queries";
import { publishToAllPlatforms } from "./post-bridge";

export class DraftNotFoundError extends Error {
  constructor(draftId: string) {
    super(`Draft ${draftId} not found`);
    this.name = "DraftNotFoundError";
  }
}

/**
 * Pushes a draft to every configured platform and records the outcome.
 *
 * Shared by the content workflow's automatic publish step and the manual
 * approve route, so a post assembled by hand goes out through exactly the same
 * path as one published unattended.
 */
export async function publishDraft(
  draftId: string,
  editedContent?: { caption?: string; platform_variants?: PlatformVariants }
): Promise<PublishResult[]> {
  const draft = await getDraft(draftId);
  if (!draft) {
    throw new DraftNotFoundError(draftId);
  }

  let variants = draft.platform_variants ?? {};
  let caption = draft.caption ?? "";

  if (editedContent?.caption) {
    caption = editedContent.caption;
  }
  if (editedContent?.platform_variants) {
    variants = { ...variants, ...editedContent.platform_variants };
  }

  const results = await publishToAllPlatforms(variants, draft.media_urls ?? []);

  await updateDraft(draftId, {
    status: "published",
    caption,
    platformVariants: variants,
    publishedAt: new Date().toISOString(),
    publishResults: results,
  });

  return results;
}
