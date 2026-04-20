"use server";

import { revalidatePath } from "next/cache";
import { requireMissionControl } from "@/lib/mission-control/auth";
import { moderateReview } from "@/lib/mission-control/reviews";

export async function flagReview(formData: FormData) {
  await requireMissionControl();
  await moderateReview(String(formData.get("id")), "flagged");
  revalidatePath("/mission-control/reviews");
}

export async function removeReview(formData: FormData) {
  await requireMissionControl();
  await moderateReview(String(formData.get("id")), "removed");
  revalidatePath("/mission-control/reviews");
}

export async function restoreReview(formData: FormData) {
  await requireMissionControl();
  await moderateReview(String(formData.get("id")), "published");
  revalidatePath("/mission-control/reviews");
}
