import Link from "next/link";
import type { RecentSignup } from "@/lib/mission-control/users";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function RecentActivityFeed({ signups }: { signups: RecentSignup[] }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-[#0F1D2E] p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Recent signups
      </h3>
      <ul className="space-y-2">
        {signups.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
            <Link
              href={`/mission-control/users/${s.id}`}
              className="truncate text-slate-200 hover:text-[#3B82F6]"
            >
              {s.email || s.id}
            </Link>
            <span className="shrink-0 text-xs text-slate-500">{timeAgo(s.created_at)}</span>
          </li>
        ))}
        {signups.length === 0 && (
          <li className="text-sm text-slate-500">No recent signups.</li>
        )}
      </ul>
    </div>
  );
}
