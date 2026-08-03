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

  // Only call it published if something actually published. Marking the row
  // `published` regardless of outcome is how a run where all nine platforms
  // failed still looked like a success — the same class of silent failure that
  // let this pipeline report 241 runs and zero posts without anyone noticing.
  const succeeded = results.filter((r) => !r.error);

  if (succeeded.length === 0) {
    const reasons = [...new Set(results.map((r) => String(r.error)))].join("; ");
    await updateDraft(draftId, {
      status: "failed",
      caption,
      platformVariants: variants,
      publishResults: results,
      errorMessage: `Publish failed on all ${results.length} platforms: ${reasons}`,
    });
    throw new Error(`Publish failed on all ${results.length} platforms: ${reasons}`);
  }

  await updateDraft(draftId, {
    status: "published",
    caption,
    platformVariants: variants,
    publishedAt: new Date().toISOString(),
    publishResults: results,
    ...(succeeded.length < results.length
      ? {
          errorMessage: `Partial publish: ${succeeded.length}/${results.length} platforms succeeded`,
        }
      : {}),
  });

  return results;
}
