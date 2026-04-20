"use client";

import Link from "next/link";
import type { MCReview, ReviewStatus } from "@/lib/mission-control/reviews";

const STATUS_STYLES: Record<ReviewStatus, string> = {
  published: "bg-emerald-500/15 text-emerald-300",
  approved: "bg-emerald-500/15 text-emerald-300",
  flagged: "bg-amber-500/15 text-amber-300",
  removed: "bg-red-500/15 text-red-300",
  draft: "bg-slate-500/15 text-slate-400",
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Props {
  reviews: MCReview[];
  onFlag: (fd: FormData) => Promise<void>;
  onRemove: (fd: FormData) => Promise<void>;
  onRestore: (fd: FormData) => Promise<void>;
}

export function ReviewsTable({ reviews, onFlag, onRemove, onRestore }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900/50 text-left text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3">Reviewer</th>
            <th className="px-4 py-3">Building</th>
            <th className="px-4 py-3">Rating</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Posted</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {reviews.map((r) => (
            <tr key={r.id} className="hover:bg-slate-900/30 align-top">
              <td className="px-4 py-3">
                {r.user_id ? (
                  <Link
                    href={`/mission-control/users/${r.user_id}`}
                    className="text-slate-100 hover:text-[#3B82F6]"
                  >
                    {r.reviewer_email || r.reviewer_name || "(unknown)"}
                  </Link>
                ) : (
                  <span className="text-slate-400">{r.reviewer_name || "scraped"}</span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-300">
                <div>{r.building_address ?? r.building_id}</div>
                {r.building_city && (
                  <div className="text-xs text-slate-500">{r.building_city}</div>
                )}
              </td>
              <td className="px-4 py-3 text-slate-300">{r.overall_rating ?? "—"}</td>
              <td className="px-4 py-3">
                <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLES[r.status]}`}>
                  {r.status}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-400">{timeAgo(r.created_at)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1.5">
                  {r.status !== "flagged" && (
                    <form action={onFlag}>
                      <input type="hidden" name="id" value={r.id} />
                      <button
                        type="submit"
                        className="rounded bg-amber-600/80 px-2 py-1 text-xs text-white hover:bg-amber-600"
                      >
                        Flag
                      </button>
                    </form>
                  )}
                  {r.status !== "removed" && (
                    <form action={onRemove}>
                      <input type="hidden" name="id" value={r.id} />
                      <button
                        type="submit"
                        className="rounded bg-red-600/80 px-2 py-1 text-xs text-white hover:bg-red-600"
                      >
                        Remove
                      </button>
                    </form>
                  )}
                  {(r.status === "flagged" || r.status === "removed") && (
                    <form action={onRestore}>
                      <input type="hidden" name="id" value={r.id} />
                      <button
                        type="submit"
                        className="rounded bg-emerald-600/80 px-2 py-1 text-xs text-white hover:bg-emerald-600"
                      >
                        Restore
                      </button>
                    </form>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {reviews.length === 0 && (
            <tr>
              <td colSpan={6} className="p-8 text-center text-slate-500">
                No reviews.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
