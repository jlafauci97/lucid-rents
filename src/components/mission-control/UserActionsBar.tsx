"use client";
import { useState } from "react";
import type { UserRole } from "@/lib/mission-control/users";

interface Props {
  userId: string;
  banned: boolean;
  role: UserRole;
  onBan: (fd: FormData) => Promise<void>;
  onUnban: (fd: FormData) => Promise<void>;
  onDelete: (fd: FormData) => Promise<void>;
  onSetRole: (fd: FormData) => Promise<void>;
  onImpersonate: (fd: FormData) => Promise<{ link: string }>;
}

export function UserActionsBar({
  userId,
  banned,
  role,
  onBan,
  onUnban,
  onDelete,
  onSetRole,
  onImpersonate,
}: Props) {
  const [impersonateLink, setImpersonateLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: (fd: FormData) => Promise<void>) {
    setError(null);
    const fd = new FormData();
    fd.append("userId", userId);
    try {
      await action(fd);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    }
  }

  async function doImpersonate() {
    setError(null);
    const fd = new FormData();
    fd.append("userId", userId);
    try {
      const { link } = await onImpersonate(fd);
      setImpersonateLink(link);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    }
  }

  async function changeRole(newRole: UserRole) {
    setError(null);
    const fd = new FormData();
    fd.append("userId", userId);
    fd.append("role", newRole);
    try {
      await onSetRole(fd);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {banned ? (
          <button
            onClick={() => run(onUnban)}
            className="rounded bg-emerald-600 px-3 py-2 text-sm text-white"
          >
            Unban
          </button>
        ) : (
          <button
            onClick={() => run(onBan)}
            className="rounded bg-amber-600 px-3 py-2 text-sm text-white"
          >
            Ban
          </button>
        )}
        <button
          onClick={() => {
            if (confirm("Permanently delete this account and all auth records?")) {
              run(onDelete);
            }
          }}
          className="rounded bg-red-600 px-3 py-2 text-sm text-white"
        >
          Delete
        </button>
        <button
          onClick={doImpersonate}
          className="rounded bg-slate-700 px-3 py-2 text-sm text-white"
        >
          Get impersonation link
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-400">Role:</span>
        <select
          defaultValue={role}
          onChange={(e) => changeRole(e.target.value as UserRole)}
          className="rounded border border-slate-700 bg-[#0F1D2E] px-2 py-1 text-slate-100"
        >
          <option value="user">user</option>
          <option value="moderator">moderator</option>
          <option value="admin">admin</option>
        </select>
      </div>

      {impersonateLink && (
        <div className="rounded border border-slate-700 bg-slate-900 p-3 text-xs">
          <div className="mb-1 text-slate-400">Magic link (valid for 1 hour):</div>
          <code className="break-all text-slate-200">{impersonateLink}</code>
        </div>
      )}
      {error && <div className="text-sm text-red-400">{error}</div>}
    </div>
  );
}
