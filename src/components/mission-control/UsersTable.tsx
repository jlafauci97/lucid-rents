import Link from "next/link";
import type { MCUser } from "@/lib/mission-control/users";

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function UsersTable({ users }: { users: MCUser[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900/50 text-left text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Joined</th>
            <th className="px-4 py-3">Last sign-in</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-slate-900/30">
              <td className="px-4 py-3 text-slate-100">
                {u.email || <span className="italic text-slate-500">(no email)</span>}
              </td>
              <td className="px-4 py-3 text-slate-300">{u.role}</td>
              <td className="px-4 py-3">
                {u.banned ? (
                  <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs text-red-300">Banned</span>
                ) : u.deleted_at ? (
                  <span className="rounded bg-slate-500/15 px-2 py-0.5 text-xs text-slate-400">Deleted</span>
                ) : (
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">Active</span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-400">{timeAgo(u.created_at)}</td>
              <td className="px-4 py-3 text-slate-400">{timeAgo(u.last_sign_in_at)}</td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/mission-control/users/${u.id}`}
                  className="rounded-md bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={6} className="p-8 text-center text-slate-500">
                No users.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
