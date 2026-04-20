"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMissionControl } from "@/lib/mission-control/auth";
import {
  banUser,
  unbanUser,
  deleteUser,
  setUserRole,
  createImpersonationLink,
  type UserRole,
} from "@/lib/mission-control/users";

const USER_PATH = (id: string) => `/mission-control/users/${id}`;

export async function banUserAction(formData: FormData) {
  await requireMissionControl();
  const id = String(formData.get("userId"));
  await banUser(id);
  revalidatePath(USER_PATH(id));
  revalidatePath("/mission-control/users");
}

export async function unbanUserAction(formData: FormData) {
  await requireMissionControl();
  const id = String(formData.get("userId"));
  await unbanUser(id);
  revalidatePath(USER_PATH(id));
  revalidatePath("/mission-control/users");
}

export async function deleteUserAction(formData: FormData) {
  await requireMissionControl();
  const id = String(formData.get("userId"));
  await deleteUser(id);
  revalidatePath("/mission-control/users");
  redirect("/mission-control/users");
}

export async function setUserRoleAction(formData: FormData) {
  await requireMissionControl();
  const id = String(formData.get("userId"));
  const role = String(formData.get("role")) as UserRole;
  await setUserRole(id, role);
  revalidatePath(USER_PATH(id));
}

export async function impersonateUserAction(formData: FormData): Promise<{ link: string }> {
  await requireMissionControl();
  const id = String(formData.get("userId"));
  const link = await createImpersonationLink(id);
  return { link };
}
