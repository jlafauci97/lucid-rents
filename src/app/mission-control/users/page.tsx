import { MCHeader } from "@/components/mission-control/MCHeader";
import { StatTile } from "@/components/mission-control/StatTile";
import { UsersTable } from "@/components/mission-control/UsersTable";
import { listUsers } from "@/lib/mission-control/users";
import { getHubStats } from "@/lib/mission-control/stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);

  const [{ users, hasMore }, stats] = await Promise.all([
    listUsers({ page: pageNum, pageSize: 20, search: q }),
    getHubStats(),
  ]);

  return (
    <>
      <MCHeader title="Users" subtitle="Manage accounts, roles, access." />
      <main className="flex-1 space-y-6 overflow-y-auto p-8">
        <div className="grid grid-cols-3 gap-4">
          <StatTile value={stats.usersTotal} label="total users" />
          <StatTile value={stats.usersNewLast7d} label="new this week" />
          <StatTile value={users.length} label="shown on this page" />
        </div>

        <form className="flex gap-2" action="/mission-control/users" method="get">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search email or user ID (current page only)…"
            className="flex-1 rounded-md border border-slate-700 bg-[#0F1D2E] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#3B82F6] focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white"
          >
            Search
          </button>
        </form>
        {q && (
          <p className="text-xs text-amber-400/80">
            Heads-up: search filters only the current page of results. Paginate to find users on later pages.
          </p>
        )}

        <UsersTable users={users} />

        <div className="flex justify-between text-sm text-slate-400">
          <span>Page {pageNum}</span>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <a
                href={`/mission-control/users?page=${pageNum - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className="rounded bg-slate-800 px-3 py-1 text-slate-200"
              >
                Previous
              </a>
            )}
            {hasMore && (
              <a
                href={`/mission-control/users?page=${pageNum + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className="rounded bg-slate-800 px-3 py-1 text-slate-200"
              >
                Next
              </a>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
