import { notFound } from "next/navigation";
import { MCHeader } from "@/components/mission-control/MCHeader";
import { UserActionsBar } from "@/components/mission-control/UserActionsBar";
import { getUserDetail } from "@/lib/mission-control/users";
import {
  banUserAction,
  unbanUserAction,
  deleteUserAction,
  setUserRoleAction,
  impersonateUserAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let user: Awaited<ReturnType<typeof getUserDetail>>;
  try {
    user = await getUserDetail(id);
  } catch {
    notFound();
  }

  return (
    <>
      <MCHeader
        title={user.email || user.id}
        subtitle={`Joined ${new Date(user.created_at).toLocaleDateString()}`}
      />
      <main className="flex-1 space-y-6 overflow-y-auto p-8">
        <dl className="grid max-w-2xl grid-cols-2 gap-4">
          <div>
            <dt className="text-xs uppercase text-slate-500">User ID</dt>
            <dd className="font-mono text-sm text-slate-200">{user.id}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Email</dt>
            <dd className="text-sm text-slate-200">{user.email || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Role</dt>
            <dd className="text-sm text-slate-200">{user.role}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Status</dt>
            <dd className="text-sm text-slate-200">
              {user.banned ? "Banned" : user.deleted_at ? "Deleted" : "Active"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Last sign-in</dt>
            <dd className="text-sm text-slate-200">
              {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "never"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Reviews written</dt>
            <dd className="text-sm text-slate-200">{user.reviewsCount}</dd>
          </div>
        </dl>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Actions
          </h2>
          <UserActionsBar
            userId={user.id}
            banned={user.banned}
            role={user.role}
            onBan={banUserAction}
            onUnban={unbanUserAction}
            onDelete={deleteUserAction}
            onSetRole={setUserRoleAction}
            onImpersonate={impersonateUserAction}
          />
        </div>
      </main>
    </>
  );
}
